const prisma = require("../config/prismaClient");
const {
  OWNER_TYPES,
  LOT_STATUS,
  createLot,
  consumeLots,
  recordTransfer,
  deleteLotCascade,
  deleteLotDirect,
  updateNearestExpiration,
  restoreOrRecreateLotForRejectedTransfer,
} = require("../services/stockLotService");
const { logEventAsync } = require("../services/eventLogService");
const { notifyAppointmentCancelled } = require("../services/notificationService");

const resolveRegionIdForUser = async (user, overrideRegionId = null) => {
  // Pour SUPERADMIN, utiliser l'override si fourni
  if (user.role === "SUPERADMIN" && overrideRegionId) {
    return overrideRegionId;
  }
  
  if (user.regionId) {
    return user.regionId;
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { regionId: true },
  });

  return dbUser?.regionId ?? null;
};

const resolveDistrictIdForUser = async (user, overrideDistrictId = null) => {
  // Pour SUPERADMIN, utiliser l'override si fourni
  if (user.role === "SUPERADMIN" && overrideDistrictId) {
    return overrideDistrictId;
  }
  
  if (user.districtId) {
    return user.districtId;
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { districtId: true },
  });

  return dbUser?.districtId ?? null;
};

const resolveHealthCenterIdForUser = async (user, overrideHealthCenterId = null) => {
  // Pour SUPERADMIN, utiliser l'override si fourni
  if (user.role === "SUPERADMIN" && overrideHealthCenterId) {
    return overrideHealthCenterId;
  }
  
  if (user.healthCenterId) {
    return user.healthCenterId;
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { healthCenterId: true },
  });

  return dbUser?.healthCenterId ?? null;
};

const ensureDistrictBelongsToRegion = async (districtId, regionId) => {
  const district = await prisma.district.findUnique({
    where: { id: districtId },
    include: { commune: { select: { regionId: true } } },
  });

  if (!district) {
    const error = new Error("District introuvable");
    error.status = 404;
    throw error;
  }

  if (!district.commune || district.commune.regionId !== regionId) {
    const error = new Error("District hors de votre région");
    error.status = 403;
    throw error;
  }
};

const fetchDistrictIdsForRegion = async (regionId) => {
  const districts = await prisma.district.findMany({
    where: { commune: { regionId } },
    select: { id: true },
  });

  return districts.map((entry) => entry.id);
};

const createHttpError = (status, message) => {
  const error = new Error(message);
  error.status = status;
  return error;
};

const normalizeOwnerIdValue = (ownerType, ownerId) =>
  ownerType === OWNER_TYPES.NATIONAL ? null : ownerId ?? null;

const formatLotRecords = (records) =>
  records.map((lot) => ({
    id: lot.id,
    vaccineId: lot.vaccineId,
    quantity: lot.quantity,
    remainingQuantity: lot.remainingQuantity,
    distributedQuantity: lot.quantity - lot.remainingQuantity,
    expiration: lot.expiration,
    status: lot.status,
    sourceLotId: lot.sourceLotId,
    createdAt: lot.createdAt,
    updatedAt: lot.updatedAt,
    derivedCount: lot._count?.derivedLots ?? 0,
  }));

const buildLotsResponse = (records) => {
  const formatted = formatLotRecords(records);
  const totalRemaining = formatted.reduce(
    (sum, lot) => sum + lot.remainingQuantity,
    0,
  );

  return {
    lots: formatted,
    totalRemaining,
  };
};

const fetchLotsForOwner = async ({ vaccineId, ownerType, ownerId }) => {
  const normalizedOwnerId = normalizeOwnerIdValue(ownerType, ownerId);

  return prisma.stockLot.findMany({
    where: {
      vaccineId,
      ownerType,
      ownerId: normalizedOwnerId,
      // Ne pas afficher les lots vides (quantity: 0) ou PENDING
      quantity: { gt: 0 },
      status: { not: LOT_STATUS.PENDING },
    },
    orderBy: [
      { status: "asc" },
      { expiration: "asc" },
    ],
    include: {
      _count: {
        select: {
          derivedLots: true,
        },
      },
    },
  });
};

// Helper pour récupérer le nom d'un owner (expéditeur/destinataire)
const getOwnerName = async (tx, ownerType, ownerId) => {
  if (!ownerId) {
    return ownerType === OWNER_TYPES.NATIONAL ? "Stock National" : null;
  }

  switch (ownerType) {
    case OWNER_TYPES.NATIONAL:
      return "Stock National";
    case OWNER_TYPES.REGIONAL: {
      const region = await tx.region.findUnique({
        where: { id: ownerId },
        select: { name: true },
      });
      return region?.name || null;
    }
    case OWNER_TYPES.DISTRICT: {
      const district = await tx.district.findUnique({
        where: { id: ownerId },
        select: { name: true },
      });
      return district?.name || null;
    }
    case OWNER_TYPES.HEALTHCENTER: {
      const healthCenter = await tx.healthCenter.findUnique({
        where: { id: ownerId },
        select: { name: true },
      });
      return healthCenter?.name || null;
    }
    default:
      return null;
  }
};

const ensureHealthCenterAccessible = async (user, healthCenterId) => {
  const healthCenter = await prisma.healthCenter.findUnique({
    where: { id: healthCenterId },
    include: {
      district: {
        include: {
          commune: {
            select: { regionId: true },
          },
        },
      },
    },
  });

  if (!healthCenter) {
    throw createHttpError(404, "Centre de santé introuvable");
  }

  if (user.role === "DISTRICT") {
    const districtId = await resolveDistrictIdForUser(user);
    if (!districtId || healthCenter.districtId !== districtId) {
      throw createHttpError(403, "Centre hors de votre district");
    }
  } else if (user.role === "REGIONAL") {
    const regionId = await resolveRegionIdForUser(user);
    const centerRegionId = healthCenter.district?.commune?.regionId ?? null;
    if (!regionId || centerRegionId !== regionId) {
      throw createHttpError(403, "Centre hors de votre région");
    }
  }

  return healthCenter;
};

/**
 * Fonction utilitaire pour annuler plusieurs rendez-vous liés à des réservations de stock
 * @param {Object} tx - Transaction Prisma
 * @param {string[]} scheduleIds - Tableau d'IDs de rendez-vous à annuler
 * @returns {Promise<Array>} - Tableau d'informations sur les rendez-vous annulés pour les notifications
 */
const cancelAppointmentsForSchedules = async (tx, scheduleIds) => {
  if (!scheduleIds || scheduleIds.length === 0) {
    return [];
  }

  const cancelledAppointments = [];

  // Récupérer tous les rendez-vous avec leurs informations pour les notifications
  const scheduledAppointments = await tx.childVaccineScheduled.findMany({
    where: { id: { in: scheduleIds } },
    include: {
      vaccine: { select: { id: true, name: true } },
      child: { select: { id: true, healthCenterId: true } },
    },
  });

  // Grouper par enfant pour optimiser les mises à jour
  const appointmentsByChild = {};
  for (const appointment of scheduledAppointments) {
    const childId = appointment.childId;
    if (!appointmentsByChild[childId]) {
      appointmentsByChild[childId] = [];
    }
    appointmentsByChild[childId].push(appointment);
  }

  // Fonction pour libérer une réservation
  const releaseReservationForSchedule = async (scheduleId) => {
    const reservation = await tx.stockReservation.findUnique({
      where: { scheduleId },
      include: {
        stockLot: {
          select: {
            id: true,
            vaccineId: true,
            ownerType: true,
            ownerId: true,
          },
        },
      },
    });

    if (!reservation) {
      return null;
    }

    // Libérer la dose si c'est un lot HEALTHCENTER
    if (reservation.stockLot.ownerType === OWNER_TYPES.HEALTHCENTER && reservation.stockLot.ownerId) {
      const { releaseDoseForHealthCenter } = require("../services/stockLotService");
      await releaseDoseForHealthCenter(tx, {
        vaccineId: reservation.stockLot.vaccineId,
        healthCenterId: reservation.stockLot.ownerId,
        lotId: reservation.stockLot.id,
        quantity: reservation.quantity,
      });
    }

    await tx.stockReservation.delete({
      where: { id: reservation.id },
    });

    return reservation;
  };

  // Fonction pour réassigner les doses (simplifiée pour stockController)
  const reassignDosesForVaccine = async (childId, vaccineId) => {
    const scheduledAppointments = await tx.childVaccineScheduled.findMany({
      where: {
        childId,
        vaccineId,
      },
      orderBy: {
        scheduledFor: "asc",
      },
      select: {
        id: true,
        scheduledFor: true,
        dose: true,
      },
    });

    if (scheduledAppointments.length === 0) {
      return;
    }

    const completedDoses = await tx.childVaccineCompleted.findMany({
      where: {
        childId,
        vaccineId,
      },
      select: {
        dose: true,
      },
    });

    const completedDoseValues = completedDoses
      .map((c) => (typeof c.dose === "number" ? c.dose : null))
      .filter((dose) => dose != null);
    const scheduledDoseValues = scheduledAppointments
      .map((s) => (typeof s.dose === "number" ? s.dose : null))
      .filter((dose) => dose != null);

    const completedDoseNumbers = new Set(completedDoseValues);

    const maxCompletedDose =
      completedDoseValues.length > 0 ? Math.max(...completedDoseValues) : 0;
    const maxScheduledDose =
      scheduledDoseValues.length > 0 ? Math.max(...scheduledDoseValues) : 0;
    const tempBase = Math.max(maxCompletedDose, maxScheduledDose) + 1;

    // Première passe : attribuer des doses temporaires
    for (let i = 0; i < scheduledAppointments.length; i += 1) {
      await tx.childVaccineScheduled.update({
        where: { id: scheduledAppointments[i].id },
        data: { dose: tempBase + i },
      });
    }

    // Deuxième passe : assigner les doses finales dans l'ordre chronologique
    let currentDose = 1;
    for (const appointment of scheduledAppointments) {
      while (completedDoseNumbers.has(currentDose)) {
        currentDose++;
      }
      await tx.childVaccineScheduled.update({
        where: { id: appointment.id },
        data: { dose: currentDose },
      });
      currentDose++;
    }
  };

  // Fonction pour mettre à jour nextAppointment
  const updateNextAppointment = async (childId) => {
    const nextScheduled = await tx.childVaccineScheduled.findFirst({
      where: { childId },
      orderBy: { scheduledFor: "asc" },
      select: { scheduledFor: true, vaccineId: true, plannerId: true },
    });

    await tx.children.update({
      where: { id: childId },
      data: {
        nextAppointment: nextScheduled?.scheduledFor || null,
        nextVaccineId: nextScheduled?.vaccineId || null,
        nextAgentId: nextScheduled?.plannerId || null,
      },
    });
  };

  // Annuler chaque rendez-vous
  for (const appointment of scheduledAppointments) {
    // Libérer la réservation
    await releaseReservationForSchedule(appointment.id);

    // Supprimer le rendez-vous
    await tx.childVaccineScheduled.delete({ where: { id: appointment.id } });

    // Sauvegarder les informations pour la notification
    cancelledAppointments.push({
      childId: appointment.childId,
      vaccineId: appointment.vaccineId,
      vaccineName: appointment.vaccine?.name ?? "vaccin",
      scheduledDate: appointment.scheduledFor,
    });
  }

  // Réassigner les doses et mettre à jour nextAppointment pour chaque enfant
  for (const [childId, appointments] of Object.entries(appointmentsByChild)) {
    const vaccineId = appointments[0]?.vaccineId;
    if (vaccineId) {
      await reassignDosesForVaccine(childId, vaccineId);
    }
    await updateNextAppointment(childId);
  }

  return cancelledAppointments;
};

const deleteStockForOwner = async ({ ownerType, ownerId, vaccineId }) => {
  await prisma.$transaction(async (tx) => {
    let stock = null;
    switch (ownerType) {
      case OWNER_TYPES.NATIONAL:
        stock = await tx.stockNATIONAL.findUnique({
          where: { vaccineId },
        });
        if (!stock) {
          throw createHttpError(404, "Stock national introuvable");
        }
        break;
      case OWNER_TYPES.REGIONAL: {
        const regionId = ownerId;
        stock = await tx.stockREGIONAL.findUnique({
          where: {
            vaccineId_regionId: {
              vaccineId,
              regionId,
            },
          },
        });
        if (!stock) {
          throw createHttpError(404, "Stock régional introuvable");
        }
        break;
      }
      case OWNER_TYPES.DISTRICT: {
        const districtId = ownerId;
        stock = await tx.stockDISTRICT.findUnique({
          where: {
            vaccineId_districtId: {
              vaccineId,
              districtId,
            },
          },
        });
        if (!stock) {
          throw createHttpError(404, "Stock district introuvable");
        }
        break;
      }
      case OWNER_TYPES.HEALTHCENTER: {
        const healthCenterId = ownerId;
        stock = await tx.stockHEALTHCENTER.findUnique({
          where: {
            vaccineId_healthCenterId: {
              vaccineId,
              healthCenterId,
            },
          },
        });
        if (!stock) {
          throw createHttpError(404, "Stock du centre introuvable");
        }
        break;
      }
      default:
        throw createHttpError(400, "Type de stock inconnu");
    }

    const normalizedOwnerId = normalizeOwnerIdValue(ownerType, ownerId);
    const lots = await tx.stockLot.findMany({
      where: {
        vaccineId,
        ownerType,
        ownerId: normalizedOwnerId,
      },
      select: { id: true },
    });

    // Supprimer les lots directement (sans cascade) pour ne supprimer que localement
    for (const lot of lots) {
      await deleteLotDirect(tx, lot.id);
    }

    switch (ownerType) {
      case OWNER_TYPES.NATIONAL:
        await tx.stockNATIONAL.delete({ where: { vaccineId } });
        break;
      case OWNER_TYPES.REGIONAL:
        await tx.stockREGIONAL.delete({
          where: {
            vaccineId_regionId: {
              vaccineId,
              regionId: ownerId,
            },
          },
        });
        break;
      case OWNER_TYPES.DISTRICT:
        await tx.stockDISTRICT.delete({
          where: {
            vaccineId_districtId: {
              vaccineId,
              districtId: ownerId,
            },
          },
        });
        break;
      case OWNER_TYPES.HEALTHCENTER:
        await tx.stockHEALTHCENTER.delete({
          where: {
            vaccineId_healthCenterId: {
              vaccineId,
              healthCenterId: ownerId,
            },
          },
        });
        break;
      default:
        break;
    }
  });
};

const buildExpiredLotKey = (ownerType, ownerId, vaccineId) =>
  `${ownerType}::${ownerId ?? "root"}::${vaccineId}`;

// Helper pour calculer la date d'expiration la plus proche pour un ensemble de stocks
const calculateNearestExpirations = async (stocks, ownerType) => {
  if (!stocks || stocks.length === 0) {
    return new Map();
  }

  // Créer un Map pour regrouper les stocks par (ownerId, vaccineId)
  const stockKeys = new Map();
  for (const stock of stocks) {
    let ownerId = null;
    if (ownerType === OWNER_TYPES.REGIONAL) {
      ownerId = stock.regionId;
    } else if (ownerType === OWNER_TYPES.DISTRICT) {
      ownerId = stock.districtId;
    } else if (ownerType === OWNER_TYPES.HEALTHCENTER) {
      ownerId = stock.healthCenterId;
    }

    const key = `${ownerId ?? "null"}::${stock.vaccineId}`;
    if (!stockKeys.has(key)) {
      stockKeys.set(key, { ownerId, vaccineId: stock.vaccineId });
    }
  }

  // Récupérer les dates d'expiration les plus proches
  const ownerIds = Array.from(new Set(
    Array.from(stockKeys.values()).map((s) => s.ownerId).filter((id) => id != null)
  ));
  const vaccineIds = Array.from(new Set(
    Array.from(stockKeys.values()).map((s) => s.vaccineId)
  ));

  const where = {
    ownerType,
    vaccineId: { in: vaccineIds },
    status: { in: [LOT_STATUS.VALID, LOT_STATUS.EXPIRED] },
    remainingQuantity: { gt: 0 },
  };

  if (ownerIds.length > 0) {
    where.ownerId = { in: ownerIds };
  } else if (ownerType === OWNER_TYPES.NATIONAL) {
    where.ownerId = null;
  }

  const nearestExpirations = await prisma.stockLot.findMany({
    where,
    select: {
      ownerId: true,
      vaccineId: true,
      expiration: true,
    },
    orderBy: {
      expiration: "asc",
    },
  });

  // Créer un Map pour stocker la date d'expiration la plus proche par (ownerId, vaccineId)
  const nearestExpirationMap = new Map();
  for (const lot of nearestExpirations) {
    const key = `${lot.ownerId ?? "null"}::${lot.vaccineId}`;
    if (!nearestExpirationMap.has(key)) {
      nearestExpirationMap.set(key, lot.expiration);
    }
  }

  return nearestExpirationMap;
};

const fetchExpiredLotsSet = async ({
  ownerType,
  ownerIds,
}) => {
  const where = {
    ownerType,
    status: LOT_STATUS.EXPIRED,
    remainingQuantity: { gt: 0 },
  };

  if (Array.isArray(ownerIds)) {
    const filtered = ownerIds.filter((value) => value != null);
    if (filtered.length > 0) {
      where.ownerId = { in: filtered };
    }
  } else if (ownerIds != null) {
    where.ownerId = ownerIds;
  }

  const lots = await prisma.stockLot.findMany({
    where,
    select: { ownerId: true, vaccineId: true },
  });

  return new Set(
    lots.map((lot) => buildExpiredLotKey(ownerType, lot.ownerId, lot.vaccineId)),
  );
};

const getStockNATIONAL = async (req, res, next) => {
  if (req.user.role !== "NATIONAL" && req.user.role !== "SUPERADMIN") {
    return res.status(403).json({ message: "Accès refusé" });
  }

  try {
    const national = await prisma.stockNATIONAL.findMany({
      include: { vaccine: true },
      orderBy: { vaccine: { name: "asc" } },
    });

    const expiredSet = await fetchExpiredLotsSet({
      ownerType: OWNER_TYPES.NATIONAL,
    });

    // Calculer les dates d'expiration les plus proches
    const nearestExpirationMap = await calculateNearestExpirations(national, OWNER_TYPES.NATIONAL);

    const nationalWithFlag = national.map((stock) => {
      const key = `null::${stock.vaccineId}`;
      return {
        ...stock,
        hasExpiredLot: expiredSet.has(
          buildExpiredLotKey(OWNER_TYPES.NATIONAL, null, stock.vaccineId),
        ),
        nearestExpiration: nearestExpirationMap.get(key) || null,
      };
    });

    res.json({ national: nationalWithFlag });
  } catch (error) {
    next(error);
  }
};

const listNationalLots = async (req, res, next) => {
  if (req.user.role !== "NATIONAL" && req.user.role !== "SUPERADMIN") {
    return res.status(403).json({ message: "Accès refusé" });
  }

  const { vaccineId } = req.params;

  if (!vaccineId) {
    return res.status(400).json({
      message: "vaccineId est requis pour consulter les lots",
    });
  }

  try {
    const lots = await fetchLotsForOwner({
      vaccineId,
      ownerType: OWNER_TYPES.NATIONAL,
      ownerId: null,
    });

    res.json(buildLotsResponse(lots));
  } catch (error) {
    next(error);
  }
};

const listRegionalLots = async (req, res, next) => {
  if (!["SUPERADMIN", "NATIONAL", "REGIONAL"].includes(req.user.role)) {
    return res.status(403).json({ message: "Accès refusé" });
  }

  const { vaccineId } = req.params;
  let regionId =
    typeof req.query.regionId === "string" ? req.query.regionId : null;

  if (!vaccineId) {
    return res
      .status(400)
      .json({ message: "vaccineId est requis pour consulter les lots" });
  }

  try {
    // Pour SUPERADMIN, accepter regionId depuis query params
    const overrideRegionId = req.user.role === "SUPERADMIN" ? req.query.regionId : null;
    
    if (req.user.role === "REGIONAL" || (req.user.role === "SUPERADMIN" && overrideRegionId)) {
      regionId = await resolveRegionIdForUser(req.user, overrideRegionId);
      if (!regionId) {
        throw createHttpError(400, "Impossible d'identifier votre région");
      }
    } else if (req.user.role !== "SUPERADMIN" && !regionId) {
      throw createHttpError(400, "regionId est requis");
    }

    const lots = await fetchLotsForOwner({
      vaccineId,
      ownerType: OWNER_TYPES.REGIONAL,
      ownerId: regionId,
    });

    res.json(buildLotsResponse(lots));
  } catch (error) {
    next(error);
  }
};

const listDistrictLots = async (req, res, next) => {
  if (!["SUPERADMIN", "NATIONAL", "REGIONAL", "DISTRICT"].includes(req.user.role)) {
    return res.status(403).json({ message: "Accès refusé" });
  }

  const { vaccineId } = req.params;
  let districtId =
    typeof req.query.districtId === "string" ? req.query.districtId : null;

  if (!vaccineId) {
    return res
      .status(400)
      .json({ message: "vaccineId est requis pour consulter les lots" });
  }

  try {
    // Pour SUPERADMIN, accepter districtId ou regionId depuis query params
    const overrideDistrictId = req.user.role === "SUPERADMIN" ? req.query.districtId : null;
    const overrideRegionId = req.user.role === "SUPERADMIN" ? req.query.regionId : null;
    
    if (req.user.role === "DISTRICT" || (req.user.role === "SUPERADMIN" && overrideDistrictId)) {
      districtId = await resolveDistrictIdForUser(req.user, overrideDistrictId);
      if (!districtId) {
        throw createHttpError(400, "Impossible d'identifier votre district");
      }
    } else if (req.user.role !== "SUPERADMIN" && !districtId) {
      throw createHttpError(400, "districtId est requis");
    }

    if (req.user.role === "REGIONAL" || (req.user.role === "SUPERADMIN" && overrideRegionId && !overrideDistrictId)) {
      const regionId = await resolveRegionIdForUser(req.user, overrideRegionId);
      if (!regionId) {
        throw createHttpError(400, "Impossible d'identifier votre région");
      }
      if (districtId) {
        await ensureDistrictBelongsToRegion(districtId, regionId);
      }
    }

    const lots = await fetchLotsForOwner({
      vaccineId,
      ownerType: OWNER_TYPES.DISTRICT,
      ownerId: districtId,
    });

    res.json(buildLotsResponse(lots));
  } catch (error) {
    next(error);
  }
};

const listHealthCenterLots = async (req, res, next) => {
  if (
    !["SUPERADMIN", "NATIONAL", "REGIONAL", "DISTRICT", "AGENT"].includes(req.user.role)
  ) {
    return res.status(403).json({ message: "Accès refusé" });
  }

  const { vaccineId } = req.params;
  let healthCenterId =
    typeof req.query.healthCenterId === "string"
      ? req.query.healthCenterId
      : null;

  if (!vaccineId) {
    return res
      .status(400)
      .json({ message: "vaccineId est requis pour consulter les lots" });
  }

  try {
    // Pour SUPERADMIN, accepter healthCenterId, districtId ou regionId depuis query params
    const overrideHealthCenterId = req.user.role === "SUPERADMIN" ? req.query.healthCenterId : null;
    const overrideDistrictId = req.user.role === "SUPERADMIN" ? req.query.districtId : null;
    const overrideRegionId = req.user.role === "SUPERADMIN" ? req.query.regionId : null;
    
    if (req.user.role === "AGENT" || (req.user.role === "SUPERADMIN" && overrideHealthCenterId)) {
      // Permettre l'accès en lecture aux agents ADMIN et STAFF
      if (req.user.role === "AGENT" && req.user.agentLevel !== "ADMIN" && req.user.agentLevel !== "STAFF") {
        return res.status(403).json({ message: "Accès refusé" });
      }
      healthCenterId = await resolveHealthCenterIdForUser(req.user, overrideHealthCenterId);
      if (!healthCenterId) {
        throw createHttpError(
          400,
          "Impossible d'identifier votre centre de santé",
        );
      }
    } else if (req.user.role !== "SUPERADMIN" && !healthCenterId) {
      throw createHttpError(400, "healthCenterId est requis");
    } else if (req.user.role === "DISTRICT" || req.user.role === "REGIONAL" || (req.user.role === "SUPERADMIN" && (overrideDistrictId || overrideRegionId))) {
      if (healthCenterId) {
        await ensureHealthCenterAccessible(req.user, healthCenterId);
      }
    }

    const lots = await fetchLotsForOwner({
      vaccineId,
      ownerType: OWNER_TYPES.HEALTHCENTER,
      ownerId: healthCenterId,
    });

    const lotIds = lots.map((lot) => lot.id);
    const reservations = await prisma.stockReservation.findMany({
      where: {
        stockLotId: { in: lotIds },
      },
      select: {
        stockLotId: true,
        quantity: true,
      },
    });

    const reservationsByLotId = reservations.reduce((acc, res) => {
      if (!acc[res.stockLotId]) {
        acc[res.stockLotId] = 0;
      }
      acc[res.stockLotId] += res.quantity;
      return acc;
    }, {});

    const formatted = formatLotRecords(lots).map((lot) => ({
      ...lot,
      reservedQuantity: reservationsByLotId[lot.id] ?? 0,
    }));

    const totalRemaining = formatted.reduce(
      (sum, lot) => sum + lot.remainingQuantity,
      0,
    );

    res.json({
      lots: formatted,
      totalRemaining,
    });
  } catch (error) {
    next(error);
  }
};

const getStockREGIONAL = async (req, res, next) => {
  if (!["SUPERADMIN", "NATIONAL", "REGIONAL"].includes(req.user.role)) {
    return res.status(403).json({ message: "Accès refusé" });
  }

  try {
    let whereClause = {};
    let resolvedDistrictId = null;

    // Pour SUPERADMIN, accepter regionId depuis query params
    const overrideRegionId = req.user.role === "SUPERADMIN" ? req.query.regionId : null;

    if (req.user.role === "REGIONAL") {
      const regionId = await resolveRegionIdForUser(req.user);
      if (!regionId) {
        return res.json({ regional: [] });
      }
      whereClause = { regionId };
    } else if (req.user.role === "SUPERADMIN" && overrideRegionId) {
      // Superadmin avec regionId spécifique : filtrer par cette région
      const regionId = await resolveRegionIdForUser(req.user, overrideRegionId);
      if (!regionId) {
        return res.json({ regional: [] });
      }
      whereClause = { regionId };
    }
    // Si SUPERADMIN sans regionId ou NATIONAL : voir tous les stocks régionaux (whereClause reste vide)

    const regional = await prisma.stockREGIONAL.findMany({
      where: whereClause,
      include: { vaccine: true, region: true },
      orderBy: [
        { vaccine: { name: "asc" } },
        { region: { name: "asc" } },
      ],
    });

  const regionIds = regional
      .map((stock) => stock.regionId ?? null)
      .filter((id) => id != null);

    const expiredSet = await fetchExpiredLotsSet({
      ownerType: OWNER_TYPES.REGIONAL,
      ownerIds: regionIds.length > 0 ? regionIds : undefined,
    });

    // Calculer les dates d'expiration les plus proches
    const nearestExpirationMap = await calculateNearestExpirations(regional, OWNER_TYPES.REGIONAL);

    const regionalWithFlag = regional.map((stock) => {
      const key = `${stock.regionId ?? "null"}::${stock.vaccineId}`;
      return {
        ...stock,
        hasExpiredLot: expiredSet.has(
          buildExpiredLotKey(
            OWNER_TYPES.REGIONAL,
            stock.regionId ?? null,
            stock.vaccineId,
          ),
        ),
        nearestExpiration: nearestExpirationMap.get(key) || null,
      };
    });

    res.json({ regional: regionalWithFlag });
  } catch (error) {
    next(error);
  }
};

const getStockDISTRICT = async (req, res, next) => {
  if (!["SUPERADMIN", "NATIONAL", "REGIONAL", "DISTRICT"].includes(req.user.role)) {
    return res.status(403).json({ message: "Accès refusé" });
  }

  try {
    let whereClause = {};
    let resolvedDistrictId = null;

    // Pour SUPERADMIN, accepter districtId ou regionId depuis query params
    const overrideDistrictId = req.user.role === "SUPERADMIN" ? req.query.districtId : null;
    const overrideRegionId = req.user.role === "SUPERADMIN" ? req.query.regionId : null;

    if (req.user.role === "REGIONAL" || (req.user.role === "SUPERADMIN" && overrideRegionId && !overrideDistrictId)) {
      const regionId = await resolveRegionIdForUser(req.user, overrideRegionId);
      if (!regionId) {
        return res.json({ district: [] });
      }

      const districtIds = await fetchDistrictIdsForRegion(regionId);
      if (!districtIds.length) {
        return res.json({ district: [] });
      }

      whereClause = { districtId: { in: districtIds } };
    } else if (req.user.role === "DISTRICT" || (req.user.role === "SUPERADMIN" && overrideDistrictId)) {
      const districtId = await resolveDistrictIdForUser(req.user, overrideDistrictId);
      if (!districtId) {
        return res.json({ district: [] });
      }
      resolvedDistrictId = districtId;
      whereClause = { districtId };
    }
    // Si SUPERADMIN sans districtId ni regionId : voir tous les stocks districtaux (whereClause reste vide)

    const district = await prisma.stockDISTRICT.findMany({
      where: whereClause,
      include: { vaccine: true, district: { include: { commune: true } } },
      orderBy: [
        { vaccine: { name: "asc" } },
        { district: { name: "asc" } },
      ],
    });

    const districtIds = district.map((stock) => stock.districtId ?? null).filter(Boolean);
    const expiredSet = await fetchExpiredLotsSet({
      ownerType: OWNER_TYPES.DISTRICT,
      ownerIds: districtIds.length > 0 ? districtIds : undefined,
    });

    // Calculer les dates d'expiration les plus proches
    const nearestExpirationMap = await calculateNearestExpirations(district, OWNER_TYPES.DISTRICT);

    const districtWithFlag = district.map((stock) => {
      const key = `${stock.districtId ?? "null"}::${stock.vaccineId}`;
      return {
        ...stock,
        hasExpiredLot: expiredSet.has(
          buildExpiredLotKey(
            OWNER_TYPES.DISTRICT,
            stock.districtId ?? null,
            stock.vaccineId,
          ),
        ),
        nearestExpiration: nearestExpirationMap.get(key) || null,
      };
    });

    res.json({
      districtId: resolvedDistrictId,
      district: districtWithFlag,
    });
  } catch (error) {
    next(error);
  }
};

const getStockHEALTHCENTER = async (req, res, next) => {
  if (
    !["SUPERADMIN", "NATIONAL", "REGIONAL", "DISTRICT", "AGENT"].includes(req.user.role)
  ) {
    return res.status(403).json({ message: "Accès refusé" });
  }

  try {
    let whereClause = {};

    // Pour SUPERADMIN, accepter healthCenterId, districtId ou regionId depuis query params
    const overrideHealthCenterId = req.user.role === "SUPERADMIN" ? req.query.healthCenterId : null;
    const overrideDistrictId = req.user.role === "SUPERADMIN" ? req.query.districtId : null;
    const overrideRegionId = req.user.role === "SUPERADMIN" ? req.query.regionId : null;

    if (req.user.role === "AGENT" || (req.user.role === "SUPERADMIN" && overrideHealthCenterId)) {
      // Permettre l'accès en lecture aux agents ADMIN et STAFF
      if (req.user.role === "AGENT" && req.user.agentLevel !== "ADMIN" && req.user.agentLevel !== "STAFF") {
        return res.status(403).json({ message: "Accès refusé" });
      }

      const healthCenterId = await resolveHealthCenterIdForUser(req.user, overrideHealthCenterId);
      if (!healthCenterId) {
        return res.json({ healthCenter: [] });
      }

      whereClause = { healthCenterId };
    } else if (req.user.role === "DISTRICT" || (req.user.role === "SUPERADMIN" && overrideDistrictId && !overrideHealthCenterId)) {
      const districtId = await resolveDistrictIdForUser(req.user, overrideDistrictId);
      if (!districtId) {
        return res.json({ healthCenter: [] });
      }
      whereClause = {
        healthCenter: {
          districtId,
        },
      };
    } else if (req.user.role === "REGIONAL" || (req.user.role === "SUPERADMIN" && overrideRegionId && !overrideDistrictId && !overrideHealthCenterId)) {
      const regionId = await resolveRegionIdForUser(req.user, overrideRegionId);
      if (!regionId) {
        return res.json({ healthCenter: [] });
      }
      whereClause = {
        healthCenter: {
          district: {
            commune: {
              regionId,
            },
          },
        },
      };
    }

    const healthCenter = await prisma.stockHEALTHCENTER.findMany({
      where: whereClause,
      include: { vaccine: true, healthCenter: true },
      orderBy: [
        { vaccine: { name: "asc" } },
        { healthCenter: { name: "asc" } },
      ],
    });

  const centerIds = healthCenter
      .map((stock) => stock.healthCenterId ?? null)
      .filter(Boolean);

    const expiredSet = await fetchExpiredLotsSet({
      ownerType: OWNER_TYPES.HEALTHCENTER,
      ownerIds: centerIds.length > 0 ? centerIds : undefined,
    });

    // Calculer les dates d'expiration les plus proches
    const nearestExpirationMap = await calculateNearestExpirations(healthCenter, OWNER_TYPES.HEALTHCENTER);

    const healthCenterWithFlag = healthCenter.map((stock) => {
      const key = `${stock.healthCenterId ?? "null"}::${stock.vaccineId}`;
      return {
        ...stock,
        hasExpiredLot: expiredSet.has(
          buildExpiredLotKey(
            OWNER_TYPES.HEALTHCENTER,
            stock.healthCenterId ?? null,
            stock.vaccineId,
          ),
        ),
        nearestExpiration: nearestExpirationMap.get(key) || null,
      };
    });

    res.json({ healthCenter: healthCenterWithFlag });
  } catch (error) {
    next(error);
  }
};

const createStockNATIONAL = async (req, res, next) => {

  if (req.user.role !== "NATIONAL" && req.user.role !== "SUPERADMIN") {
    return res.status(403).json({ message: "Accès refusé" });
  }  

  try {
    const newStockNATIONAL = await prisma.StockNATIONAL.create({
      data: {
        vaccineId: req.body.vaccineId,
      },
    });

    res.status(201).json(newStockNATIONAL);

  } catch (error) {
    next(error);
  }
};

const createStockREGIONAL = async (req, res, next) => {

  if (!["SUPERADMIN", "NATIONAL", "REGIONAL"].includes(req.user.role)) {
    return res.status(403).json({ message: "Accès refusé" });
  }  

  try {
    const { vaccineId } = req.body ?? {};
    let regionId = req.body.regionId;

    if (!vaccineId) {
      return res
        .status(400)
        .json({ message: "vaccineId est requis pour créer un stock régional" });
    }

    if (req.user.role === "REGIONAL") {
      regionId = await resolveRegionIdForUser(req.user);
      if (!regionId) {
        return res.status(400).json({
          message: "Votre compte n'est pas rattaché à une région",
        });
      }
    } else if (!regionId) {
      return res
        .status(400)
        .json({ message: "regionId est requis pour créer un stock régional" });
    }

    const newStockREGIONAL = await prisma.StockREGIONAL.create({
      data: {
        vaccineId,
        regionId,
      },
    });

    res.status(201).json(newStockREGIONAL);

  } catch (error) {
    next(error);
  }
};

const createStockDISTRICT = async (req, res, next) => {

  if (!["SUPERADMIN", "REGIONAL", "DISTRICT"].includes(req.user.role)) {
    return res.status(403).json({ message: "Accès refusé" });
  }  

  try {
    const { vaccineId, districtId } = req.body ?? {};

    if (!vaccineId || !districtId) {
      return res.status(400).json({ message: "vaccineId et districtId sont requis" });
    }

    if (req.user.role === "REGIONAL") {
      const regionId = await resolveRegionIdForUser(req.user);
      if (!regionId) {
        return res.status(400).json({ message: "Votre compte n'est pas rattaché à une région" });
      }

      try {
        await ensureDistrictBelongsToRegion(districtId, regionId);
      } catch (validationError) {
        if (validationError.status) {
          return res.status(validationError.status).json({ message: validationError.message });
        }
        throw validationError;
      }
    } else if (req.user.role === "DISTRICT") {
      const userDistrictId = await resolveDistrictIdForUser(req.user);
      if (!userDistrictId || userDistrictId !== districtId) {
        return res.status(403).json({ message: "Accès refusé pour ce district" });
      }
    }

    const newStockDISTRICT = await prisma.StockDISTRICT.create({
      data: {
        vaccineId,
        districtId,
      },
    });

    res.status(201).json(newStockDISTRICT);

  } catch (error) {
    next(error);
  }
};

const createStockHEALTHCENTER = async (req, res, next) => {

  if (!["SUPERADMIN", "DISTRICT", "AGENT"].includes(req.user.role)) {
    return res.status(403).json({ message: "Accès refusé" });
  }  

  try {
    const { vaccineId, healthCenterId } = req.body ?? {};

    if (!vaccineId) {
      return res.status(400).json({ message: "vaccineId est requis" });
    }

    let targetHealthCenterId = healthCenterId;

    if (req.user.role === "AGENT") {
      if (req.user.agentLevel !== "ADMIN") {
        return res.status(403).json({ message: "Accès refusé" });
      }

      targetHealthCenterId = await resolveHealthCenterIdForUser(req.user);
      if (!targetHealthCenterId) {
        return res.status(400).json({
          message: "Votre compte n'est pas rattaché à un centre de santé",
        });
      }
    } else if (req.user.role === "SUPERADMIN") {
      // SUPERADMIN peut créer un stock pour n'importe quel centre de santé
      if (!healthCenterId) {
        return res
          .status(400)
          .json({ message: "healthCenterId est requis pour créer un stock" });
      }

      const center = await prisma.healthCenter.findUnique({
        where: { id: healthCenterId },
        select: { id: true },
      });

      if (!center) {
        return res.status(404).json({ message: "Centre de santé introuvable" });
      }

      targetHealthCenterId = healthCenterId;
    } else {
      // DISTRICT
      if (!healthCenterId) {
        return res
          .status(400)
          .json({ message: "healthCenterId est requis pour créer un stock" });
      }

      const districtId = await resolveDistrictIdForUser(req.user);
      if (!districtId) {
        return res.status(400).json({
          message: "Votre compte n'est pas rattaché à un district",
        });
      }

      const center = await prisma.healthCenter.findUnique({
        where: { id: healthCenterId },
        select: { districtId: true },
      });

      if (!center) {
        return res.status(404).json({ message: "Centre de santé introuvable" });
      }

      if (center.districtId !== districtId) {
        return res
          .status(403)
          .json({ message: "Ce centre de santé n'appartient pas à votre district" });
      }

      targetHealthCenterId = healthCenterId;
    }

    const newStockHEALTHCENTER = await prisma.StockHEALTHCENTER.create({
      data: {
        vaccineId,
        healthCenterId: targetHealthCenterId,
      },
    });

    res.status(201).json(newStockHEALTHCENTER);

  } catch (error) {
    next(error);
  }
};

const addStockNATIONAL = async (req, res, next) => {
  if (req.user.role !== "NATIONAL" && req.user.role !== "SUPERADMIN") {
    return res.status(403).json({ message: "Accès refusé" });
  }

  try {
    const { vaccineId, quantity, expiration } = req.body ?? {};
    const qty = Number(quantity);

    if (!vaccineId || !Number.isFinite(qty) || qty <= 0) {
      return res
        .status(400)
        .json({ message: "vaccineId et quantity (> 0) sont requis" });
    }

    if (!expiration) {
      return res.status(400).json({
        message: "La date d'expiration est requise pour créer un nouveau lot",
      });
    }

    let updatedStock = null;
    let createdLot = null;

    await prisma.$transaction(async (tx) => {
      const stock = await tx.stockNATIONAL.findUnique({
        where: { vaccineId },
      });

      if (!stock) {
        throw Object.assign(new Error("Stock national introuvable"), {
          status: 404,
        });
      }

      await tx.stockNATIONAL.update({
        where: { vaccineId },
        data: { quantity: (stock.quantity ?? 0) + qty },
      });

      createdLot = await createLot(tx, {
        vaccineId,
        ownerType: OWNER_TYPES.NATIONAL,
        ownerId: null,
        quantity: qty,
        expiration,
      });

      updatedStock = await tx.stockNATIONAL.findUnique({
        where: { vaccineId },
        include: { vaccine: true },
      });
    });

    return res.json({ stock: updatedStock, lot: createdLot });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ message: error.message });
    }
    next(error);
  }
};

const addStockREGIONAL = async (req, res, next) => {
  if (req.user.role !== "NATIONAL" && req.user.role !== "SUPERADMIN") {
    return res.status(403).json({ message: "Accès refusé" });
  }

  try {
    const { vaccineId, regionId, quantity, expiration } = req.body ?? {};
    const qty = Number(quantity);

    if (!vaccineId || !regionId || !Number.isFinite(qty) || qty <= 0) {
      return res
        .status(400)
        .json({ message: "vaccineId, regionId et quantity (> 0) sont requis" });
    }

    let updatedNational = null;
    let pendingTransfer = null;
    let regionName = null;
    let vaccineName = null;

    await prisma.$transaction(async (tx) => {
      // Vérifier que le stock régional existe, sinon le créer
      let regionalStock = await tx.stockREGIONAL.findUnique({
        where: { vaccineId_regionId: { vaccineId, regionId } },
        include: { region: true, vaccine: true },
      });

      if (!regionalStock) {
        // Créer automatiquement le stock régional s'il n'existe pas
        regionalStock = await tx.stockREGIONAL.create({
          data: {
            vaccineId,
            regionId,
            quantity: 0,
          },
          include: { region: true, vaccine: true },
        });
      }

      regionName = regionalStock.region.name;
      vaccineName = regionalStock.vaccine.name;

      // NATIONAL et SUPERADMIN : prélever du stock national (comportement unifié)
      const nationalStock = await tx.stockNATIONAL.findUnique({
        where: { vaccineId },
      });

      if (!nationalStock || (nationalStock.quantity ?? 0) < qty) {
        throw Object.assign(
          new Error("Quantité insuffisante dans le stock national"),
          { status: 400 },
        );
      }

      // Consommer les lots du stock national
      const allocations = await consumeLots(tx, {
        vaccineId,
        ownerType: OWNER_TYPES.NATIONAL,
        ownerId: null,
        quantity: qty,
      });

      // Vérifier et supprimer les lots qui se sont vidés
      for (const allocation of allocations) {
        const lot = await tx.stockLot.findUnique({
          where: { id: allocation.lotId },
          select: { remainingQuantity: true, quantity: true },
        });
        if (lot && lot.remainingQuantity === 0 && lot.quantity === 0) {
          await deleteLotDirect(tx, allocation.lotId);
        }
      }

      // Soustraire du stock national
      await tx.stockNATIONAL.update({
        where: { vaccineId },
        data: { quantity: (nationalStock.quantity ?? 0) - qty },
      });

      // Récupérer la date d'expiration du premier lot source (ou date par défaut)
      const firstLot = allocations.length > 0 
        ? await tx.stockLot.findUnique({
            where: { id: allocations[0].lotId },
            select: { expiration: true },
          })
        : null;
      const lotExpiration = firstLot?.expiration || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

      // Créer le transfert en attente
      pendingTransfer = await tx.pendingStockTransfer.create({
        data: {
          vaccineId,
          fromType: OWNER_TYPES.NATIONAL,
          fromId: null,
          toType: OWNER_TYPES.REGIONAL,
          toId: regionId,
          quantity: qty,
          status: "PENDING",
          lots: {
            create: allocations.map((allocation) => ({
              lotId: allocation.lotId,
              quantity: allocation.quantity,
            })),
          },
        },
        include: {
          vaccine: true,
          lots: {
            include: {
              lot: true,
            },
          },
        },
      });

      // Créer un lot vide PENDING au destinataire avec la date d'expiration
      await createLot(tx, {
        vaccineId,
        ownerType: OWNER_TYPES.REGIONAL,
        ownerId: regionId,
        quantity: 0,
        expiration: lotExpiration,
        sourceLotId: allocations[0]?.lotId || null,
        status: LOT_STATUS.PENDING,
        pendingTransferId: pendingTransfer.id,
      });

      updatedNational = await tx.stockNATIONAL.findUnique({
        where: { vaccineId },
        include: { vaccine: true },
      });
    });

    // NATIONAL et SUPERADMIN : comportement unifié (transfert en attente)
    res.json({
      national: updatedNational,
      pendingTransfer,
      message: "Envoi créé avec succès. Le stock régional sera mis à jour après confirmation de réception.",
    });

    // Enregistrer l'événement
    logEventAsync({
      type: "STOCK_TRANSFER",
      subtype: "REGIONAL",
      action: "TRANSFER_SENT",
      user: {
        id: req.user.id,
        firstName: req.user.firstName,
        lastName: req.user.lastName,
        email: req.user.email,
        role: req.user.role,
      },
      entityType: "STOCK",
      entityId: pendingTransfer.id,
      entityName: vaccineName,
      details: {
        fromType: "NATIONAL",
        toType: "REGIONAL",
        toId: regionId,
        toName: regionName,
        quantity: qty,
        vaccineId,
        vaccineName,
      },
    });

    // Envoyer un email à tous les régionaux de cette région en arrière-plan (non bloquant)
    setImmediate(async () => {
      try {
        const { sendStockTransferNotificationEmail } = require("../services/emailService");
        const regionalUsers = await prisma.user.findMany({
          where: {
            role: "REGIONAL",
            regionId: regionId,
            isActive: true,
          },
          select: {
            id: true,
            email: true,
          },
        });

        if (regionalUsers.length > 0) {
          const emails = regionalUsers.map((u) => u.email).filter(Boolean);
          const userIds = regionalUsers.map((u) => u.id).filter(Boolean);
          if (emails.length > 0) {
            await sendStockTransferNotificationEmail({
              emails,
              userIds,
              vaccineName,
              quantity: qty,
              regionName,
            });
          }
        }
      } catch (emailError) {
        console.error("Erreur envoi email notification transfert:", emailError);
        // Ne pas bloquer la réponse si l'email échoue
      }
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ message: error.message });
    }
    next(error);
  }
};

const addStockDISTRICT = async (req, res, next) => {
  if (!["SUPERADMIN", "REGIONAL", "NATIONAL"].includes(req.user.role)) {
    return res.status(403).json({ message: "Accès refusé" });
  }

  try {
    const { vaccineId, districtId, quantity, expiration } = req.body ?? {};
    const qty = Number(quantity);

    if (!vaccineId || !districtId || !Number.isFinite(qty) || qty <= 0) {
      return res.status(400).json({
        message: "vaccineId, districtId et quantity (> 0) sont requis",
      });
    }

    // Récupérer le district pour obtenir le regionId
    const district = await prisma.district.findUnique({
      where: { id: districtId },
      include: { commune: { select: { regionId: true } } },
    });

    if (!district) {
      return res.status(404).json({ message: "District introuvable" });
    }

    let regionIdPayload = req.body.regionId;

    if (req.user.role === "REGIONAL") {
      regionIdPayload = await resolveRegionIdForUser(req.user);
      if (!regionIdPayload) {
        return res.status(400).json({
          message: "Votre compte n'est pas rattaché à une région",
        });
      }
      try {
        await ensureDistrictBelongsToRegion(districtId, regionIdPayload);
      } catch (validationError) {
        if (validationError.status) {
          return res.status(validationError.status).json({ message: validationError.message });
        }
        throw validationError;
      }
    } else if (req.user.role === "SUPERADMIN") {
      // SUPERADMIN : utiliser le regionId du district
      regionIdPayload = district.commune?.regionId;
      if (!regionIdPayload) {
        return res.status(400).json({
          message: "Impossible de déterminer la région du district",
        });
      }
    } else if (!regionIdPayload) {
      return res.status(400).json({
        message: "regionId est requis pour ce transfert",
      });
    }

    if (req.user.role === "NATIONAL") {
      try {
        await ensureDistrictBelongsToRegion(districtId, regionIdPayload);
      } catch (validationError) {
        if (validationError.status) {
          return res
            .status(validationError.status)
            .json({ message: validationError.message });
        }
        throw validationError;
      }
    }

    let updatedRegional = null;
    let pendingTransfer = null;
    let districtName = null;
    let vaccineName = null;

    await prisma.$transaction(async (tx) => {
      // Vérifier que le stock district existe, sinon le créer
      let districtStock = await tx.stockDISTRICT.findUnique({
        where: { vaccineId_districtId: { vaccineId, districtId } },
        include: { district: true, vaccine: true },
      });

      if (!districtStock) {
        // Créer automatiquement le stock district s'il n'existe pas
        districtStock = await tx.stockDISTRICT.create({
          data: {
            vaccineId,
            districtId,
            quantity: 0,
          },
          include: { district: true, vaccine: true },
        });
      }

      districtName = districtStock.district.name;
      vaccineName = districtStock.vaccine.name;

      // REGIONAL/NATIONAL/SUPERADMIN : prélever du stock régional (comportement unifié)
        const regionalStock = await tx.stockREGIONAL.findUnique({
          where: { vaccineId_regionId: { vaccineId, regionId: regionIdPayload } },
        });

        if (!regionalStock || (regionalStock.quantity ?? 0) < qty) {
          throw Object.assign(
            new Error("Quantité insuffisante dans le stock régional"),
            { status: 400 },
          );
        }

        // Consommer les lots du stock régional
        const allocations = await consumeLots(tx, {
          vaccineId,
          ownerType: OWNER_TYPES.REGIONAL,
          ownerId: regionIdPayload,
          quantity: qty,
        });

        // Vérifier et supprimer les lots qui se sont vidés
        for (const allocation of allocations) {
          const lot = await tx.stockLot.findUnique({
            where: { id: allocation.lotId },
            select: { remainingQuantity: true, quantity: true },
          });
          if (lot && lot.remainingQuantity === 0 && lot.quantity === 0) {
            await deleteLotDirect(tx, allocation.lotId);
          }
        }

        // Soustraire du stock régional
        await tx.stockREGIONAL.update({
          where: { vaccineId_regionId: { vaccineId, regionId: regionIdPayload } },
          data: { quantity: (regionalStock.quantity ?? 0) - qty },
        });

        // Récupérer la date d'expiration du premier lot source (ou date par défaut)
        const firstLot = allocations.length > 0 
          ? await tx.stockLot.findUnique({
              where: { id: allocations[0].lotId },
              select: { expiration: true },
            })
          : null;
        const lotExpiration = firstLot?.expiration || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

        // Créer le transfert en attente
        pendingTransfer = await tx.pendingStockTransfer.create({
          data: {
            vaccineId,
            fromType: OWNER_TYPES.REGIONAL,
            fromId: regionIdPayload,
            toType: OWNER_TYPES.DISTRICT,
            toId: districtId,
            quantity: qty,
            status: "PENDING",
            lots: {
              create: allocations.map((allocation) => ({
                lotId: allocation.lotId,
                quantity: allocation.quantity,
              })),
            },
          },
          include: {
            vaccine: true,
            lots: {
              include: {
                lot: true,
              },
            },
          },
        });

        // Créer un lot vide PENDING au destinataire avec la date d'expiration
        await createLot(tx, {
          vaccineId,
          ownerType: OWNER_TYPES.DISTRICT,
          ownerId: districtId,
          quantity: 0,
          expiration: lotExpiration,
          sourceLotId: allocations[0]?.lotId || null,
          status: LOT_STATUS.PENDING,
          pendingTransferId: pendingTransfer.id,
        });

        updatedRegional = await tx.stockREGIONAL.findUnique({
          where: { vaccineId_regionId: { vaccineId, regionId: regionIdPayload } },
          include: { vaccine: true, region: true },
        });
    });

    // REGIONAL/NATIONAL/SUPERADMIN : comportement unifié (transfert en attente)
    res.json({
      regional: updatedRegional,
      pendingTransfer,
      message: "Envoi créé avec succès. Le stock district sera mis à jour après confirmation de réception.",
    });

    // Enregistrer l'événement
    logEventAsync({
      type: "STOCK_TRANSFER",
      subtype: "DISTRICT",
      action: "TRANSFER_SENT",
      user: {
        id: req.user.id,
        firstName: req.user.firstName,
        lastName: req.user.lastName,
        email: req.user.email,
        role: req.user.role,
      },
      entityType: "STOCK",
      entityId: pendingTransfer.id,
      entityName: vaccineName,
      details: {
        fromType: "REGIONAL",
        fromId: regionIdPayload,
        toType: "DISTRICT",
        toId: districtId,
        toName: districtName,
        quantity: qty,
        vaccineId,
        vaccineName,
      },
    });

    // Envoyer un email à tous les utilisateurs du district en arrière-plan (non bloquant)
    setImmediate(async () => {
      try {
        const { sendStockTransferNotificationEmail } = require("../services/emailService");
        const districtUsers = await prisma.user.findMany({
          where: {
            role: "DISTRICT",
            districtId: districtId,
            isActive: true,
          },
          select: {
            id: true,
            email: true,
          },
        });

        if (districtUsers.length > 0) {
          const emails = districtUsers.map((u) => u.email).filter(Boolean);
          const userIds = districtUsers.map((u) => u.id).filter(Boolean);
          if (emails.length > 0) {
            await sendStockTransferNotificationEmail({
              emails,
              userIds,
              vaccineName,
              quantity: qty,
              regionName: districtName,
            });
          }
        }
      } catch (emailError) {
        console.error("Erreur envoi email notification transfert:", emailError);
        // Ne pas bloquer la réponse si l'email échoue
      }
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ message: error.message });
    }
    next(error);
  }
};

const addStockHEALTHCENTER = async (req, res, next) => {
  if (!["SUPERADMIN", "DISTRICT"].includes(req.user.role)) {
    return res.status(403).json({ message: "Accès refusé" });
  }

  try {
    const { vaccineId, healthCenterId, quantity, expiration } = req.body ?? {};
    const qty = Number(quantity);

    if (
      !vaccineId ||
      !healthCenterId ||
      !Number.isFinite(qty) ||
      qty <= 0
    ) {
      return res.status(400).json({
        message:
          "vaccineId, healthCenterId et quantity (> 0) sont requis",
      });
    }

    const healthCenter = await prisma.healthCenter.findUnique({
      where: { id: healthCenterId },
      select: { districtId: true },
    });

    if (!healthCenter) {
      return res.status(404).json({ message: "Centre de santé introuvable" });
    }

    // Déterminer le districtId selon le rôle
    let districtId = null;
    
    if (req.user.role === "DISTRICT") {
      districtId = await resolveDistrictIdForUser(req.user);
      if (!districtId) {
        return res.status(400).json({
          message: "Votre compte n'est pas rattaché à un district",
        });
      }

      if (healthCenter.districtId !== districtId) {
        return res
          .status(403)
          .json({ message: "Ce centre de santé n'appartient pas à votre district" });
      }
    } else if (req.user.role === "SUPERADMIN") {
      // SUPERADMIN peut ajouter du stock à n'importe quel centre de santé
      // Utiliser le districtId du centre de santé
      districtId = healthCenter.districtId;
    }

    if (!districtId) {
      return res.status(400).json({
        message: "Impossible de déterminer le district",
      });
    }

    let updatedDistrict = null;
    let pendingTransfer = null;
    let healthCenterName = null;
    let vaccineName = null;

    await prisma.$transaction(async (tx) => {
      // Vérifier que le stock centre de santé existe, sinon le créer
      let healthCenterStock = await tx.stockHEALTHCENTER.findUnique({
        where: { vaccineId_healthCenterId: { vaccineId, healthCenterId } },
        include: { healthCenter: true, vaccine: true },
      });

      if (!healthCenterStock) {
        // Créer automatiquement le stock centre de santé s'il n'existe pas
        healthCenterStock = await tx.stockHEALTHCENTER.create({
          data: {
            vaccineId,
            healthCenterId,
            quantity: 0,
          },
          include: { healthCenter: true, vaccine: true },
        });
      }

      healthCenterName = healthCenterStock.healthCenter.name;
      vaccineName = healthCenterStock.vaccine.name;

      // DISTRICT/SUPERADMIN : prélever du stock district (comportement unifié)
        const districtStock = await tx.stockDISTRICT.findUnique({
          where: { vaccineId_districtId: { vaccineId, districtId } },
        });

        if (!districtStock || (districtStock.quantity ?? 0) < qty) {
          throw Object.assign(
            new Error("Quantité insuffisante dans le stock district"),
            { status: 400 },
          );
        }

        // Consommer les lots du stock district
        const allocations = await consumeLots(tx, {
          vaccineId,
          ownerType: OWNER_TYPES.DISTRICT,
          ownerId: districtId,
          quantity: qty,
        });

        // Vérifier et supprimer les lots qui se sont vidés
        for (const allocation of allocations) {
          const lot = await tx.stockLot.findUnique({
            where: { id: allocation.lotId },
            select: { remainingQuantity: true, quantity: true },
          });
          if (lot && lot.remainingQuantity === 0 && lot.quantity === 0) {
            await deleteLotDirect(tx, allocation.lotId);
          }
        }

        // Soustraire du stock district
        await tx.stockDISTRICT.update({
          where: { vaccineId_districtId: { vaccineId, districtId } },
          data: { quantity: (districtStock.quantity ?? 0) - qty },
        });

        // Récupérer la date d'expiration du premier lot source (ou date par défaut)
        const firstLot = allocations.length > 0 
          ? await tx.stockLot.findUnique({
              where: { id: allocations[0].lotId },
              select: { expiration: true },
            })
          : null;
        const lotExpiration = firstLot?.expiration || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

        // Créer le transfert en attente
        pendingTransfer = await tx.pendingStockTransfer.create({
          data: {
            vaccineId,
            fromType: OWNER_TYPES.DISTRICT,
            fromId: districtId,
            toType: OWNER_TYPES.HEALTHCENTER,
            toId: healthCenterId,
            quantity: qty,
            status: "PENDING",
            lots: {
              create: allocations.map((allocation) => ({
                lotId: allocation.lotId,
                quantity: allocation.quantity,
              })),
            },
          },
          include: {
            vaccine: true,
            lots: {
              include: {
                lot: true,
              },
            },
          },
        });

        // Créer un lot vide PENDING au destinataire avec la date d'expiration
        await createLot(tx, {
          vaccineId,
          ownerType: OWNER_TYPES.HEALTHCENTER,
          ownerId: healthCenterId,
          quantity: 0,
          expiration: lotExpiration,
          sourceLotId: allocations[0]?.lotId || null,
          status: LOT_STATUS.PENDING,
          pendingTransferId: pendingTransfer.id,
        });

        updatedDistrict = await tx.stockDISTRICT.findUnique({
          where: { vaccineId_districtId: { vaccineId, districtId } },
          include: { vaccine: true, district: { include: { commune: true } } },
        });
    });

    // DISTRICT/SUPERADMIN : comportement unifié (transfert en attente)
    res.json({
      district: updatedDistrict,
      pendingTransfer,
      message: "Envoi créé avec succès. Le stock du centre de santé sera mis à jour après confirmation de réception.",
    });

    // Enregistrer l'événement
    logEventAsync({
      type: "STOCK_TRANSFER",
      subtype: "HEALTHCENTER",
      action: "TRANSFER_SENT",
      user: {
        id: req.user.id,
        firstName: req.user.firstName,
        lastName: req.user.lastName,
        email: req.user.email,
        role: req.user.role,
      },
      entityType: "STOCK",
      entityId: pendingTransfer.id,
      entityName: vaccineName,
      details: {
        fromType: "DISTRICT",
        fromId: districtId,
        toType: "HEALTHCENTER",
        toId: healthCenterId,
        toName: healthCenterName,
        quantity: qty,
        vaccineId,
        vaccineName,
      },
    });

    // Envoyer un email à tous les agents admin du centre de santé en arrière-plan (non bloquant)
    setImmediate(async () => {
      try {
        const { sendStockTransferNotificationEmail } = require("../services/emailService");
        const healthCenterAdminAgents = await prisma.user.findMany({
          where: {
            role: "AGENT",
            agentLevel: "ADMIN",
            healthCenterId: healthCenterId,
            isActive: true,
          },
          select: {
            id: true,
            email: true,
          },
        });

        if (healthCenterAdminAgents.length > 0) {
          const emails = healthCenterAdminAgents.map((u) => u.email).filter(Boolean);
          const userIds = healthCenterAdminAgents.map((u) => u.id).filter(Boolean);
          if (emails.length > 0) {
            await sendStockTransferNotificationEmail({
              emails,
              userIds,
              vaccineName,
              quantity: qty,
              regionName: healthCenterName,
            });
          }
        }
      } catch (emailError) {
        console.error("Erreur envoi email notification transfert:", emailError);
        // Ne pas bloquer la réponse si l'email échoue
      }
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ message: error.message });
    }
    next(error);
  }
};


const updateStockNATIONAL = async (req, res, next) => {
  if (req.user.role !== "NATIONAL" && req.user.role !== "SUPERADMIN") {
    return res.status(403).json({ message: "Accès refusé" });
  }

  try {
    const { vaccineId, quantity, expiration } = req.body ?? {};
    const qty = Number(quantity);

    if (!vaccineId || !Number.isFinite(qty) || qty < 0) {
      return res
        .status(400)
        .json({ message: "vaccineId et quantity (>= 0) sont requis" });
    }

    let updatedStock = null;
    let previousQuantity = 0;
    let delta = 0;

    await prisma.$transaction(async (tx) => {
      const stock = await tx.stockNATIONAL.findUnique({ where: { vaccineId } });
      if (!stock) {
        throw Object.assign(new Error("Stock national introuvable"), {
          status: 404,
        });
      }

      previousQuantity = stock.quantity ?? 0;
      delta = qty - previousQuantity;

      await tx.stockNATIONAL.update({
        where: { vaccineId },
        data: { quantity: qty },
      });

      if (delta > 0) {
        if (!expiration) {
          throw Object.assign(
            new Error(
              "La date d'expiration est requise pour l'ajout de nouveaux lots",
            ),
            { status: 400 },
          );
        }

        await createLot(tx, {
          vaccineId,
          ownerType: OWNER_TYPES.NATIONAL,
          ownerId: null,
          quantity: delta,
          expiration,
        });
      }

      await updateNearestExpiration(tx, {
        vaccineId,
        ownerType: OWNER_TYPES.NATIONAL,
        ownerId: null,
      });

      updatedStock = await tx.stockNATIONAL.findUnique({
        where: { vaccineId },
        include: { vaccine: true },
      });
    });

    res.json(updatedStock);
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ message: error.message });
    }
    next(error);
  }
};

const updateStockREGIONAL = async (req, res, next) => {
  if (req.user.role !== "SUPERADMIN") {
    return res.status(403).json({ message: "Accès refusé" });
  }

  try {
    const { vaccineId, quantity, expiration, regionId } = req.body ?? {};
    const qty = Number(quantity);

    if (!regionId) {
      return res.status(400).json({
        message: "regionId est requis",
      });
    }

    if (!vaccineId || !regionId || !Number.isFinite(qty) || qty < 0) {
      return res
        .status(400)
        .json({ message: "vaccineId, regionId et quantity (>= 0) sont requis" });
    }

    let updated = null;
    let previousQuantity = 0;
    let delta = 0;

    await prisma.$transaction(async (tx) => {
      const current = await tx.stockREGIONAL.findUnique({
        where: { vaccineId_regionId: { vaccineId, regionId } },
      });

      if (!current) {
        throw Object.assign(new Error("Stock régional introuvable"), {
          status: 404,
        });
      }

      previousQuantity = current.quantity ?? 0;
      delta = qty - previousQuantity;

      await tx.stockREGIONAL.update({
        where: { vaccineId_regionId: { vaccineId, regionId } },
        data: { quantity: qty },
      });

      if (delta > 0) {
        if (!expiration) {
          throw Object.assign(
            new Error(
              "La date d'expiration est requise pour l'ajout de nouveaux lots",
            ),
            { status: 400 },
          );
        }

        await createLot(tx, {
          vaccineId,
          ownerType: OWNER_TYPES.REGIONAL,
          ownerId: regionId,
          quantity: delta,
          expiration,
        });
      }

      await updateNearestExpiration(tx, {
        vaccineId,
        ownerType: OWNER_TYPES.REGIONAL,
        ownerId: regionId,
      });

      updated = await tx.stockREGIONAL.findUnique({
        where: { vaccineId_regionId: { vaccineId, regionId } },
        include: { vaccine: true, region: true },
      });
    });

    // Enregistrer l'événement d'ajustement
    logEventAsync({
      type: "STOCK",
      subtype: "REGIONAL",
      action: "UPDATE",
      user: {
        id: req.user.id,
        firstName: req.user.firstName,
        lastName: req.user.lastName,
        email: req.user.email,
        role: req.user.role,
      },
      entityType: "STOCK",
      entityId: updated?.id,
      entityName: updated?.vaccine?.name || "Vaccin",
      details: {
        before: { quantity: previousQuantity },
        after: { quantity: qty },
        delta: delta,
        vaccineId,
        regionId,
      },
    });

    res.json(updated);
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ message: error.message });
    }
    next(error);
  }
};

const updateStockDISTRICT = async (req, res, next) => {
  if (req.user.role !== "SUPERADMIN") {
    return res.status(403).json({ message: "Accès refusé" });
  }

  try {
    const { vaccineId, districtId, quantity, expiration } = req.body ?? {};
    const qty = Number(quantity);

    if (!vaccineId || !districtId || !Number.isFinite(qty) || qty < 0) {
      return res.status(400).json({
        message: "vaccineId, districtId et quantity (>= 0) sont requis",
      });
    }

    const stock = await prisma.stockDISTRICT.findUnique({
      where: { vaccineId_districtId: { vaccineId, districtId } },
    });

    let updated = null;

    await prisma.$transaction(async (tx) => {
      const current = await tx.stockDISTRICT.findUnique({
        where: { vaccineId_districtId: { vaccineId, districtId } },
      });

      if (!current) {
        throw Object.assign(new Error("Stock district introuvable"), {
          status: 404,
        });
      }

      const previousQuantity = current.quantity ?? 0;
      const delta = qty - previousQuantity;

      await tx.stockDISTRICT.update({
        where: { vaccineId_districtId: { vaccineId, districtId } },
        data: { quantity: qty },
      });

      if (delta > 0) {
        if (!expiration) {
          throw Object.assign(
            new Error(
              "La date d'expiration est requise pour l'ajout de nouveaux lots",
            ),
            { status: 400 },
          );
        }

        await createLot(tx, {
          vaccineId,
          ownerType: OWNER_TYPES.DISTRICT,
          ownerId: districtId,
          quantity: delta,
          expiration,
        });
      }

      await updateNearestExpiration(tx, {
        vaccineId,
        ownerType: OWNER_TYPES.DISTRICT,
        ownerId: districtId,
      });

      updated = await tx.stockDISTRICT.findUnique({
        where: { vaccineId_districtId: { vaccineId, districtId } },
        include: { vaccine: true, district: { include: { commune: true } } },
      });
    });

    res.json(updated);
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ message: error.message });
    }
    next(error);
  }
};

const updateStockHEALTHCENTER = async (req, res, next) => {
  if (req.user.role !== "SUPERADMIN") {
    return res.status(403).json({ message: "Accès refusé" });
  }

  try {
    const { vaccineId, healthCenterId, quantity, expiration } = req.body ?? {};
    const qty = Number(quantity);

    if (!vaccineId || !healthCenterId || !Number.isFinite(qty) || qty < 0) {
      return res.status(400).json({
        message: "vaccineId, healthCenterId et quantity (>= 0) sont requis",
      });
    }

    const stock = await prisma.stockHEALTHCENTER.findUnique({
      where: { vaccineId_healthCenterId: { vaccineId, healthCenterId } },
    });

    let updated = null;

    await prisma.$transaction(async (tx) => {
      const current = await tx.stockHEALTHCENTER.findUnique({
        where: { vaccineId_healthCenterId: { vaccineId, healthCenterId } },
      });

      if (!current) {
        throw Object.assign(
          new Error("Stock centre de santé introuvable"),
          { status: 404 },
        );
      }

      const previousQuantity = current.quantity ?? 0;
      const delta = qty - previousQuantity;

      await tx.stockHEALTHCENTER.update({
        where: { vaccineId_healthCenterId: { vaccineId, healthCenterId } },
        data: { quantity: qty },
      });

      if (delta > 0) {
        if (!expiration) {
          throw Object.assign(
            new Error(
              "La date d'expiration est requise pour l'ajout de nouveaux lots",
            ),
            { status: 400 },
          );
        }

        await createLot(tx, {
          vaccineId,
          ownerType: OWNER_TYPES.HEALTHCENTER,
          ownerId: healthCenterId,
          quantity: delta,
          expiration,
        });
      }

      await updateNearestExpiration(tx, {
        vaccineId,
        ownerType: OWNER_TYPES.HEALTHCENTER,
        ownerId: healthCenterId,
      });

      updated = await tx.stockHEALTHCENTER.findUnique({
        where: { vaccineId_healthCenterId: { vaccineId, healthCenterId } },
        include: { vaccine: true, healthCenter: true },
      });
    });

    res.json(updated);
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ message: error.message });
    }
    next(error);
  }
};

const reduceLotNATIONAL = async (req, res, next) => {
  if (req.user.role !== "NATIONAL" && req.user.role !== "SUPERADMIN") {
    return res.status(403).json({ message: "Accès refusé" });
  }

  const { id: lotId } = req.params;
  const { quantity } = req.body ?? {};
  const qty = Number(quantity);

  if (!lotId) {
    return res.status(400).json({ message: "lotId est requis" });
  }

  if (!Number.isFinite(qty) || qty <= 0) {
    return res.status(400).json({ message: "quantity doit être un nombre positif" });
  }

  try {
    let updatedLot = null;

    await prisma.$transaction(async (tx) => {
      const lot = await tx.stockLot.findUnique({
        where: { id: lotId },
        include: {
          vaccine: { select: { name: true } },
        },
      });

      if (!lot) {
        throw Object.assign(new Error("Lot introuvable"), { status: 404 });
      }

      // Vérifier que le lot appartient au niveau NATIONAL
      if (lot.ownerType !== OWNER_TYPES.NATIONAL || lot.ownerId !== null) {
        throw Object.assign(new Error("Ce lot n'appartient pas au stock national"), {
          status: 403,
        });
      }

      // Vérifier que la quantité à réduire ne dépasse pas la quantité restante
      if (qty > lot.remainingQuantity) {
        throw Object.assign(
          new Error(
            `La quantité à réduire (${qty}) dépasse la quantité restante du lot (${lot.remainingQuantity})`
          ),
          { status: 400 }
        );
      }

      // Réduire la quantité restante du lot
      const newRemainingQuantity = lot.remainingQuantity - qty;

      updatedLot = await tx.stockLot.update({
        where: { id: lotId },
        data: {
          remainingQuantity: newRemainingQuantity,
        },
        include: {
          vaccine: { select: { name: true } },
        },
      });

      // Mettre à jour la quantité du stock NATIONAL (somme des lots)
      const allLots = await tx.stockLot.findMany({
        where: {
          vaccineId: lot.vaccineId,
          ownerType: OWNER_TYPES.NATIONAL,
          ownerId: null,
        },
        select: { remainingQuantity: true },
      });

      const totalQuantity = allLots.reduce(
        (sum, l) => sum + (l.remainingQuantity ?? 0),
        0
      );

      await tx.stockNATIONAL.update({
        where: { vaccineId: lot.vaccineId },
        data: { quantity: totalQuantity },
      });

      // Mettre à jour la date d'expiration la plus proche
      await updateNearestExpiration(tx, {
        vaccineId: lot.vaccineId,
        ownerType: OWNER_TYPES.NATIONAL,
        ownerId: null,
      });
    });

    res.json(updatedLot);
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ message: error.message });
    }
    next(error);
  }
};

const deleteLot = async (req, res, next) => {
  if (!["SUPERADMIN", "NATIONAL", "REGIONAL", "DISTRICT", "AGENT"].includes(req.user.role)) {
    return res.status(403).json({ message: "Accès refusé" });
  }

  // Pour les agents, seuls les ADMIN peuvent supprimer
  if (req.user.role === "AGENT" && req.user.agentLevel !== "ADMIN") {
    return res.status(403).json({ message: "Accès refusé" });
  }

  const { id } = req.params;

  if (!id) {
    return res.status(400).json({ message: "lotId est requis" });
  }

  try {
    let deletedId = null;

    await prisma.$transaction(async (tx) => {
      const existing = await tx.stockLot.findUnique({ where: { id } });
      if (!existing) {
        throw Object.assign(new Error("Lot introuvable"), { status: 404 });
      }

      // Vérifier que l'utilisateur a accès à ce lot
      const normalizedOwnerId = normalizeOwnerIdValue(
        existing.ownerType,
        existing.ownerId,
      );

      if (req.user.role === "REGIONAL") {
        const regionId = await resolveRegionIdForUser(req.user);
        if (
          existing.ownerType !== OWNER_TYPES.REGIONAL ||
          existing.ownerId !== regionId
        ) {
          throw Object.assign(new Error("Accès refusé"), { status: 403 });
        }
        
        // Vérifier si le lot est expiré
        if (existing.status !== LOT_STATUS.EXPIRED) {
          const expirationDate = new Date(existing.expiration);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          if (expirationDate >= today) {
            throw Object.assign(
              new Error("Vous ne pouvez supprimer que les lots expirés"),
              { status: 403 }
            );
          }
        }
      } else if (req.user.role === "DISTRICT") {
        const districtId = await resolveDistrictIdForUser(req.user);
        if (
          existing.ownerType !== OWNER_TYPES.DISTRICT ||
          existing.ownerId !== districtId
        ) {
          throw Object.assign(new Error("Accès refusé"), { status: 403 });
        }
        
        // Vérifier si le lot est expiré
        if (existing.status !== LOT_STATUS.EXPIRED) {
          const expirationDate = new Date(existing.expiration);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          if (expirationDate >= today) {
            throw Object.assign(
              new Error("Vous ne pouvez supprimer que les lots expirés"),
              { status: 403 }
            );
          }
        }
      } else if (req.user.role === "AGENT") {
        const healthCenterId = await resolveHealthCenterIdForUser(req.user);
        if (
          existing.ownerType !== OWNER_TYPES.HEALTHCENTER ||
          existing.ownerId !== healthCenterId
        ) {
          throw Object.assign(new Error("Accès refusé"), { status: 403 });
        }
        
        // Vérifier si le lot est expiré
        if (existing.status !== LOT_STATUS.EXPIRED) {
          const expirationDate = new Date(existing.expiration);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          if (expirationDate >= today) {
            throw Object.assign(
              new Error("Vous ne pouvez supprimer que les lots expirés"),
              { status: 403 }
            );
          }
        }
      } else if (req.user.role === "NATIONAL") {
        if (existing.ownerType !== OWNER_TYPES.NATIONAL) {
          throw Object.assign(new Error("Accès refusé"), { status: 403 });
        }
      }

      // Pour SUPERADMIN uniquement et lot HEALTHCENTER : annuler les rendez-vous avant suppression
      let appointmentsToNotify = [];
      if (req.user.role === "SUPERADMIN" && existing.ownerType === OWNER_TYPES.HEALTHCENTER) {
        // Récupérer toutes les réservations liées à ce lot
        const reservations = await tx.stockReservation.findMany({
          where: { stockLotId: id },
          select: { scheduleId: true },
        });

        const scheduleIds = reservations.map((res) => res.scheduleId);

        if (scheduleIds.length > 0) {
          // Annuler les rendez-vous
          appointmentsToNotify = await cancelAppointmentsForSchedules(tx, scheduleIds);
        }
      }

      // Supprimer le lot directement (sans cascade)
      deletedId = await deleteLotDirect(tx, id);
    });

    // Envoyer les notifications aux parents après la suppression
    if (appointmentsToNotify && appointmentsToNotify.length > 0) {
      setImmediate(async () => {
        try {
          await Promise.all(
            appointmentsToNotify.map((appointment) =>
              notifyAppointmentCancelled({
                childId: appointment.childId,
                vaccineName: appointment.vaccineName,
                scheduledDate: appointment.scheduledDate,
              }),
            ),
          );
        } catch (notifError) {
          console.error("Erreur création notifications d'annulation:", notifError);
        }
      });
    }

    res.json({ deletedId });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ message: error.message });
    }
    next(error);
  }
};

const reduceStockNATIONAL = async (req, res, next) => {
  if (req.user.role !== "NATIONAL" && req.user.role !== "SUPERADMIN") {
    return res.status(403).json({ message: "Accès refusé" });
  }

  try {
    const { vaccineId, quantity } = req.body;
    const qty = Number(quantity);

    if (!vaccineId || !Number.isFinite(qty) || qty <= 0) {
      return res
        .status(400)
        .json({ message: "vaccineId et quantity (> 0) sont requis" });
    }

    const stock = await prisma.stockNATIONAL.findUnique({ where: { vaccineId } });
    if (!stock || (stock.quantity ?? 0) < qty) {
      return res.status(400).json({ message: "Quantité insuffisante" });
    }

    const updated = await prisma.stockNATIONAL.update({
      where: { vaccineId },
      data: { quantity: (stock.quantity ?? 0) - qty },
    });

    res.json(updated);
  } catch (error) {
    next(error);
  }
};

const reduceStockREGIONAL = async (req, res, next) => {
  if (!["SUPERADMIN", "NATIONAL", "REGIONAL"].includes(req.user.role)) {
    return res.status(403).json({ message: "Accès refusé" });
  }

  try {
    const { vaccineId, quantity } = req.body;
    const qty = Number(quantity);

    let regionId = req.body.regionId;

    if (req.user.role === "REGIONAL") {
      regionId = await resolveRegionIdForUser(req.user);
      if (!regionId) {
        return res.status(400).json({
          message: "Votre compte n'est pas rattaché à une région",
        });
      }
    }

    if (!vaccineId || !regionId || !Number.isFinite(qty) || qty <= 0) {
      return res.status(400).json({
        message: "vaccineId, regionId et quantity (> 0) sont requis",
      });
    }

    const stock = await prisma.stockREGIONAL.findUnique({
      where: { vaccineId_regionId: { vaccineId, regionId } },
    });

    if (!stock || (stock.quantity ?? 0) < qty) {
      return res.status(400).json({ message: "Quantité insuffisante" });
    }

    const updated = await prisma.stockREGIONAL.update({
      where: { vaccineId_regionId: { vaccineId, regionId } },
      data: { quantity: (stock.quantity ?? 0) - qty },
    });

    res.json(updated);
  } catch (error) {
    next(error);
  }
};

const reduceStockDISTRICT = async (req, res, next) => {
  if (!["SUPERADMIN", "REGIONAL", "DISTRICT"].includes(req.user.role)) {
    return res.status(403).json({ message: "Accès refusé" });
  }

  try {
    const { vaccineId, districtId, quantity } = req.body;
    const qty = Number(quantity);

    if (!vaccineId || !districtId || !Number.isFinite(qty) || qty <= 0) {
      return res.status(400).json({
        message: "vaccineId, districtId et quantity (> 0) sont requis",
      });
    }

    if (req.user.role === "REGIONAL") {
      const regionId = await resolveRegionIdForUser(req.user);
      if (!regionId) {
        return res.status(400).json({
          message: "Votre compte n'est pas rattaché à une région",
        });
      }
      try {
        await ensureDistrictBelongsToRegion(districtId, regionId);
      } catch (validationError) {
        if (validationError.status) {
          return res.status(validationError.status).json({ message: validationError.message });
        }
        throw validationError;
      }
    } else {
      const userDistrictId = await resolveDistrictIdForUser(req.user);
      if (!userDistrictId || userDistrictId !== districtId) {
        return res.status(403).json({ message: "Accès refusé pour ce district" });
      }
    }

    const stock = await prisma.stockDISTRICT.findUnique({
      where: { vaccineId_districtId: { vaccineId, districtId } },
    });

    if (!stock || (stock.quantity ?? 0) < qty) {
      return res.status(400).json({ message: "Quantité insuffisante" });
    }

    const updated = await prisma.stockDISTRICT.update({
      where: { vaccineId_districtId: { vaccineId, districtId } },
      data: { quantity: (stock.quantity ?? 0) - qty },
    });

    res.json(updated);
  } catch (error) {
    next(error);
  }
};

const reduceLotREGIONAL = async (req, res, next) => {
  if (!["SUPERADMIN", "NATIONAL", "REGIONAL"].includes(req.user.role)) {
    return res.status(403).json({ message: "Accès refusé" });
  }

  const { id: lotId } = req.params;
  const { quantity } = req.body ?? {};
  const qty = Number(quantity);

  if (!lotId) {
    return res.status(400).json({ message: "lotId est requis" });
  }

  if (!Number.isFinite(qty) || qty <= 0) {
    return res.status(400).json({ message: "quantity doit être un nombre positif" });
  }

  try {
    let updatedLot = null;
    let regionId = null;

    await prisma.$transaction(async (tx) => {
      const lot = await tx.stockLot.findUnique({
        where: { id: lotId },
        include: {
          vaccine: { select: { name: true } },
        },
      });

      if (!lot) {
        throw Object.assign(new Error("Lot introuvable"), { status: 404 });
      }

      // Vérifier que le lot appartient à une région
      if (lot.ownerType !== OWNER_TYPES.REGIONAL || !lot.ownerId) {
        throw Object.assign(new Error("Ce lot n'appartient pas à une région"), {
          status: 403,
        });
      }

      regionId = lot.ownerId;

      // Vérifier les permissions selon le rôle
      if (req.user.role === "REGIONAL") {
        const userRegionId = await resolveRegionIdForUser(req.user);
        if (!userRegionId || userRegionId !== regionId) {
          throw Object.assign(new Error("Accès refusé pour cette région"), {
            status: 403,
          });
        }
      }
      // SUPERADMIN et NATIONAL peuvent réduire n'importe quel lot régional

      // Vérifier que la quantité à réduire ne dépasse pas la quantité restante
      if (qty > lot.remainingQuantity) {
        throw Object.assign(
          new Error(
            `La quantité à réduire (${qty}) dépasse la quantité restante du lot (${lot.remainingQuantity})`
          ),
          { status: 400 }
        );
      }

      // Réduire la quantité restante du lot
      const newRemainingQuantity = lot.remainingQuantity - qty;

      updatedLot = await tx.stockLot.update({
        where: { id: lotId },
        data: {
          remainingQuantity: newRemainingQuantity,
        },
        include: {
          vaccine: { select: { name: true } },
        },
      });

      // Mettre à jour la quantité du stock REGIONAL (somme des lots)
      const allLots = await tx.stockLot.findMany({
        where: {
          vaccineId: lot.vaccineId,
          ownerType: OWNER_TYPES.REGIONAL,
          ownerId: regionId,
          status: { in: [LOT_STATUS.VALID, LOT_STATUS.EXPIRED] },
        },
        select: { remainingQuantity: true },
      });

      const totalQuantity = allLots.reduce(
        (sum, l) => sum + (l.remainingQuantity ?? 0),
        0
      );

      await tx.stockREGIONAL.update({
        where: { vaccineId_regionId: { vaccineId: lot.vaccineId, regionId } },
        data: { quantity: totalQuantity },
      });

      // Mettre à jour la date d'expiration la plus proche
      await updateNearestExpiration(tx, {
        vaccineId: lot.vaccineId,
        ownerType: OWNER_TYPES.REGIONAL,
        ownerId: regionId,
      });
    });

    res.json(updatedLot);
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ message: error.message });
    }
    next(error);
  }
};

const reduceLotDISTRICT = async (req, res, next) => {
  if (!["SUPERADMIN", "REGIONAL", "DISTRICT"].includes(req.user.role)) {
    return res.status(403).json({ message: "Accès refusé" });
  }

  const { id: lotId } = req.params;
  const { quantity } = req.body ?? {};
  const qty = Number(quantity);

  if (!lotId) {
    return res.status(400).json({ message: "lotId est requis" });
  }

  if (!Number.isFinite(qty) || qty <= 0) {
    return res.status(400).json({ message: "quantity doit être un nombre positif" });
  }

  try {
    let updatedLot = null;
    let districtId = null;

    await prisma.$transaction(async (tx) => {
      const lot = await tx.stockLot.findUnique({
        where: { id: lotId },
        include: {
          vaccine: { select: { name: true } },
        },
      });

      if (!lot) {
        throw Object.assign(new Error("Lot introuvable"), { status: 404 });
      }

      // Vérifier que le lot appartient à un district
      if (lot.ownerType !== OWNER_TYPES.DISTRICT || !lot.ownerId) {
        throw Object.assign(new Error("Ce lot n'appartient pas à un district"), {
          status: 403,
        });
      }

      districtId = lot.ownerId;

      // Vérifier les permissions selon le rôle
      if (req.user.role === "DISTRICT") {
        const userDistrictId = await resolveDistrictIdForUser(req.user);
        if (!userDistrictId || userDistrictId !== districtId) {
          throw Object.assign(new Error("Accès refusé pour ce district"), {
            status: 403,
          });
        }
      } else if (req.user.role === "REGIONAL") {
        const userRegionId = await resolveRegionIdForUser(req.user);
        if (!userRegionId) {
          throw Object.assign(new Error("Votre compte n'est pas rattaché à une région"), {
            status: 400,
          });
        }

        const district = await prisma.district.findUnique({
          where: { id: districtId },
          select: { commune: { select: { regionId: true } } },
        });

        if (!district || district.commune?.regionId !== userRegionId) {
          throw Object.assign(new Error("Ce district n'appartient pas à votre région"), {
            status: 403,
          });
        }
      }
      // SUPERADMIN peut réduire n'importe quel lot

      // Vérifier que la quantité à réduire ne dépasse pas la quantité restante
      if (qty > lot.remainingQuantity) {
        throw Object.assign(
          new Error(
            `La quantité à réduire (${qty}) dépasse la quantité restante du lot (${lot.remainingQuantity})`
          ),
          { status: 400 }
        );
      }

      // Réduire la quantité restante du lot
      const newRemainingQuantity = lot.remainingQuantity - qty;

      updatedLot = await tx.stockLot.update({
        where: { id: lotId },
        data: {
          remainingQuantity: newRemainingQuantity,
        },
        include: {
          vaccine: { select: { name: true } },
        },
      });

      // Mettre à jour la quantité du stock DISTRICT (somme des lots)
      const allLots = await tx.stockLot.findMany({
        where: {
          vaccineId: lot.vaccineId,
          ownerType: OWNER_TYPES.DISTRICT,
          ownerId: districtId,
          status: { in: [LOT_STATUS.VALID, LOT_STATUS.EXPIRED] },
        },
        select: { remainingQuantity: true },
      });

      const totalQuantity = allLots.reduce(
        (sum, l) => sum + (l.remainingQuantity ?? 0),
        0
      );

      await tx.stockDISTRICT.update({
        where: { vaccineId_districtId: { vaccineId: lot.vaccineId, districtId } },
        data: { quantity: totalQuantity },
      });

      // Mettre à jour la date d'expiration la plus proche
      await updateNearestExpiration(tx, {
        vaccineId: lot.vaccineId,
        ownerType: OWNER_TYPES.DISTRICT,
        ownerId: districtId,
      });
    });

    res.json(updatedLot);
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ message: error.message });
    }
    next(error);
  }
};

const reduceLotHEALTHCENTER = async (req, res, next) => {
  if (!["SUPERADMIN", "DISTRICT", "AGENT"].includes(req.user.role)) {
    return res.status(403).json({ message: "Accès refusé" });
  }

  // Seuls les agents ADMIN peuvent réduire les stocks
  if (req.user.role === "AGENT" && req.user.agentLevel !== "ADMIN") {
    return res.status(403).json({ message: "Accès refusé" });
  }

  const { id: lotId } = req.params;
  const { quantity } = req.body ?? {};
  const qty = Number(quantity);

  if (!lotId) {
    return res.status(400).json({ message: "lotId est requis" });
  }

  if (!Number.isFinite(qty) || qty <= 0) {
    return res.status(400).json({ message: "quantity doit être un nombre positif" });
  }

  try {
    let updatedLot = null;
    let healthCenterId = null;
    let appointmentsToNotify = [];

    await prisma.$transaction(async (tx) => {
      const lot = await tx.stockLot.findUnique({
        where: { id: lotId },
        include: {
          vaccine: { select: { name: true } },
        },
      });

      if (!lot) {
        throw Object.assign(new Error("Lot introuvable"), { status: 404 });
      }

      // Vérifier que le lot appartient à un centre de santé
      if (lot.ownerType !== OWNER_TYPES.HEALTHCENTER || !lot.ownerId) {
        throw Object.assign(new Error("Ce lot n'appartient pas à un centre de santé"), {
          status: 403,
        });
      }

      healthCenterId = lot.ownerId;

      // Vérifier les permissions selon le rôle
      if (req.user.role === "AGENT") {
        const userHealthCenterId = await resolveHealthCenterIdForUser(req.user);
        if (!userHealthCenterId || userHealthCenterId !== healthCenterId) {
          throw Object.assign(new Error("Accès refusé pour ce centre de santé"), {
            status: 403,
          });
        }
      } else if (req.user.role === "DISTRICT") {
        const userDistrictId = await resolveDistrictIdForUser(req.user);
        if (!userDistrictId) {
          throw Object.assign(new Error("Votre compte n'est pas rattaché à un district"), {
            status: 400,
          });
        }

        const healthCenter = await prisma.healthCenter.findUnique({
          where: { id: healthCenterId },
          select: { districtId: true },
        });

        if (!healthCenter || healthCenter.districtId !== userDistrictId) {
          throw Object.assign(new Error("Ce centre de santé n'appartient pas à votre district"), {
            status: 403,
          });
        }
      }
      // SUPERADMIN peut réduire n'importe quel lot

      // Vérifier que la quantité à réduire ne dépasse pas la quantité restante
      if (qty > lot.remainingQuantity) {
        throw Object.assign(
          new Error(
            `La quantité à réduire (${qty}) dépasse la quantité restante du lot (${lot.remainingQuantity})`
          ),
          { status: 400 }
        );
      }

      // Calculer le stock restant après diminution
      const newRemainingQuantity = lot.remainingQuantity - qty;

      // Pour SUPERADMIN uniquement : vérifier et annuler les rendez-vous si nécessaire
      if (req.user.role === "SUPERADMIN") {
        // Récupérer toutes les réservations pour ce lot, triées par date de rendez-vous (plus récent en premier)
        const reservations = await tx.stockReservation.findMany({
          where: { stockLotId: lotId },
          include: {
            schedule: {
              select: {
                scheduledFor: true,
              },
            },
          },
          orderBy: {
            schedule: {
              scheduledFor: "desc", // Plus récent en premier
            },
          },
        });

        // Calculer la quantité totale réservée
        const totalReserved = reservations.reduce((sum, res) => sum + (res.quantity || 1), 0);

        // Si le stock restant est insuffisant pour toutes les réservations, annuler les rendez-vous nécessaires
        if (newRemainingQuantity < totalReserved) {
          // Calculer combien de rendez-vous doivent être annulés
          let reservedAfterCancel = totalReserved;
          const scheduleIdsToCancel = [];

          for (const reservation of reservations) {
            if (newRemainingQuantity >= reservedAfterCancel) {
              break;
            }
            scheduleIdsToCancel.push(reservation.scheduleId);
            reservedAfterCancel -= (reservation.quantity || 1);
          }

          if (scheduleIdsToCancel.length > 0) {
            // Annuler les rendez-vous
            appointmentsToNotify = await cancelAppointmentsForSchedules(tx, scheduleIdsToCancel);
          }
        }
      }

      updatedLot = await tx.stockLot.update({
        where: { id: lotId },
        data: {
          remainingQuantity: newRemainingQuantity,
        },
        include: {
          vaccine: { select: { name: true } },
        },
      });

      // Mettre à jour la quantité du stock HEALTHCENTER (somme des lots)
      const allLots = await tx.stockLot.findMany({
        where: {
          vaccineId: lot.vaccineId,
          ownerType: OWNER_TYPES.HEALTHCENTER,
          ownerId: healthCenterId,
          status: { in: [LOT_STATUS.VALID, LOT_STATUS.EXPIRED] },
        },
        select: { remainingQuantity: true },
      });

      const totalQuantity = allLots.reduce(
        (sum, l) => sum + (l.remainingQuantity ?? 0),
        0
      );

      await tx.stockHEALTHCENTER.update({
        where: { vaccineId_healthCenterId: { vaccineId: lot.vaccineId, healthCenterId } },
        data: { quantity: totalQuantity },
      });

      // Mettre à jour la date d'expiration la plus proche
      await updateNearestExpiration(tx, {
        vaccineId: lot.vaccineId,
        ownerType: OWNER_TYPES.HEALTHCENTER,
        ownerId: healthCenterId,
      });
    });

    // Envoyer les notifications aux parents après la transaction
    if (appointmentsToNotify && appointmentsToNotify.length > 0) {
      setImmediate(async () => {
        try {
          await Promise.all(
            appointmentsToNotify.map((appointment) =>
              notifyAppointmentCancelled({
                childId: appointment.childId,
                vaccineName: appointment.vaccineName,
                scheduledDate: appointment.scheduledDate,
              }),
            ),
          );
        } catch (notifError) {
          console.error("Erreur création notifications d'annulation:", notifError);
        }
      });
    }

    res.json(updatedLot);
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ message: error.message });
    }
    next(error);
  }
};

/**
 * GET /api/stock/health-center/impact
 * Vérifier l'impact de la suppression d'un stock HEALTHCENTER (nombre de rendez-vous affectés)
 */
const getStockHealthCenterDeleteImpact = async (req, res, next) => {
  if (req.user.role !== "SUPERADMIN") {
    return res.status(403).json({ message: "Accès refusé" });
  }

  try {
    const { vaccineId, healthCenterId } = req.query;

    if (!vaccineId || !healthCenterId) {
      return res.status(400).json({ message: "vaccineId et healthCenterId sont requis" });
    }

    // Trouver tous les lots de ce stock HEALTHCENTER
    const normalizedOwnerId = normalizeOwnerIdValue(OWNER_TYPES.HEALTHCENTER, healthCenterId);
    const lots = await prisma.stockLot.findMany({
      where: {
        vaccineId,
        ownerType: OWNER_TYPES.HEALTHCENTER,
        ownerId: normalizedOwnerId,
      },
      select: { id: true },
    });

    const lotIds = lots.map((lot) => lot.id);

    if (lotIds.length === 0) {
      return res.json({
        vaccineId,
        healthCenterId,
        affectedAppointments: 0,
        willCancelAppointments: false,
      });
    }

    // Compter toutes les réservations liées à ces lots
    const reservations = await prisma.stockReservation.findMany({
      where: {
        stockLotId: { in: lotIds },
      },
      select: { scheduleId: true },
    });

    const appointmentsCount = reservations.length;

    res.json({
      vaccineId,
      healthCenterId,
      affectedAppointments: appointmentsCount,
      willCancelAppointments: appointmentsCount > 0,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/stock/lots/:id/impact
 * Vérifier l'impact de la suppression d'un lot (nombre de rendez-vous affectés)
 */
const getLotDeleteImpact = async (req, res, next) => {
  if (req.user.role !== "SUPERADMIN") {
    return res.status(403).json({ message: "Accès refusé" });
  }

  try {
    const { id: lotId } = req.params;

    if (!lotId) {
      return res.status(400).json({ message: "lotId est requis" });
    }

    // Vérifier que le lot existe et est de type HEALTHCENTER
    const lot = await prisma.stockLot.findUnique({
      where: { id: lotId },
      select: {
        id: true,
        ownerType: true,
        ownerId: true,
      },
    });

    if (!lot) {
      return res.status(404).json({ message: "Lot introuvable" });
    }

    // Seulement pour les lots HEALTHCENTER
    if (lot.ownerType !== OWNER_TYPES.HEALTHCENTER) {
      return res.json({
        lotId,
        affectedAppointments: 0,
        willCancelAppointments: false,
        reason: "Ce lot n'est pas un lot HEALTHCENTER",
      });
    }

    // Compter les réservations liées à ce lot
    const reservationsCount = await prisma.stockReservation.count({
      where: { stockLotId: lotId },
    });

    res.json({
      lotId,
      affectedAppointments: reservationsCount,
      willCancelAppointments: reservationsCount > 0,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/stock/lots/:id/reduce-impact
 * Vérifier l'impact de la diminution d'un lot (nombre de rendez-vous à annuler)
 */
const getLotReduceImpact = async (req, res, next) => {
  if (req.user.role !== "SUPERADMIN") {
    return res.status(403).json({ message: "Accès refusé" });
  }

  try {
    const { id: lotId } = req.params;
    const { quantity } = req.query;
    const qty = Number(quantity);

    if (!lotId) {
      return res.status(400).json({ message: "lotId est requis" });
    }

    if (!Number.isFinite(qty) || qty <= 0) {
      return res.status(400).json({ message: "quantity doit être un nombre positif" });
    }

    // Vérifier que le lot existe et est de type HEALTHCENTER
    const lot = await prisma.stockLot.findUnique({
      where: { id: lotId },
      select: {
        id: true,
        ownerType: true,
        ownerId: true,
        remainingQuantity: true,
      },
    });

    if (!lot) {
      return res.status(404).json({ message: "Lot introuvable" });
    }

    // Seulement pour les lots HEALTHCENTER
    if (lot.ownerType !== OWNER_TYPES.HEALTHCENTER) {
      return res.json({
        lotId,
        affectedAppointments: 0,
        willCancelAppointments: false,
        reason: "Ce lot n'est pas un lot HEALTHCENTER",
      });
    }

    // Vérifier que la quantité à réduire ne dépasse pas la quantité restante
    if (qty > lot.remainingQuantity) {
      return res.status(400).json({
        message: `La quantité à réduire (${qty}) dépasse la quantité restante du lot (${lot.remainingQuantity})`,
      });
    }

    // Calculer le stock restant après diminution
    const remainingAfterReduce = lot.remainingQuantity - qty;

    // Récupérer toutes les réservations pour ce lot, triées par date de rendez-vous (plus récent en premier)
    const reservations = await prisma.stockReservation.findMany({
      where: { stockLotId: lotId },
      include: {
        schedule: {
          select: {
            scheduledFor: true,
          },
        },
      },
      orderBy: {
        schedule: {
          scheduledFor: "desc", // Plus récent en premier
        },
      },
    });

    // Calculer la quantité totale réservée
    const totalReserved = reservations.reduce((sum, res) => sum + (res.quantity || 1), 0);

    // Si le stock restant est suffisant pour toutes les réservations, aucun rendez-vous à annuler
    if (remainingAfterReduce >= totalReserved) {
      return res.json({
        lotId,
        affectedAppointments: 0,
        willCancelAppointments: false,
        remainingAfterReduce,
        totalReserved,
      });
    }

    // Calculer combien de rendez-vous doivent être annulés
    // On doit annuler jusqu'à ce que le stock restant soit suffisant
    let appointmentsToCancel = 0;
    let reservedAfterCancel = totalReserved;

    for (const reservation of reservations) {
      if (remainingAfterReduce >= reservedAfterCancel) {
        break;
      }
      appointmentsToCancel++;
      reservedAfterCancel -= (reservation.quantity || 1);
    }

    res.json({
      lotId,
      affectedAppointments: appointmentsToCancel,
      willCancelAppointments: appointmentsToCancel > 0,
      remainingAfterReduce,
      totalReserved,
      reservedAfterCancel,
    });
  } catch (error) {
    next(error);
  }
};

const reduceStockHEALTHCENTER = async (req, res, next) => {
  if (!["SUPERADMIN", "DISTRICT", "AGENT"].includes(req.user.role)) {
    return res.status(403).json({ message: "Accès refusé" });
  }

  // Seuls les agents ADMIN peuvent réduire les stocks
  if (req.user.role === "AGENT" && req.user.agentLevel !== "ADMIN") {
    return res.status(403).json({ message: "Accès refusé" });
  }

  try {
    const { vaccineId, healthCenterId, quantity } = req.body;
    const qty = Number(quantity);

    if (!vaccineId || !healthCenterId || !Number.isFinite(qty) || qty <= 0) {
      return res.status(400).json({
        message: "vaccineId, healthCenterId et quantity (> 0) sont requis",
      });
    }

    const stock = await prisma.stockHEALTHCENTER.findUnique({
      where: { vaccineId_healthCenterId: { vaccineId, healthCenterId } },
    });

    if (!stock || (stock.quantity ?? 0) < qty) {
      return res.status(400).json({ message: "Quantité insuffisante" });
    }

    const updated = await prisma.stockHEALTHCENTER.update({
      where: { vaccineId_healthCenterId: { vaccineId, healthCenterId } },
      data: { quantity: (stock.quantity ?? 0) - qty },
    });

    res.json(updated);
  } catch (error) {
    next(error);
  }
};

const deleteStockNATIONAL = async (req, res, next) => {
  if (req.user.role !== "NATIONAL" && req.user.role !== "SUPERADMIN") {
    return res.status(403).json({ message: "Accès refusé" });
  }

  const { vaccineId } = req.body ?? {};

  if (!vaccineId) {
    return res.status(400).json({ message: "vaccineId est requis" });
  }

  try {
    await deleteStockForOwner({
      ownerType: OWNER_TYPES.NATIONAL,
      ownerId: null,
      vaccineId,
    });
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
};

const deleteStockREGIONAL = async (req, res, next) => {
  if (!["SUPERADMIN", "NATIONAL", "REGIONAL"].includes(req.user.role)) {
    return res.status(403).json({ message: "Accès refusé" });
  }

  const { vaccineId, regionId: bodyRegionId } = req.body ?? {};
  let regionId = bodyRegionId ?? null;

  if (!vaccineId) {
    return res.status(400).json({ message: "vaccineId est requis" });
  }

  try {
    if (req.user.role === "REGIONAL") {
      regionId = await resolveRegionIdForUser(req.user);
      if (!regionId) {
        throw createHttpError(400, "Impossible d'identifier votre région");
      }
      
      // Vérifier si le stock a des lots expirés
      const normalizedOwnerId = normalizeOwnerIdValue(OWNER_TYPES.REGIONAL, regionId);
      const expiredLots = await prisma.stockLot.findFirst({
        where: {
          vaccineId,
          ownerType: OWNER_TYPES.REGIONAL,
          ownerId: normalizedOwnerId,
          status: LOT_STATUS.EXPIRED,
        },
      });
      
      if (!expiredLots) {
        return res.status(403).json({ 
          message: "Vous ne pouvez supprimer que les stocks contenant des lots expirés" 
        });
      }
    } else if (!regionId) {
      throw createHttpError(400, "regionId est requis");
    }

    await deleteStockForOwner({
      ownerType: OWNER_TYPES.REGIONAL,
      ownerId: regionId,
      vaccineId,
    });
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
};

const deleteStockDISTRICT = async (req, res, next) => {
  if (!["SUPERADMIN", "NATIONAL", "REGIONAL", "DISTRICT"].includes(req.user.role)) {
    return res.status(403).json({ message: "Accès refusé" });
  }

  const { vaccineId, districtId: bodyDistrictId } = req.body ?? {};
  let districtId = bodyDistrictId ?? null;

  if (!vaccineId) {
    return res.status(400).json({ message: "vaccineId est requis" });
  }

  try {
    if (req.user.role === "DISTRICT") {
      districtId = await resolveDistrictIdForUser(req.user);
      if (!districtId) {
        throw createHttpError(400, "Impossible d'identifier votre district");
      }
      
      // Vérifier si le stock a des lots expirés
      const normalizedOwnerId = normalizeOwnerIdValue(OWNER_TYPES.DISTRICT, districtId);
      const expiredLots = await prisma.stockLot.findFirst({
        where: {
          vaccineId,
          ownerType: OWNER_TYPES.DISTRICT,
          ownerId: normalizedOwnerId,
          status: LOT_STATUS.EXPIRED,
        },
      });
      
      if (!expiredLots) {
        return res.status(403).json({ 
          message: "Vous ne pouvez supprimer que les stocks contenant des lots expirés" 
        });
      }
    } else if (!districtId) {
      throw createHttpError(400, "districtId est requis");
    }

    if (req.user.role === "REGIONAL") {
      const regionId = await resolveRegionIdForUser(req.user);
      if (!regionId) {
        throw createHttpError(400, "Impossible d'identifier votre région");
      }
      await ensureDistrictBelongsToRegion(districtId, regionId);
    }

    await deleteStockForOwner({
      ownerType: OWNER_TYPES.DISTRICT,
      ownerId: districtId,
      vaccineId,
    });
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
};

const deleteStockHEALTHCENTER = async (req, res, next) => {
  if (
    !["SUPERADMIN", "NATIONAL", "REGIONAL", "DISTRICT", "AGENT"].includes(req.user.role)
  ) {
    return res.status(403).json({ message: "Accès refusé" });
  }

  const { vaccineId, healthCenterId: bodyHealthCenterId } = req.body ?? {};
  let healthCenterId = bodyHealthCenterId ?? null;

  if (!vaccineId) {
    return res.status(400).json({ message: "vaccineId est requis" });
  }

  try {
    if (req.user.role === "AGENT") {
      // Seuls les agents ADMIN peuvent supprimer
      if (req.user.agentLevel !== "ADMIN") {
        return res.status(403).json({ message: "Accès refusé" });
      }
      healthCenterId = await resolveHealthCenterIdForUser(req.user);
      if (!healthCenterId) {
        throw createHttpError(
          400,
          "Impossible d'identifier votre centre de santé",
        );
      }
      
      // Vérifier si le stock a des lots expirés
      const normalizedOwnerId = normalizeOwnerIdValue(OWNER_TYPES.HEALTHCENTER, healthCenterId);
      const expiredLots = await prisma.stockLot.findFirst({
        where: {
          vaccineId,
          ownerType: OWNER_TYPES.HEALTHCENTER,
          ownerId: normalizedOwnerId,
          status: LOT_STATUS.EXPIRED,
        },
      });
      
      if (!expiredLots) {
        return res.status(403).json({ 
          message: "Vous ne pouvez supprimer que les stocks contenant des lots expirés" 
        });
      }
    } else if (!healthCenterId) {
      throw createHttpError(400, "healthCenterId est requis");
    } else if (
      req.user.role === "DISTRICT" ||
      req.user.role === "REGIONAL"
    ) {
      await ensureHealthCenterAccessible(req.user, healthCenterId);
    }

    // Pour SUPERADMIN uniquement : annuler les rendez-vous avant suppression
    let appointmentsToNotify = [];
    if (req.user.role === "SUPERADMIN") {
      await prisma.$transaction(async (tx) => {
        // Trouver tous les lots de ce stock HEALTHCENTER
        const normalizedOwnerId = normalizeOwnerIdValue(OWNER_TYPES.HEALTHCENTER, healthCenterId);
        const lots = await tx.stockLot.findMany({
          where: {
            vaccineId,
            ownerType: OWNER_TYPES.HEALTHCENTER,
            ownerId: normalizedOwnerId,
          },
          select: { id: true },
        });

        const lotIds = lots.map((lot) => lot.id);

        if (lotIds.length > 0) {
          // Récupérer toutes les réservations liées à ces lots
          const reservations = await tx.stockReservation.findMany({
            where: {
              stockLotId: { in: lotIds },
            },
            select: { scheduleId: true },
          });

          const scheduleIds = reservations.map((res) => res.scheduleId);

          if (scheduleIds.length > 0) {
            // Annuler les rendez-vous
            appointmentsToNotify = await cancelAppointmentsForSchedules(tx, scheduleIds);
          }
        }
      });
    }

    await deleteStockForOwner({
      ownerType: OWNER_TYPES.HEALTHCENTER,
      ownerId: healthCenterId,
      vaccineId,
    });

    // Envoyer les notifications aux parents après la suppression
    if (appointmentsToNotify.length > 0) {
      setImmediate(async () => {
        try {
          await Promise.all(
            appointmentsToNotify.map((appointment) =>
              notifyAppointmentCancelled({
                childId: appointment.childId,
                vaccineName: appointment.vaccineName,
                scheduledDate: appointment.scheduledDate,
              }),
            ),
          );
        } catch (notifError) {
          console.error("Erreur création notifications d'annulation:", notifError);
        }
      });
    }

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
};

const LOW_STOCK_THRESHOLD = 50;

const getNationalStockStats = async (req, res, next) => {
  if (req.user.role !== "NATIONAL" && req.user.role !== "SUPERADMIN") {
    return res.status(403).json({ message: "Accès refusé" });
  }

  try {
    const aggregates = await prisma.stockNATIONAL.aggregate({
      _sum: { quantity: true },
      _count: { _all: true },
    });

    const lowStockCount = await prisma.stockNATIONAL.count({
      where: {
        quantity: {
          lt: LOW_STOCK_THRESHOLD,
          not: null,
        },
      },
    });

    const expiredLots = await prisma.stockLot.count({
      where: {
        ownerType: OWNER_TYPES.NATIONAL,
        status: LOT_STATUS.EXPIRED,
      },
    });

    res.json({
      totalLots: aggregates._count._all,
      totalQuantity: aggregates._sum.quantity ?? 0,
      lowStockCount,
      expiredLots,
      threshold: LOW_STOCK_THRESHOLD,
    });
  } catch (error) {
    next(error);
  }
};

const getRegionalStockStats = async (req, res, next) => {
  if (!["SUPERADMIN", "NATIONAL", "REGIONAL"].includes(req.user.role)) {
    return res.status(403).json({ message: "Accès refusé" });
  }

  try {
    let whereClause = {};

    // Pour SUPERADMIN, accepter regionId depuis query params
    const overrideRegionId = req.user.role === "SUPERADMIN" ? req.query.regionId : null;

    if (req.user.role === "REGIONAL" || (req.user.role === "SUPERADMIN" && overrideRegionId)) {
      const regionId = await resolveRegionIdForUser(req.user, overrideRegionId);
      if (!regionId) {
        return res.json({
          totalLots: 0,
          totalQuantity: 0,
          lowStockCount: 0,
          threshold: LOW_STOCK_THRESHOLD,
        });
      }
      whereClause = { regionId };
    }

    const aggregates = await prisma.stockREGIONAL.aggregate({
      where: whereClause,
      _sum: { quantity: true },
      _count: { _all: true },
    });

    const lowStockCount = await prisma.stockREGIONAL.count({
      where: {
        ...whereClause,
        quantity: {
          lt: LOW_STOCK_THRESHOLD,
          not: null,
        },
      },
    });

    const expiredLots = await prisma.stockLot.count({
      where: {
        ownerType: OWNER_TYPES.REGIONAL,
        status: LOT_STATUS.EXPIRED,
        ownerId:
          req.user.role === "REGIONAL"
            ? await resolveRegionIdForUser(req.user)
            : undefined,
      },
    });

    res.json({
      totalLots: aggregates._count._all,
      totalQuantity: aggregates._sum.quantity ?? 0,
      lowStockCount,
      expiredLots,
      threshold: LOW_STOCK_THRESHOLD,
    });
  } catch (error) {
    next(error);
  }
};

const getDistrictStockStats = async (req, res, next) => {
  if (!["SUPERADMIN", "NATIONAL", "REGIONAL", "DISTRICT"].includes(req.user.role)) {
    return res.status(403).json({ message: "Accès refusé" });
  }

  try {
    let whereClause = {};

    // Pour SUPERADMIN, accepter districtId ou regionId depuis query params
    const overrideDistrictId = req.user.role === "SUPERADMIN" ? req.query.districtId : null;
    const overrideRegionId = req.user.role === "SUPERADMIN" ? req.query.regionId : null;

    if (req.user.role === "REGIONAL" || (req.user.role === "SUPERADMIN" && overrideRegionId && !overrideDistrictId)) {
      const regionId = await resolveRegionIdForUser(req.user, overrideRegionId);
      if (!regionId) {
        return res.json({
          totalLots: 0,
          totalQuantity: 0,
          lowStockCount: 0,
          threshold: LOW_STOCK_THRESHOLD,
        });
      }
      const districtIds = await fetchDistrictIdsForRegion(regionId);
      if (!districtIds.length) {
        return res.json({
          totalLots: 0,
          totalQuantity: 0,
          lowStockCount: 0,
          threshold: LOW_STOCK_THRESHOLD,
        });
      }
      whereClause = { districtId: { in: districtIds } };
    } else if (req.user.role === "DISTRICT" || (req.user.role === "SUPERADMIN" && overrideDistrictId)) {
      const districtId = await resolveDistrictIdForUser(req.user, overrideDistrictId);
      if (!districtId) {
        return res.json({
          totalLots: 0,
          totalQuantity: 0,
          lowStockCount: 0,
          threshold: LOW_STOCK_THRESHOLD,
        });
      }
      whereClause = { districtId };
    }

    const aggregates = await prisma.stockDISTRICT.aggregate({
      where: whereClause,
      _sum: { quantity: true },
      _count: { _all: true },
    });

    const lowStockCount = await prisma.stockDISTRICT.count({
      where: {
        ...whereClause,
        quantity: {
          lt: LOW_STOCK_THRESHOLD,
          not: null,
        },
      },
    });

    const expiredLots = await prisma.stockLot.count({
      where: {
        ownerType: OWNER_TYPES.DISTRICT,
        status: LOT_STATUS.EXPIRED,
        ownerId:
          req.user.role === "DISTRICT"
            ? await resolveDistrictIdForUser(req.user)
            : undefined,
        ...(req.user.role === "REGIONAL"
          ? {
              ownerId: {
                in: await fetchDistrictIdsForRegion(
                  await resolveRegionIdForUser(req.user),
                ),
              },
            }
          : {}),
      },
    });

    res.json({
      totalLots: aggregates._count._all,
      totalQuantity: aggregates._sum.quantity ?? 0,
      lowStockCount,
      expiredLots,
      threshold: LOW_STOCK_THRESHOLD,
    });
  } catch (error) {
    next(error);
  }
};

const getHealthCenterStockStats = async (req, res, next) => {
  if (!["SUPERADMIN", "NATIONAL", "REGIONAL", "DISTRICT", "AGENT"].includes(req.user.role)) {
    return res.status(403).json({ message: "Accès refusé" });
  }

  try {
    let whereClause = {};

    // Pour SUPERADMIN, accepter healthCenterId, districtId ou regionId depuis query params
    const overrideHealthCenterId = req.user.role === "SUPERADMIN" ? req.query.healthCenterId : null;
    const overrideDistrictId = req.user.role === "SUPERADMIN" ? req.query.districtId : null;
    const overrideRegionId = req.user.role === "SUPERADMIN" ? req.query.regionId : null;

    if (req.user.role === "AGENT" || (req.user.role === "SUPERADMIN" && overrideHealthCenterId)) {
      // Permettre l'accès en lecture aux agents ADMIN et STAFF
      if (req.user.role === "AGENT" && req.user.agentLevel !== "ADMIN" && req.user.agentLevel !== "STAFF") {
        return res.status(403).json({ message: "Accès refusé" });
      }

      const healthCenterId = await resolveHealthCenterIdForUser(req.user, overrideHealthCenterId);
      if (!healthCenterId) {
        return res.json({
          totalLots: 0,
          totalQuantity: 0,
          lowStockCount: 0,
          threshold: LOW_STOCK_THRESHOLD,
        });
      }

      whereClause = { healthCenterId };
    } else if (req.user.role === "DISTRICT" || (req.user.role === "SUPERADMIN" && overrideDistrictId && !overrideHealthCenterId)) {
      const districtId = await resolveDistrictIdForUser(req.user, overrideDistrictId);
      if (!districtId) {
        return res.json({
          totalLots: 0,
          totalQuantity: 0,
          lowStockCount: 0,
          threshold: LOW_STOCK_THRESHOLD,
        });
      }

      whereClause = {
        healthCenter: {
          districtId,
        },
      };
    } else if (req.user.role === "REGIONAL" || (req.user.role === "SUPERADMIN" && overrideRegionId && !overrideDistrictId && !overrideHealthCenterId)) {
      const regionId = await resolveRegionIdForUser(req.user, overrideRegionId);
      if (!regionId) {
        return res.json({
          totalLots: 0,
          totalQuantity: 0,
          lowStockCount: 0,
          threshold: LOW_STOCK_THRESHOLD,
        });
      }

      whereClause = {
        healthCenter: {
          district: {
            commune: {
              regionId,
            },
          },
        },
      };
    }

    const aggregates = await prisma.stockHEALTHCENTER.aggregate({
      where: whereClause,
      _sum: { quantity: true },
      _count: { _all: true },
    });

    const lowStockCount = await prisma.stockHEALTHCENTER.count({
      where: {
        ...whereClause,
        quantity: {
          lt: LOW_STOCK_THRESHOLD,
          not: null,
        },
      },
    });

    const expiredLots = await prisma.stockLot.count({
      where: {
        ownerType: OWNER_TYPES.HEALTHCENTER,
        status: LOT_STATUS.EXPIRED,
        ownerId:
          req.user.role === "AGENT"
            ? await resolveHealthCenterIdForUser(req.user)
            : undefined,
      },
    });

    res.json({
      totalLots: aggregates._count._all,
      totalQuantity: aggregates._sum.quantity ?? 0,
      lowStockCount,
      expiredLots,
      threshold: LOW_STOCK_THRESHOLD,
    });
  } catch (error) {
    next(error);
  }
};

const getHealthCenterReservations = async (req, res, next) => {
  if (!["NATIONAL", "REGIONAL", "DISTRICT", "AGENT"].includes(req.user.role)) {
    return res.status(403).json({ message: "Accès refusé" });
  }

  try {
    let healthCenterId = null;

    if (req.user.role === "AGENT") {
      // Permettre l'accès en lecture aux agents ADMIN et STAFF
      if (req.user.agentLevel !== "ADMIN" && req.user.agentLevel !== "STAFF") {
        return res.status(403).json({ message: "Accès refusé" });
      }
      healthCenterId = await resolveHealthCenterIdForUser(req.user);
      if (!healthCenterId) {
        return res.json({ reservations: [] });
      }
    } else if (req.user.role === "DISTRICT") {
      const { healthCenterId: queryHealthCenterId } = req.query;
      if (!queryHealthCenterId) {
        return res.status(400).json({ message: "healthCenterId est requis" });
      }
      const districtId = await resolveDistrictIdForUser(req.user);
      if (!districtId) {
        return res.status(400).json({ message: "Votre compte n'est pas associé à un district" });
      }
      const healthCenter = await prisma.healthCenter.findUnique({
        where: { id: queryHealthCenterId },
        select: { districtId: true },
      });
      if (!healthCenter || healthCenter.districtId !== districtId) {
        return res.status(403).json({ message: "Centre de santé hors de votre district" });
      }
      healthCenterId = queryHealthCenterId;
    } else if (req.user.role === "REGIONAL") {
      const { healthCenterId: queryHealthCenterId } = req.query;
      if (!queryHealthCenterId) {
        return res.status(400).json({ message: "healthCenterId est requis" });
      }
      const regionId = await resolveRegionIdForUser(req.user);
      if (!regionId) {
        return res.status(400).json({ message: "Votre compte n'est pas associé à une région" });
      }
      const healthCenter = await prisma.healthCenter.findUnique({
        where: { id: queryHealthCenterId },
        include: {
          district: {
            include: {
              commune: {
                select: { regionId: true },
              },
            },
          },
        },
      });
      if (!healthCenter || healthCenter.district?.commune?.regionId !== regionId) {
        return res.status(403).json({ message: "Centre de santé hors de votre région" });
      }
      healthCenterId = queryHealthCenterId;
    } else {
      const { healthCenterId: queryHealthCenterId } = req.query;
      if (!queryHealthCenterId) {
        return res.status(400).json({ message: "healthCenterId est requis" });
      }
      healthCenterId = queryHealthCenterId;
    }

    const reservations = await prisma.stockReservation.findMany({
      where: {
        stockLot: {
          ownerType: OWNER_TYPES.HEALTHCENTER,
          ownerId: healthCenterId,
        },
      },
      include: {
        stockLot: {
          include: {
            vaccine: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        schedule: {
          include: {
            child: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
            vaccine: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: {
        schedule: {
          scheduledFor: "asc",
        },
      },
    });

    const formatted = reservations.map((reservation) => ({
      id: reservation.id,
      quantity: reservation.quantity,
      createdAt: reservation.createdAt,
      vaccine: {
        id: reservation.stockLot.vaccine.id,
        name: reservation.stockLot.vaccine.name,
      },
      lot: {
        id: reservation.stockLot.id,
        expiration: reservation.stockLot.expiration,
        status: reservation.stockLot.status,
      },
      appointment: {
        id: reservation.schedule.id,
        scheduledFor: reservation.schedule.scheduledFor,
        child: {
          id: reservation.schedule.child.id,
          name: `${reservation.schedule.child.firstName} ${reservation.schedule.child.lastName}`,
        },
      },
    }));

    res.json({ reservations: formatted });
  } catch (error) {
    next(error);
  }
};

// Lister les transferts en attente pour un régional
const getPendingTransfers = async (req, res, next) => {
  if (!["SUPERADMIN", "REGIONAL", "DISTRICT", "AGENT"].includes(req.user.role)) {
    return res.status(403).json({ message: "Accès refusé" });
  }

  try {
    let whereClause = { status: "PENDING" };

    // Pour SUPERADMIN, accepter healthCenterId, districtId ou regionId depuis query params
    const overrideHealthCenterId = req.user.role === "SUPERADMIN" ? req.query.healthCenterId : null;
    const overrideDistrictId = req.user.role === "SUPERADMIN" ? req.query.districtId : null;
    const overrideRegionId = req.user.role === "SUPERADMIN" ? req.query.regionId : null;

    if (req.user.role === "REGIONAL" || (req.user.role === "SUPERADMIN" && overrideRegionId && !overrideDistrictId && !overrideHealthCenterId)) {
      const regionId = await resolveRegionIdForUser(req.user, overrideRegionId);
      if (!regionId) {
        return res.json({ transfers: [] });
      }
      whereClause = {
        ...whereClause,
        toType: OWNER_TYPES.REGIONAL,
        toId: regionId,
      };
    } else if (req.user.role === "DISTRICT" || (req.user.role === "SUPERADMIN" && overrideDistrictId && !overrideHealthCenterId)) {
      const districtId = await resolveDistrictIdForUser(req.user, overrideDistrictId);
      if (!districtId) {
        return res.json({ transfers: [] });
      }
      whereClause = {
        ...whereClause,
        toType: OWNER_TYPES.DISTRICT,
        toId: districtId,
      };
    } else if (req.user.role === "AGENT" || (req.user.role === "SUPERADMIN" && overrideHealthCenterId)) {
      // Permettre l'accès en lecture aux agents ADMIN et STAFF
      if (req.user.role === "AGENT" && req.user.agentLevel !== "ADMIN" && req.user.agentLevel !== "STAFF") {
        return res.status(403).json({ message: "Accès refusé" });
      }
      const healthCenterId = await resolveHealthCenterIdForUser(req.user, overrideHealthCenterId);
      if (!healthCenterId) {
        return res.json({ transfers: [] });
      }
      whereClause = {
        ...whereClause,
        toType: OWNER_TYPES.HEALTHCENTER,
        toId: healthCenterId,
      };
    } else {
      // Si aucun des cas précédents n'est vérifié, retourner une liste vide plutôt qu'une erreur
      return res.json({ transfers: [] });
    }

    const transfers = await prisma.pendingStockTransfer.findMany({
      where: whereClause,
      include: {
        vaccine: true,
        lots: {
          include: {
            lot: {
              select: {
                id: true,
                expiration: true,
                quantity: true,
                remainingQuantity: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    res.json({ transfers });
  } catch (error) {
    next(error);
  }
};

// Confirmer un transfert en attente
const confirmPendingTransfer = async (req, res, next) => {
  if (!["SUPERADMIN", "REGIONAL", "DISTRICT", "AGENT"].includes(req.user.role)) {
    return res.status(403).json({ message: "Accès refusé" });
  }

  try {
    const { transferId } = req.params;
    
    // Vérifier les permissions selon le rôle
    let toId = null;
    let toType = null;
    
    if (req.user.role === "REGIONAL") {
      toId = await resolveRegionIdForUser(req.user);
      if (!toId) {
        return res.status(400).json({ message: "Votre compte n'est pas rattaché à une région" });
      }
      toType = OWNER_TYPES.REGIONAL;
    } else if (req.user.role === "DISTRICT") {
      toId = await resolveDistrictIdForUser(req.user);
      if (!toId) {
        return res.status(400).json({ message: "Votre compte n'est pas rattaché à un district" });
      }
      toType = OWNER_TYPES.DISTRICT;
    } else if (req.user.role === "AGENT") {
      if (req.user.agentLevel !== "ADMIN") {
        return res.status(403).json({ message: "Accès refusé" });
      }
      if (!req.user.healthCenterId) {
        return res.status(400).json({ message: "Votre compte n'est pas rattaché à un centre de santé" });
      }
      toId = req.user.healthCenterId;
      toType = OWNER_TYPES.HEALTHCENTER;
    }
    // Pour SUPERADMIN, toId et toType seront déterminés depuis le transfert lui-même

    let updatedStock = null;
    let confirmedTransfer = null;

    await prisma.$transaction(async (tx) => {
      // Vérifier que le transfert existe et appartient à cet utilisateur
      const pendingTransfer = await tx.pendingStockTransfer.findUnique({
        where: { id: transferId },
        include: {
          vaccine: true,
          lots: {
            include: {
              lot: true,
            },
          },
        },
      });

      if (!pendingTransfer) {
        throw Object.assign(new Error("Transfert introuvable"), { status: 404 });
      }

      // Pour SUPERADMIN, utiliser les informations du transfert
      if (req.user.role === "SUPERADMIN") {
        toType = pendingTransfer.toType;
        toId = pendingTransfer.toId;
      } else {
        // Pour les autres rôles, vérifier que le transfert leur appartient
        if (pendingTransfer.toType !== toType || pendingTransfer.toId !== toId) {
          throw Object.assign(new Error("Ce transfert ne vous appartient pas"), { status: 403 });
        }
      }

      if (pendingTransfer.status !== "PENDING") {
        throw Object.assign(
          new Error(`Ce transfert a déjà été ${pendingTransfer.status === "CONFIRMED" ? "confirmé" : "annulé"}`),
          { status: 400 },
        );
      }

      // Vérifier que le stock destination existe, sinon le créer
      let stock = null;
      if (toType === OWNER_TYPES.REGIONAL) {
        stock = await tx.stockREGIONAL.findUnique({
          where: {
            vaccineId_regionId: {
              vaccineId: pendingTransfer.vaccineId,
              regionId: toId,
            },
          },
        });
        if (!stock) {
          // Créer automatiquement le stock régional s'il n'existe pas
          stock = await tx.stockREGIONAL.create({
            data: {
              vaccineId: pendingTransfer.vaccineId,
              regionId: toId,
              quantity: 0,
            },
          });
        }
      } else if (toType === OWNER_TYPES.DISTRICT) {
        stock = await tx.stockDISTRICT.findUnique({
          where: {
            vaccineId_districtId: {
              vaccineId: pendingTransfer.vaccineId,
              districtId: toId,
            },
          },
        });
        if (!stock) {
          // Créer automatiquement le stock district s'il n'existe pas
          stock = await tx.stockDISTRICT.create({
            data: {
              vaccineId: pendingTransfer.vaccineId,
              districtId: toId,
              quantity: 0,
            },
          });
        }
      } else if (toType === OWNER_TYPES.HEALTHCENTER) {
        stock = await tx.stockHEALTHCENTER.findUnique({
          where: {
            vaccineId_healthCenterId: {
              vaccineId: pendingTransfer.vaccineId,
              healthCenterId: toId,
            },
          },
        });
        if (!stock) {
          // Créer automatiquement le stock centre de santé s'il n'existe pas
          stock = await tx.stockHEALTHCENTER.create({
            data: {
              vaccineId: pendingTransfer.vaccineId,
              healthCenterId: toId,
              quantity: 0,
            },
          });
        }
      }

      // Trouver le lot PENDING existant lié à ce transfert
      const normalizedToId = toType === OWNER_TYPES.NATIONAL ? null : toId;
      const pendingLot = await tx.stockLot.findFirst({
        where: {
          pendingTransferId: transferId,
          status: LOT_STATUS.PENDING,
          ownerType: toType,
          ownerId: normalizedToId,
        },
      });

      if (!pendingLot) {
        throw Object.assign(
          new Error("Lot PENDING introuvable pour ce transfert"),
          { status: 404 },
        );
      }

      // Récupérer la date d'expiration du premier lot source (ou utiliser celle du lot PENDING)
      const firstValidLot = pendingTransfer.lots.find((tl) => tl.lot);
      let lotExpiration = firstValidLot 
        ? firstValidLot.lot.expiration 
        : pendingLot.expiration;
      
      // Déterminer le statut : vérifier si le lot est expiré
      const now = new Date();
      let lotStatus;
      if (firstValidLot) {
        // Si le lot source existe, utiliser son statut s'il est EXPIRED, sinon vérifier l'expiration
        if (firstValidLot.lot.status === LOT_STATUS.EXPIRED) {
          lotStatus = LOT_STATUS.EXPIRED;
        } else {
          lotStatus = lotExpiration <= now ? LOT_STATUS.EXPIRED : LOT_STATUS.VALID;
        }
      } else {
        // Si le lot source n'existe plus, vérifier uniquement l'expiration
        lotStatus = lotExpiration <= now ? LOT_STATUS.EXPIRED : LOT_STATUS.VALID;
      }

      // Mettre à jour le lot PENDING avec la quantité et changer le statut
      await tx.stockLot.update({
        where: { id: pendingLot.id },
        data: {
          quantity: pendingTransfer.quantity,
          remainingQuantity: pendingTransfer.quantity,
          expiration: lotExpiration,
          status: lotStatus,
          sourceLotId: firstValidLot?.lot.id || null,
          pendingTransferId: null, // Retirer le lien une fois confirmé
        },
      });

      // Mettre à jour le stock destination
      if (toType === OWNER_TYPES.REGIONAL) {
        await tx.stockREGIONAL.update({
          where: {
            vaccineId_regionId: {
              vaccineId: pendingTransfer.vaccineId,
              regionId: toId,
            },
          },
          data: {
            quantity: (stock.quantity ?? 0) + pendingTransfer.quantity,
          },
        });
        updatedStock = await tx.stockREGIONAL.findUnique({
          where: {
            vaccineId_regionId: {
              vaccineId: pendingTransfer.vaccineId,
              regionId: toId,
            },
          },
          include: {
            vaccine: true,
            region: true,
          },
        });
      } else if (toType === OWNER_TYPES.DISTRICT) {
        await tx.stockDISTRICT.update({
          where: {
            vaccineId_districtId: {
              vaccineId: pendingTransfer.vaccineId,
              districtId: toId,
            },
          },
          data: {
            quantity: (stock.quantity ?? 0) + pendingTransfer.quantity,
          },
        });
        updatedStock = await tx.stockDISTRICT.findUnique({
          where: {
            vaccineId_districtId: {
              vaccineId: pendingTransfer.vaccineId,
              districtId: toId,
            },
          },
          include: {
            vaccine: true,
            district: { include: { commune: true } },
          },
        });
      } else if (toType === OWNER_TYPES.HEALTHCENTER) {
        await tx.stockHEALTHCENTER.update({
          where: {
            vaccineId_healthCenterId: {
              vaccineId: pendingTransfer.vaccineId,
              healthCenterId: toId,
            },
          },
          data: {
            quantity: (stock.quantity ?? 0) + pendingTransfer.quantity,
          },
        });
        updatedStock = await tx.stockHEALTHCENTER.findUnique({
          where: {
            vaccineId_healthCenterId: {
              vaccineId: pendingTransfer.vaccineId,
              healthCenterId: toId,
            },
          },
          include: {
            vaccine: true,
            healthCenter: true,
          },
        });
      }

      // Récupérer les informations du transfert avant suppression (pour les notifications)
      confirmedTransfer = await tx.pendingStockTransfer.findUnique({
        where: { id: transferId },
        include: {
          vaccine: true,
          confirmedBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      });

      // Créer un enregistrement de transfert final
      // Filtrer les lots qui existent encore (certains peuvent avoir été supprimés)
      const validAllocations = pendingTransfer.lots
        .filter((tl) => tl.lot) // Ne garder que les lots qui existent encore
        .map((tl) => ({
          lotId: tl.lot.id,
          quantity: tl.quantity,
          expiration: tl.lot.expiration,
          status: tl.lot.status,
        }));

      if (validAllocations.length > 0) {
        await recordTransfer(tx, {
          vaccineId: pendingTransfer.vaccineId,
          fromType: pendingTransfer.fromType,
          fromId: pendingTransfer.fromId,
          toType: toType,
          toId: toId,
          allocations: validAllocations,
        });
      }

      // Récupérer les noms pour l'historique
      const fromName = await getOwnerName(tx, pendingTransfer.fromType, pendingTransfer.fromId);
      const toName = await getOwnerName(tx, toType, toId);
      const confirmedByName = req.user.firstName && req.user.lastName
        ? `${req.user.firstName} ${req.user.lastName}`
        : req.user.email || null;

      // lotExpiration et lotStatus sont déjà définis plus haut lors de la mise à jour du lot PENDING

      // Enregistrer dans l'historique
      await tx.stockTransferHistory.create({
        data: {
          vaccineId: pendingTransfer.vaccineId,
          vaccineName: pendingTransfer.vaccine.name,
          fromType: pendingTransfer.fromType,
          fromId: pendingTransfer.fromId,
          fromName: fromName,
          toType: toType,
          toId: toId,
          toName: toName,
          quantity: pendingTransfer.quantity,
          sentAt: pendingTransfer.createdAt,
          confirmedAt: new Date(),
          confirmedById: req.user.id,
          confirmedByName: confirmedByName,
          lotExpiration: lotExpiration,
          lotStatus: lotStatus,
          status: "CONFIRMED",
        },
      });

      // Supprimer le transfert en attente après enregistrement dans l'historique
      await tx.pendingStockTransfer.delete({
        where: { id: transferId },
      });
    });

    const stockTypeName = toType === OWNER_TYPES.REGIONAL ? "régional" : 
                          toType === OWNER_TYPES.DISTRICT ? "district" : 
                          "centre de santé";

    // Enregistrer l'événement
    logEventAsync({
      type: "STOCK_TRANSFER",
      subtype: toType === OWNER_TYPES.REGIONAL ? "REGIONAL" : toType === OWNER_TYPES.DISTRICT ? "DISTRICT" : "HEALTHCENTER",
      action: "TRANSFER_CONFIRMED",
      user: {
        id: req.user.id,
        firstName: req.user.firstName,
        lastName: req.user.lastName,
        email: req.user.email,
        role: req.user.role,
      },
      entityType: "STOCK",
      entityId: transferId,
      entityName: confirmedTransfer?.vaccine?.name || "Vaccin",
      details: {
        fromType: confirmedTransfer?.fromType,
        fromId: confirmedTransfer?.fromId,
        toType: toType,
        toId: toId,
        quantity: confirmedTransfer?.quantity,
        vaccineId: confirmedTransfer?.vaccineId,
      },
    });

    res.json({
      transfer: confirmedTransfer,
      stock: updatedStock,
      message: `Transfert confirmé avec succès. Le stock ${stockTypeName} a été mis à jour.`,
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ message: error.message });
    }
    next(error);
  }
};

// Refuser un transfert en attente (destinataire)
const rejectPendingTransfer = async (req, res, next) => {
  if (!["SUPERADMIN", "REGIONAL", "DISTRICT", "AGENT"].includes(req.user.role)) {
    return res.status(403).json({ message: "Accès refusé" });
  }

  try {
    const { transferId } = req.params;

    // Vérifier les permissions selon le rôle
    let toId = null;
    let toType = null;

    if (req.user.role === "REGIONAL") {
      toId = await resolveRegionIdForUser(req.user);
      if (!toId) {
        return res.status(400).json({ message: "Votre compte n'est pas rattaché à une région" });
      }
      toType = OWNER_TYPES.REGIONAL;
    } else if (req.user.role === "DISTRICT") {
      toId = await resolveDistrictIdForUser(req.user);
      if (!toId) {
        return res.status(400).json({ message: "Votre compte n'est pas rattaché à un district" });
      }
      toType = OWNER_TYPES.DISTRICT;
    } else if (req.user.role === "AGENT") {
      if (req.user.agentLevel !== "ADMIN") {
        return res.status(403).json({ message: "Accès refusé" });
      }
      if (!req.user.healthCenterId) {
        return res.status(400).json({ message: "Votre compte n'est pas rattaché à un centre de santé" });
      }
      toId = req.user.healthCenterId;
      toType = OWNER_TYPES.HEALTHCENTER;
    }
    // Pour SUPERADMIN, toId et toType seront déterminés depuis le transfert lui-même

    // Stocker les données pour les notifications avant la transaction
    let transferDataForNotification = null;

    await prisma.$transaction(async (tx) => {
      // Vérifier que le transfert existe et appartient à cet utilisateur
      const pendingTransfer = await tx.pendingStockTransfer.findUnique({
        where: { id: transferId },
        include: {
          vaccine: true,
          lots: {
            include: {
              lot: true,
            },
          },
        },
      });

      if (!pendingTransfer) {
        throw Object.assign(new Error("Transfert introuvable"), { status: 404 });
      }

      // Pour SUPERADMIN, utiliser les informations du transfert
      if (req.user.role === "SUPERADMIN") {
        toType = pendingTransfer.toType;
        toId = pendingTransfer.toId;
      } else {
        // Pour les autres rôles, vérifier que le transfert leur appartient
        if (pendingTransfer.toType !== toType || pendingTransfer.toId !== toId) {
          throw Object.assign(new Error("Ce transfert ne vous appartient pas"), { status: 403 });
        }
      }

      if (pendingTransfer.status !== "PENDING") {
        throw Object.assign(
          new Error(`Ce transfert a déjà été ${pendingTransfer.status === "CONFIRMED" ? "confirmé" : "annulé"}`),
          { status: 400 },
        );
      }

      // Stocker les données pour les notifications
      transferDataForNotification = {
        vaccineId: pendingTransfer.vaccineId,
        vaccineName: pendingTransfer.vaccine.name,
        fromType: pendingTransfer.fromType,
        fromId: pendingTransfer.fromId,
        toType: toType,
        toId: toId,
        quantity: pendingTransfer.quantity,
      };

      // Supprimer le lot vide PENDING au destinataire
      const normalizedToId = toType === OWNER_TYPES.NATIONAL ? null : toId;
      const pendingLot = await tx.stockLot.findFirst({
        where: {
          pendingTransferId: transferId,
          status: LOT_STATUS.PENDING,
          ownerType: toType,
          ownerId: normalizedToId,
        },
      });

      if (pendingLot) {
        await deleteLotDirect(tx, pendingLot.id);
      }

      // Restaurer ou recréer les lots pour chaque lot du transfert
      // Note: Si le lot source a été supprimé, transferLot.lot sera null
      // Dans ce cas, on recrée le lot avec les informations disponibles
      for (const transferLot of pendingTransfer.lots) {
        if (transferLot.lot) {
          // Le lot existe encore : restaurer la quantité
          await restoreOrRecreateLotForRejectedTransfer(tx, {
            lotId: transferLot.lot.id,
            quantity: transferLot.quantity,
            vaccineId: pendingTransfer.vaccineId,
            ownerType: pendingTransfer.fromType,
            ownerId: pendingTransfer.fromId,
            expiration: transferLot.lot.expiration,
            status: transferLot.lot.status,
          });
        } else {
          // Le lot a été supprimé : recréer le lot
          await restoreOrRecreateLotForRejectedTransfer(tx, {
            lotId: transferLot.lotId, // ID du lot supprimé (pour référence)
            quantity: transferLot.quantity,
            vaccineId: pendingTransfer.vaccineId,
            ownerType: pendingTransfer.fromType,
            ownerId: pendingTransfer.fromId,
            expiration: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // Par défaut 1 an
            status: LOT_STATUS.VALID,
          });
        }
      }

      // Récupérer les informations pour l'historique avant de marquer comme annulé
      const fromName = await getOwnerName(tx, pendingTransfer.fromType, pendingTransfer.fromId);
      const toName = await getOwnerName(tx, toType, toId);
      const cancelledByName = req.user.firstName && req.user.lastName
        ? `${req.user.firstName} ${req.user.lastName}`
        : req.user.email || null;

      // Récupérer la date d'expiration du premier lot source (ou date par défaut)
      const firstValidLot = pendingTransfer.lots.find((tl) => tl.lot);
      const lotExpiration = firstValidLot 
        ? firstValidLot.lot.expiration 
        : (pendingLot?.expiration || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000));
      const lotStatus = firstValidLot 
        ? firstValidLot.lot.status 
        : (pendingLot?.status || LOT_STATUS.VALID);

      // Enregistrer dans l'historique avec le statut CANCELLED
      await tx.stockTransferHistory.create({
        data: {
          vaccineId: pendingTransfer.vaccineId,
          vaccineName: pendingTransfer.vaccine.name,
          fromType: pendingTransfer.fromType,
          fromId: pendingTransfer.fromId,
          fromName: fromName,
          toType: toType,
          toId: toId,
          toName: toName,
          quantity: pendingTransfer.quantity,
          sentAt: pendingTransfer.createdAt,
          confirmedAt: new Date(), // Date d'annulation
          confirmedById: req.user.id,
          confirmedByName: cancelledByName,
          lotExpiration: lotExpiration,
          lotStatus: lotStatus,
          status: "CANCELLED",
        },
      });

      // Supprimer le transfert en attente après enregistrement dans l'historique
      await tx.pendingStockTransfer.delete({
        where: { id: transferId },
      });
    });

    // Répondre immédiatement
    res.json({
      success: true,
      message: "Transfert refusé. Les quantités ont été restaurées.",
    });

    // Enregistrer l'événement
    if (transferDataForNotification) {
      logEventAsync({
        type: "STOCK_TRANSFER",
        subtype: toType === OWNER_TYPES.REGIONAL ? "REGIONAL" : toType === OWNER_TYPES.DISTRICT ? "DISTRICT" : "HEALTHCENTER",
        action: "TRANSFER_REJECTED",
        user: {
          id: req.user.id,
          firstName: req.user.firstName,
          lastName: req.user.lastName,
          email: req.user.email,
          role: req.user.role,
        },
        entityType: "STOCK",
        entityId: transferId,
        entityName: transferDataForNotification.vaccineName,
        details: {
          fromType: transferDataForNotification.fromType,
          fromId: transferDataForNotification.fromId,
          toType: transferDataForNotification.toType,
          toId: transferDataForNotification.toId,
          quantity: transferDataForNotification.quantity,
          vaccineId: transferDataForNotification.vaccineId,
        },
      });
    }

    // Envoyer notification à l'expéditeur en arrière-plan (non bloquant)
    setImmediate(async () => {
      try {
        const { sendTransferRejectedEmail } = require("../services/emailService");
        
        if (transferDataForNotification) {
          const fromName = await getOwnerName(prisma, transferDataForNotification.fromType, transferDataForNotification.fromId);
          const toName = await getOwnerName(prisma, transferDataForNotification.toType, transferDataForNotification.toId);
          
          // Récupérer les utilisateurs expéditeurs
          let senderUsers = [];
          if (transferDataForNotification.fromType === OWNER_TYPES.NATIONAL) {
            senderUsers = await prisma.user.findMany({
              where: { role: "NATIONAL", isActive: true },
              select: { id: true, email: true },
            });
          } else if (transferDataForNotification.fromType === OWNER_TYPES.REGIONAL) {
            senderUsers = await prisma.user.findMany({
              where: { role: "REGIONAL", regionId: transferDataForNotification.fromId, isActive: true },
              select: { id: true, email: true },
            });
          } else if (transferDataForNotification.fromType === OWNER_TYPES.DISTRICT) {
            senderUsers = await prisma.user.findMany({
              where: { role: "DISTRICT", districtId: transferDataForNotification.fromId, isActive: true },
              select: { id: true, email: true },
            });
          }

          if (senderUsers.length > 0) {
            const emails = senderUsers.map((u) => u.email).filter(Boolean);
            const userIds = senderUsers.map((u) => u.id).filter(Boolean);
            if (emails.length > 0) {
              await sendTransferRejectedEmail({
                emails,
                userIds,
                vaccineName: transferDataForNotification.vaccineName,
                quantity: transferDataForNotification.quantity,
                fromName: fromName || "Expéditeur",
                toName: toName || "Destinataire",
              });
            }
          }
        }
      } catch (emailError) {
        console.error("Erreur envoi email refus transfert:", emailError);
        // Ne pas bloquer la réponse si l'email échoue
      }
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ message: error.message });
    }
    next(error);
  }
};

// Annuler un transfert en attente (expéditeur)
const cancelPendingTransfer = async (req, res, next) => {
  if (!["SUPERADMIN", "NATIONAL", "REGIONAL", "DISTRICT"].includes(req.user.role)) {
    return res.status(403).json({ message: "Accès refusé" });
  }

  try {
    const { transferId } = req.params;

    // Vérifier les permissions selon le rôle
    let fromId = null;
    let fromType = null;

    if (req.user.role === "NATIONAL") {
      fromType = OWNER_TYPES.NATIONAL;
      fromId = null;
    } else if (req.user.role === "REGIONAL") {
      fromId = await resolveRegionIdForUser(req.user);
      if (!fromId) {
        return res.status(400).json({ message: "Votre compte n'est pas rattaché à une région" });
      }
      fromType = OWNER_TYPES.REGIONAL;
    } else if (req.user.role === "DISTRICT") {
      fromId = await resolveDistrictIdForUser(req.user);
      if (!fromId) {
        return res.status(400).json({ message: "Votre compte n'est pas rattaché à un district" });
      }
      fromType = OWNER_TYPES.DISTRICT;
    }
    // Pour SUPERADMIN, fromId et fromType seront déterminés depuis le transfert lui-même

    // Stocker les données pour les notifications avant la transaction
    let transferDataForNotification = null;

    await prisma.$transaction(async (tx) => {
      // Vérifier que le transfert existe et appartient à cet utilisateur
      const pendingTransfer = await tx.pendingStockTransfer.findUnique({
        where: { id: transferId },
        include: {
          vaccine: true,
          lots: {
            include: {
              lot: true,
            },
          },
        },
      });

      if (!pendingTransfer) {
        throw Object.assign(new Error("Transfert introuvable"), { status: 404 });
      }

      // Pour SUPERADMIN, utiliser les informations du transfert
      if (req.user.role === "SUPERADMIN") {
        fromType = pendingTransfer.fromType;
        fromId = pendingTransfer.fromId;
      } else {
        // Pour les autres rôles, vérifier que le transfert leur appartient
        if (pendingTransfer.fromType !== fromType || pendingTransfer.fromId !== fromId) {
          throw Object.assign(new Error("Ce transfert ne vous appartient pas"), { status: 403 });
        }
      }

      if (pendingTransfer.status !== "PENDING") {
        throw Object.assign(
          new Error(`Ce transfert a déjà été ${pendingTransfer.status === "CONFIRMED" ? "confirmé" : "annulé"}`),
          { status: 400 },
        );
      }

      // Stocker les données pour les notifications
      transferDataForNotification = {
        vaccineId: pendingTransfer.vaccineId,
        vaccineName: pendingTransfer.vaccine.name,
        fromType: pendingTransfer.fromType,
        fromId: pendingTransfer.fromId,
        toType: pendingTransfer.toType,
        toId: pendingTransfer.toId,
        quantity: pendingTransfer.quantity,
      };

      // Supprimer le lot vide PENDING au destinataire
      const normalizedToId = pendingTransfer.toType === OWNER_TYPES.NATIONAL ? null : pendingTransfer.toId;
      const pendingLot = await tx.stockLot.findFirst({
        where: {
          pendingTransferId: transferId,
          status: LOT_STATUS.PENDING,
          ownerType: pendingTransfer.toType,
          ownerId: normalizedToId,
        },
      });

      if (pendingLot) {
        await deleteLotDirect(tx, pendingLot.id);
      }

      // Restaurer ou recréer les lots pour chaque lot du transfert
      // Note: Si le lot source a été supprimé, transferLot.lot sera null
      // Dans ce cas, on recrée le lot avec les informations disponibles
      for (const transferLot of pendingTransfer.lots) {
        if (transferLot.lot) {
          // Le lot existe encore : restaurer la quantité
          await restoreOrRecreateLotForRejectedTransfer(tx, {
            lotId: transferLot.lot.id,
            quantity: transferLot.quantity,
            vaccineId: pendingTransfer.vaccineId,
            ownerType: pendingTransfer.fromType,
            ownerId: pendingTransfer.fromId,
            expiration: transferLot.lot.expiration,
            status: transferLot.lot.status,
          });
        } else {
          // Le lot a été supprimé : recréer le lot
          await restoreOrRecreateLotForRejectedTransfer(tx, {
            lotId: transferLot.lotId, // ID du lot supprimé (pour référence)
            quantity: transferLot.quantity,
            vaccineId: pendingTransfer.vaccineId,
            ownerType: pendingTransfer.fromType,
            ownerId: pendingTransfer.fromId,
            expiration: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // Par défaut 1 an
            status: LOT_STATUS.VALID,
          });
        }
      }

      // Récupérer les informations pour l'historique avant de marquer comme annulé
      const fromName = await getOwnerName(tx, pendingTransfer.fromType, pendingTransfer.fromId);
      const toName = await getOwnerName(tx, pendingTransfer.toType, pendingTransfer.toId);
      const cancelledByName = req.user.firstName && req.user.lastName
        ? `${req.user.firstName} ${req.user.lastName}`
        : req.user.email || null;

      // Récupérer la date d'expiration du premier lot source (ou date par défaut)
      const firstValidLot = pendingTransfer.lots.find((tl) => tl.lot);
      const lotExpiration = firstValidLot 
        ? firstValidLot.lot.expiration 
        : (pendingLot?.expiration || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000));
      const lotStatus = firstValidLot 
        ? firstValidLot.lot.status 
        : (pendingLot?.status || LOT_STATUS.VALID);

      // Enregistrer dans l'historique avec le statut CANCELLED
      await tx.stockTransferHistory.create({
        data: {
          vaccineId: pendingTransfer.vaccineId,
          vaccineName: pendingTransfer.vaccine.name,
          fromType: pendingTransfer.fromType,
          fromId: pendingTransfer.fromId,
          fromName: fromName,
          toType: pendingTransfer.toType,
          toId: pendingTransfer.toId,
          toName: toName,
          quantity: pendingTransfer.quantity,
          sentAt: pendingTransfer.createdAt,
          confirmedAt: new Date(), // Date d'annulation
          confirmedById: req.user.id,
          confirmedByName: cancelledByName,
          lotExpiration: lotExpiration,
          lotStatus: lotStatus,
          status: "CANCELLED",
        },
      });

      // Supprimer le transfert en attente après enregistrement dans l'historique
      await tx.pendingStockTransfer.delete({
        where: { id: transferId },
      });
    });

    // Répondre immédiatement
    res.json({
      success: true,
      message: "Transfert annulé. Les quantités ont été restaurées.",
    });

    // Enregistrer l'événement
    if (transferDataForNotification) {
      logEventAsync({
        type: "STOCK_TRANSFER",
        subtype: transferDataForNotification.fromType === OWNER_TYPES.NATIONAL ? "NATIONAL" : 
                 transferDataForNotification.fromType === OWNER_TYPES.REGIONAL ? "REGIONAL" : "DISTRICT",
        action: "TRANSFER_REJECTED",
        user: {
          id: req.user.id,
          firstName: req.user.firstName,
          lastName: req.user.lastName,
          email: req.user.email,
          role: req.user.role,
        },
        entityType: "STOCK",
        entityId: transferId,
        entityName: transferDataForNotification.vaccineName,
        details: {
          fromType: transferDataForNotification.fromType,
          fromId: transferDataForNotification.fromId,
          toType: transferDataForNotification.toType,
          toId: transferDataForNotification.toId,
          quantity: transferDataForNotification.quantity,
          vaccineId: transferDataForNotification.vaccineId,
        },
      });
    }

    // Envoyer notification au destinataire en arrière-plan (non bloquant)
    setImmediate(async () => {
      try {
        const { sendTransferCancelledEmail } = require("../services/emailService");
        
        if (transferDataForNotification) {
          const fromName = await getOwnerName(prisma, transferDataForNotification.fromType, transferDataForNotification.fromId);
          const toName = await getOwnerName(prisma, transferDataForNotification.toType, transferDataForNotification.toId);
          
          // Récupérer les utilisateurs destinataires
          let recipientUsers = [];
          if (transferDataForNotification.toType === OWNER_TYPES.REGIONAL) {
            recipientUsers = await prisma.user.findMany({
              where: { role: "REGIONAL", regionId: transferDataForNotification.toId, isActive: true },
              select: { id: true, email: true },
            });
          } else if (transferDataForNotification.toType === OWNER_TYPES.DISTRICT) {
            recipientUsers = await prisma.user.findMany({
              where: { role: "DISTRICT", districtId: transferDataForNotification.toId, isActive: true },
              select: { id: true, email: true },
            });
          } else if (transferDataForNotification.toType === OWNER_TYPES.HEALTHCENTER) {
            recipientUsers = await prisma.user.findMany({
              where: { role: "AGENT", agentLevel: "ADMIN", healthCenterId: transferDataForNotification.toId, isActive: true },
              select: { id: true, email: true },
            });
          }

          if (recipientUsers.length > 0) {
            const emails = recipientUsers.map((u) => u.email).filter(Boolean);
            const userIds = recipientUsers.map((u) => u.id).filter(Boolean);
            if (emails.length > 0) {
              await sendTransferCancelledEmail({
                emails,
                userIds,
                vaccineName: transferDataForNotification.vaccineName,
                quantity: transferDataForNotification.quantity,
                fromName: fromName || "Expéditeur",
                toName: toName || "Destinataire",
              });
            }
          }
        }
      } catch (emailError) {
        console.error("Erreur envoi email annulation transfert:", emailError);
        // Ne pas bloquer la réponse si l'email échoue
      }
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ message: error.message });
    }
    next(error);
  }
};

// Obtenir l'historique des transferts avec filtres et pagination
const getTransferHistory = async (req, res, next) => {
  if (!["SUPERADMIN", "NATIONAL", "REGIONAL", "DISTRICT", "AGENT"].includes(req.user.role)) {
    return res.status(403).json({ message: "Accès refusé" });
  }

  // Pour les agents, seuls les ADMIN et STAFF peuvent voir l'historique
  if (req.user.role === "AGENT" && req.user.agentLevel !== "ADMIN" && req.user.agentLevel !== "STAFF") {
    return res.status(403).json({ message: "Accès refusé" });
  }

  try {
    const {
      page = "1",
      limit = "20",
      vaccineId,
      fromType,
      toType,
      fromId,
      toId,
      sentStartDate,
      sentEndDate,
      confirmedStartDate,
      confirmedEndDate,
      search,
    } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    // Construire la clause where
    const whereClause = {};
    const andConditions = [];

    // Filtre par rôle utilisateur
    let roleFilter = null;
    
    // Pour SUPERADMIN, accepter healthCenterId, districtId ou regionId depuis query params
    const overrideHealthCenterId = req.user.role === "SUPERADMIN" ? req.query.healthCenterId : null;
    const overrideDistrictId = req.user.role === "SUPERADMIN" ? req.query.districtId : null;
    const overrideRegionId = req.user.role === "SUPERADMIN" ? req.query.regionId : null;
    
    if (req.user.role === "REGIONAL" || (req.user.role === "SUPERADMIN" && overrideRegionId && !overrideDistrictId && !overrideHealthCenterId)) {
      const regionId = await resolveRegionIdForUser(req.user, overrideRegionId);
      if (regionId) {
        const roleConditions = [
          { fromType: OWNER_TYPES.REGIONAL, fromId: regionId },
          { toType: OWNER_TYPES.REGIONAL, toId: regionId },
        ];
        // Appliquer les filtres fromType/toType si présents
        if (fromType) {
          roleConditions[0].fromType = fromType;
        }
        if (toType) {
          roleConditions[1].toType = toType;
        }
        roleFilter = { OR: roleConditions };
      } else {
        return res.json({ history: [], total: 0, page: pageNum, limit: limitNum });
      }
    } else if (req.user.role === "DISTRICT" || (req.user.role === "SUPERADMIN" && overrideDistrictId && !overrideHealthCenterId)) {
      const districtId = await resolveDistrictIdForUser(req.user, overrideDistrictId);
      if (districtId) {
        const roleConditions = [
          { fromType: OWNER_TYPES.DISTRICT, fromId: districtId },
          { toType: OWNER_TYPES.DISTRICT, toId: districtId },
        ];
        if (fromType) {
          roleConditions[0].fromType = fromType;
        }
        if (toType) {
          roleConditions[1].toType = toType;
        }
        roleFilter = { OR: roleConditions };
      } else {
        return res.json({ history: [], total: 0, page: pageNum, limit: limitNum });
      }
    } else if (req.user.role === "AGENT" || (req.user.role === "SUPERADMIN" && overrideHealthCenterId)) {
      const healthCenterId = await resolveHealthCenterIdForUser(req.user, overrideHealthCenterId);
      if (healthCenterId) {
        const roleConditions = [
          { fromType: OWNER_TYPES.HEALTHCENTER, fromId: healthCenterId },
          { toType: OWNER_TYPES.HEALTHCENTER, toId: healthCenterId },
        ];
        if (fromType) {
          roleConditions[0].fromType = fromType;
        }
        if (toType) {
          roleConditions[1].toType = toType;
        }
        roleFilter = { OR: roleConditions };
      } else {
        return res.json({ history: [], total: 0, page: pageNum, limit: limitNum });
      }
    }
    // NATIONAL et SUPERADMIN (sans filtre d'entité) peuvent voir tout

    // Ajouter le filtre de rôle si présent
    if (roleFilter) {
      andConditions.push(roleFilter);
    }

    // Filtres additionnels simples (pour NATIONAL et SUPERADMIN sans filtre d'entité)
    if (req.user.role === "NATIONAL" || (req.user.role === "SUPERADMIN" && !overrideRegionId && !overrideDistrictId && !overrideHealthCenterId)) {
      if (vaccineId) {
        whereClause.vaccineId = vaccineId;
      }
      if (fromType) {
        whereClause.fromType = fromType;
      }
      if (toType) {
        whereClause.toType = toType;
      }
      if (fromId) {
        whereClause.fromId = fromId;
      }
      if (toId) {
        whereClause.toId = toId;
      }
    } else {
      // Pour les autres rôles, on peut filtrer par vaccineId et fromId/toId
      if (vaccineId) {
        whereClause.vaccineId = vaccineId;
      }
      if (fromId) {
        whereClause.fromId = fromId;
      }
      if (toId) {
        whereClause.toId = toId;
      }
    }

    // Filtre de recherche
    if (search) {
      const searchConditions = {
        OR: [
          { vaccineName: { contains: search, mode: "insensitive" } },
          { fromName: { contains: search, mode: "insensitive" } },
          { toName: { contains: search, mode: "insensitive" } },
        ],
      };
      andConditions.push(searchConditions);
    }

    // Filtre de date d'envoi
    if (sentStartDate || sentEndDate) {
      const sentDateFilter = {};
      if (sentStartDate) {
        sentDateFilter.gte = new Date(sentStartDate);
      }
      if (sentEndDate) {
        sentDateFilter.lte = new Date(sentEndDate);
      }
      if (Object.keys(sentDateFilter).length > 0) {
        whereClause.sentAt = sentDateFilter;
      }
    }

    // Filtre de date de confirmation
    if (confirmedStartDate || confirmedEndDate) {
      const confirmedDateFilter = {};
      if (confirmedStartDate) {
        confirmedDateFilter.gte = new Date(confirmedStartDate);
      }
      if (confirmedEndDate) {
        confirmedDateFilter.lte = new Date(confirmedEndDate);
      }
      if (Object.keys(confirmedDateFilter).length > 0) {
        whereClause.confirmedAt = confirmedDateFilter;
      }
    }

    // Combiner toutes les conditions
    if (andConditions.length > 0) {
      whereClause.AND = andConditions;
    }

    // Si whereClause est vide, utiliser undefined pour récupérer tous les enregistrements
    const finalWhere = Object.keys(whereClause).length > 0 ? whereClause : undefined;

    const [history, total] = await Promise.all([
      prisma.stockTransferHistory.findMany({
        where: finalWhere,
        orderBy: [
          { sentAt: "desc" }, // Trier par date d'envoi (plus récent en premier)
          { createdAt: "desc" }, // En cas d'égalité, trier par date de création
        ],
        skip,
        take: limitNum,
      }),
      prisma.stockTransferHistory.count({
        where: finalWhere,
      }),
    ]);

    res.json({
      history,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
    });
  } catch (error) {
    next(error);
  }
};

// Adapter getPendingTransfers pour inclure les expéditeurs
const getPendingTransfersForSender = async (req, res, next) => {
  if (!["SUPERADMIN", "NATIONAL", "REGIONAL", "DISTRICT"].includes(req.user.role)) {
    return res.status(403).json({ message: "Accès refusé" });
  }

  try {
    let whereClause = { status: "PENDING" };

    // Pour SUPERADMIN, accepter regionId ou districtId depuis query params pour déterminer le type d'entité
    const overrideRegionId = req.user.role === "SUPERADMIN" ? req.query.regionId : null;
    const overrideDistrictId = req.user.role === "SUPERADMIN" ? req.query.districtId : null;

    if (req.user.role === "NATIONAL" || (req.user.role === "SUPERADMIN" && !overrideRegionId && !overrideDistrictId)) {
      whereClause.fromType = OWNER_TYPES.NATIONAL;
      whereClause.fromId = null;
    } else if (req.user.role === "REGIONAL" || (req.user.role === "SUPERADMIN" && overrideRegionId && !overrideDistrictId)) {
      const regionId = await resolveRegionIdForUser(req.user, overrideRegionId);
      if (!regionId) {
        return res.json({ transfers: [] });
      }
      whereClause.fromType = OWNER_TYPES.REGIONAL;
      whereClause.fromId = regionId;
    } else if (req.user.role === "DISTRICT" || (req.user.role === "SUPERADMIN" && overrideDistrictId)) {
      const districtId = await resolveDistrictIdForUser(req.user, overrideDistrictId);
      if (!districtId) {
        return res.json({ transfers: [] });
      }
      whereClause.fromType = OWNER_TYPES.DISTRICT;
      whereClause.fromId = districtId;
    }

    const transfers = await prisma.pendingStockTransfer.findMany({
      where: whereClause,
      include: {
        vaccine: true,
        lots: {
          include: {
            lot: {
              select: {
                id: true,
                expiration: true,
                quantity: true,
                remainingQuantity: true,
                status: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // Ajouter le nom du destinataire pour chaque transfert
    const transfersWithNames = await Promise.all(
      transfers.map(async (transfer) => {
        const toName = await getOwnerName(prisma, transfer.toType, transfer.toId);
        return {
          ...transfer,
          toName: toName || (transfer.toType === OWNER_TYPES.REGIONAL ? "Région" : 
                            transfer.toType === OWNER_TYPES.DISTRICT ? "District" : 
                            transfer.toType === OWNER_TYPES.HEALTHCENTER ? "Centre de santé" : "Inconnu"),
        };
      })
    );

    res.json({ transfers: transfersWithNames });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createStockNATIONAL,
  createStockREGIONAL,
  createStockDISTRICT,
  createStockHEALTHCENTER,
  addStockDISTRICT,
  addStockHEALTHCENTER,
  addStockNATIONAL,
  addStockREGIONAL,
  reduceStockDISTRICT,
  reduceStockHEALTHCENTER,
  reduceStockNATIONAL,
  reduceStockREGIONAL,
  updateStockDISTRICT,
  updateStockHEALTHCENTER,
  updateStockNATIONAL,
  updateStockREGIONAL,
  getStockNATIONAL,
  listNationalLots,
  listRegionalLots,
  listDistrictLots,
  listHealthCenterLots,
  getStockREGIONAL,
  getStockDISTRICT,
  getStockHEALTHCENTER,
  deleteStockNATIONAL,
  deleteStockREGIONAL,
  deleteStockDISTRICT,
  deleteStockHEALTHCENTER,
  getNationalStockStats,
  getRegionalStockStats,
  getDistrictStockStats,
  getHealthCenterStockStats,
  reduceLotNATIONAL,
  reduceLotREGIONAL,
  reduceLotDISTRICT,
  reduceLotHEALTHCENTER,
  deleteLot,
  getHealthCenterReservations,
  getPendingTransfers,
  getPendingTransfersForSender,
  confirmPendingTransfer,
  rejectPendingTransfer,
  cancelPendingTransfer,
  getTransferHistory,
  getStockHealthCenterDeleteImpact,
  getLotDeleteImpact,
  getLotReduceImpact,
};