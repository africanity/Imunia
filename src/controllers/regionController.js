const prisma = require("../config/prismaClient");
const { OWNER_TYPES } = require("../services/stockLotService");

const collectRegionCascadeData = async (tx, regionId) => {
  const region = await tx.region.findUnique({
    where: { id: regionId },
    select: { id: true, name: true },
  });

  if (!region) {
    const error = new Error("Région non trouvée");
    error.status = 404;
    throw error;
  }

  const [communes, districts, healthCenters, children] = await Promise.all([
    tx.commune.findMany({
      where: { regionId },
      select: { id: true, name: true },
    }),
    tx.district.findMany({
      where: { commune: { regionId } },
      select: { id: true, name: true },
    }),
    tx.healthCenter.findMany({
      where: { district: { commune: { regionId } } },
      select: { id: true, name: true },
    }),
    tx.children.findMany({
      where: { healthCenter: { district: { commune: { regionId } } } },
      select: { id: true, firstName: true, lastName: true },
    }),
  ]);

  const communeIds = communes.map((item) => item.id);
  const districtIds = districts.map((item) => item.id);
  const healthCenterIds = healthCenters.map((item) => item.id);
  const childIds = children.map((item) => item.id);

  const userConditions = [{ regionId }];
  if (districtIds.length) {
    userConditions.push({ districtId: { in: districtIds } });
  }
  if (healthCenterIds.length) {
    userConditions.push({ healthCenterId: { in: healthCenterIds } });
  }

  const users =
    userConditions.length > 0
      ? await tx.user.findMany({
          where: { OR: userConditions },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            role: true,
            districtId: true,
            healthCenterId: true,
          },
        })
      : [];

  const childVaccinationCounts = {
    scheduled:
      childIds.length > 0
        ? await tx.childVaccineScheduled.count({
            where: { childId: { in: childIds } },
          })
        : 0,
    due:
      childIds.length > 0
        ? await tx.childVaccineDue.count({
            where: { childId: { in: childIds } },
          })
        : 0,
    late:
      childIds.length > 0
        ? await tx.childVaccineLate.count({
            where: { childId: { in: childIds } },
          })
        : 0,
    overdue:
      childIds.length > 0
        ? await tx.childVaccineOverdue.count({
            where: { childId: { in: childIds } },
          })
        : 0,
    completed:
      childIds.length > 0
        ? await tx.childVaccineCompleted.count({
            where: { childId: { in: childIds } },
          })
        : 0,
  };

  const stockReservationsCount =
    childIds.length > 0
      ? await tx.stockReservation.count({
          where: { schedule: { childId: { in: childIds } } },
        })
      : 0;

  const recordConditions = [];
  if (childIds.length) {
    recordConditions.push({ childrenId: { in: childIds } });
  }
  if (healthCenterIds.length) {
    recordConditions.push({ healthCenterId: { in: healthCenterIds } });
  }

  const recordCount =
    recordConditions.length > 0
      ? await tx.record.count({ where: { OR: recordConditions } })
      : 0;

  const lotConditions = [{ ownerType: OWNER_TYPES.REGIONAL, ownerId: regionId }];
  if (districtIds.length) {
    lotConditions.push({
      ownerType: OWNER_TYPES.DISTRICT,
      ownerId: { in: districtIds },
    });
  }
  if (healthCenterIds.length) {
    lotConditions.push({
      ownerType: OWNER_TYPES.HEALTHCENTER,
      ownerId: { in: healthCenterIds },
    });
  }

  const stockLots =
    lotConditions.length > 0
      ? await tx.stockLot.findMany({
          where: { OR: lotConditions },
          select: { id: true, ownerType: true, ownerId: true, vaccineId: true },
        })
      : [];
  const lotIds = stockLots.map((lot) => lot.id);

  const pendingTransferConditions = [];
  pendingTransferConditions.push(
    { fromType: OWNER_TYPES.REGIONAL, fromId: regionId },
    { toType: OWNER_TYPES.REGIONAL, toId: regionId },
  );
  if (districtIds.length) {
    pendingTransferConditions.push(
      { fromType: OWNER_TYPES.DISTRICT, fromId: { in: districtIds } },
      { toType: OWNER_TYPES.DISTRICT, toId: { in: districtIds } },
    );
  }
  if (healthCenterIds.length) {
    pendingTransferConditions.push(
      { fromType: OWNER_TYPES.HEALTHCENTER, fromId: { in: healthCenterIds } },
      { toType: OWNER_TYPES.HEALTHCENTER, toId: { in: healthCenterIds } },
    );
  }
  if (lotIds.length) {
    pendingTransferConditions.push({
      lots: { some: { lotId: { in: lotIds } } },
    });
  }

  const pendingTransfers =
    pendingTransferConditions.length > 0
      ? await tx.pendingStockTransfer.findMany({
          where: { OR: pendingTransferConditions },
          select: {
            id: true,
            vaccineId: true,
            fromType: true,
            fromId: true,
            toType: true,
            toId: true,
            status: true,
          },
        })
      : [];
  const pendingTransferIds = pendingTransfers.map((transfer) => transfer.id);

  return {
    region,
    communes,
    districts,
    healthCenters,
    children,
    users,
    childIds,
    healthCenterIds,
    districtIds,
    communeIds,
    childVaccinationCounts,
    stockReservationsCount,
    recordCount,
    stockLots,
    lotIds,
    lotConditions,
    pendingTransfers,
    pendingTransferIds,
  };
};

const formatRegionDeletionSummary = (data) => ({
  success: true,
  region: data.region,
  totals: {
    communes: data.communes.length,
    districts: data.districts.length,
    healthCenters: data.healthCenters.length,
    children: data.children.length,
    users: data.users.length,
    stockLots: data.stockLots.length,
    pendingTransfers: data.pendingTransfers.length,
    stockReservations: data.stockReservationsCount,
    records: data.recordCount,
    scheduledVaccines: data.childVaccinationCounts.scheduled,
    dueVaccines: data.childVaccinationCounts.due,
    lateVaccines: data.childVaccinationCounts.late,
    overdueVaccines: data.childVaccinationCounts.overdue,
    completedVaccines: data.childVaccinationCounts.completed,
  },
  details: {
    communes: data.communes,
    districts: data.districts,
    healthCenters: data.healthCenters,
    children: data.children,
    users: data.users,
    stockLots: data.stockLots,
    pendingTransfers: data.pendingTransfers,
  },
});


const createRegion = async (req, res, next) => {
  if (!req.user || (req.user.role !== "NATIONAL" && req.user.role !== "SUPERADMIN")) {
    return res.status(403).json({ message: "Accès refusé" });
  }

  if (typeof req.body.name === "undefined" || req.body.name === null) {
    return res.status(400).json({ message: "Le nom de la région est requis" });
  }
  if (typeof req.body.name !== "string" || req.body.name.trim() === "") {
    return res.status(400).json({ message: "Le nom de la région ne peut pas être vide" });
  }

  // 3. Vérification du doublon
  const existing = await prisma.region.findFirst({ where: { name: req.body.name.trim() } });
  if (existing) {
    return res.status(409).json({ message: "Cette région existe déjà" });
  }

  try {
    const newRegion = await prisma.region.create({
      data: {
        name: req.body.name.trim(),
      },
    });

    // Enregistrer l'événement
    const { logEventAsync } = require("../services/eventLogService");
    logEventAsync({
      type: "ENTITY",
      subtype: "REGION",
      action: "CREATE",
      user: {
        id: req.user.id,
        firstName: req.user.firstName,
        lastName: req.user.lastName,
        email: req.user.email,
        role: req.user.role,
      },
      entityType: "REGION",
      entityId: newRegion.id,
      entityName: newRegion.name,
      details: {
        name: newRegion.name,
      },
    });

    res.status(201).json(newRegion);
  } catch (error) {
    next(error);
  }

};

const getRegions = async (req, res, next) => {
  if (req.user.role !== "NATIONAL" && req.user.role !== "SUPERADMIN") {
    return res.status(403).json({ message: "Accès refusé" });
  }

  try {
    const [ regions, total ] = await Promise.all ([
       prisma.region.findMany(),
       prisma.region.count(),
    ]);
    res.json({
      total,
      regions
  });
  } catch (error) {
    next(error);
  }
};

const updateRegion = async (req, res, next) => {
  if (req.user.role !== "NATIONAL" && req.user.role !== "SUPERADMIN") {
    return res.status(403).json({ message: "Accès refusé" });
  }

  try {
    const regionId = req.params.id;
    const region = await prisma.region.findUnique({
      where: { id: regionId },
    });

    if (!region) {
      return res.status(404).json({ message: "Région non trouvée" });
    }

    const oldName = region.name;
    const updatedRegion = await prisma.region.update({
      where: { id: regionId },
      data: { name: req.body.name },
    });

    // Enregistrer l'événement
    const { logEventAsync } = require("../services/eventLogService");
    logEventAsync({
      type: "ENTITY",
      subtype: "REGION",
      action: "UPDATE",
      user: {
        id: req.user.id,
        firstName: req.user.firstName,
        lastName: req.user.lastName,
        email: req.user.email,
        role: req.user.role,
      },
      entityType: "REGION",
      entityId: updatedRegion.id,
      entityName: updatedRegion.name,
      details: {
        before: { name: oldName },
        after: { name: updatedRegion.name },
      },
    });

    res.json(updatedRegion);

  }
  catch (error) {
    next(error);
  }
};

const deleteRegion = async (req, res, next) => {
  if (req.user.role !== "NATIONAL" && req.user.role !== "SUPERADMIN") {
    return res.status(403).json({ message: "Accès refusé" });
  }

  try {
    const regionId = req.params.id;

    // Récupérer les informations de la région avant suppression
    const region = await prisma.region.findUnique({
      where: { id: regionId },
      select: { id: true, name: true },
    });

    if (!region) {
      return res.status(404).json({ message: "Région non trouvée" });
    }

    // Récupérer les données de cascade AVANT la suppression pour le logging
    let cascadeDataForLogging;
    try {
      cascadeDataForLogging = await prisma.$transaction((tx) =>
        collectRegionCascadeData(tx, regionId)
      );
    } catch (err) {
      console.error("Erreur récupération données cascade:", err);
      cascadeDataForLogging = {
        communeIds: [],
        districtIds: [],
        healthCenterIds: [],
        childIds: [],
        lotIds: [],
        pendingTransferIds: [],
      };
    }

    await prisma.$transaction(async (tx) => {
      const cascadeData = await collectRegionCascadeData(tx, regionId);
      const {
        communeIds,
        districtIds,
        healthCenterIds,
        childIds,
        lotConditions,
        lotIds,
        pendingTransferIds,
      } = cascadeData;

      if (childIds.length) {
        await tx.stockReservation.deleteMany({
          where: { schedule: { childId: { in: childIds } } },
        });

        // Supprimer les VaccineRequest avant les enfants
        await tx.vaccineRequest.deleteMany({
          where: { childId: { in: childIds } },
        });

        await tx.childVaccineScheduled.deleteMany({
          where: { childId: { in: childIds } },
        });
        await tx.childVaccineCompleted.deleteMany({
          where: { childId: { in: childIds } },
        });
        await tx.childVaccineDue.deleteMany({
          where: { childId: { in: childIds } },
        });
        await tx.childVaccineLate.deleteMany({
          where: { childId: { in: childIds } },
        });
        await tx.childVaccineOverdue.deleteMany({
          where: { childId: { in: childIds } },
        });
      }

      const recordConditions = [];
      if (childIds.length) {
        recordConditions.push({ childrenId: { in: childIds } });
      }
      if (healthCenterIds.length) {
        recordConditions.push({ healthCenterId: { in: healthCenterIds } });
      }
      if (recordConditions.length) {
        await tx.record.deleteMany({ where: { OR: recordConditions } });
      }

      if (childIds.length) {
        await tx.children.deleteMany({
          where: { id: { in: childIds } },
        });
      }

      if (lotIds.length > 0) {
        const pendingLotConditions = [];
        pendingLotConditions.push({ lotId: { in: lotIds } });
        if (pendingTransferIds.length) {
          pendingLotConditions.push({
            pendingTransferId: { in: pendingTransferIds },
          });
        }

        await tx.pendingStockTransferLot.deleteMany({
          where: { OR: pendingLotConditions },
        });

        await tx.stockTransferLot.deleteMany({
          where: { lotId: { in: lotIds } },
        });
      }

      if (pendingTransferIds.length) {
        await tx.pendingStockTransferLot.deleteMany({
          where: { pendingTransferId: { in: pendingTransferIds } },
        });

        await tx.pendingStockTransfer.deleteMany({
          where: { id: { in: pendingTransferIds } },
        });
      }

      // Maintenant on peut supprimer les lots
      await tx.stockLot.deleteMany({ where: { OR: lotConditions } });

      if (healthCenterIds.length) {
        await tx.stockHEALTHCENTER.deleteMany({
          where: { healthCenterId: { in: healthCenterIds } },
        });
      }

      if (districtIds.length) {
        await tx.stockDISTRICT.deleteMany({
          where: { districtId: { in: districtIds } },
        });
      }

      await tx.stockREGIONAL.deleteMany({
        where: { regionId },
      });

      const userConditions = [{ regionId }];
      if (districtIds.length) {
        userConditions.push({ districtId: { in: districtIds } });
      }
      if (healthCenterIds.length) {
        userConditions.push({ healthCenterId: { in: healthCenterIds } });
      }

      await tx.user.deleteMany({
        where: { OR: userConditions },
      });

      if (healthCenterIds.length) {
        await tx.healthCenter.deleteMany({
          where: { id: { in: healthCenterIds } },
        });
      }

      if (districtIds.length) {
        await tx.district.deleteMany({
          where: { id: { in: districtIds } },
        });
      }

      if (communeIds.length) {
        await tx.commune.deleteMany({
          where: { id: { in: communeIds } },
        });
      }

      await tx.region.delete({
        where: { id: regionId },
      });
    });

    // Enregistrer l'événement avec le résumé de cascade (utiliser les données récupérées avant suppression)
    const { logEventAsync } = require("../services/eventLogService");
    logEventAsync({
      type: "ENTITY",
      subtype: "REGION",
      action: "DELETE",
      user: {
        id: req.user.id,
        firstName: req.user.firstName,
        lastName: req.user.lastName,
        email: req.user.email,
        role: req.user.role,
      },
      entityType: "REGION",
      entityId: region.id,
      entityName: region.name,
      metadata: {
        cascadeSummary: {
          communes: cascadeDataForLogging.communeIds.length,
          districts: cascadeDataForLogging.districtIds.length,
          healthCenters: cascadeDataForLogging.healthCenterIds.length,
          children: cascadeDataForLogging.childIds.length,
          lots: cascadeDataForLogging.lotIds.length,
          pendingTransfers: cascadeDataForLogging.pendingTransferIds.length,
        },
      },
    });

    res.status(204).end();
  } catch (error) {
    next(error);
  }
};

const getRegionDeletionSummary = async (req, res, next) => {
  if (req.user.role !== "NATIONAL" && req.user.role !== "SUPERADMIN") {
    return res.status(403).json({ message: "Accès refusé" });
  }

  try {
    const regionId = req.params.id;
    const cascadeData = await prisma.$transaction((tx) =>
      collectRegionCascadeData(tx, regionId),
    );
    res.json(formatRegionDeletionSummary(cascadeData));
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ message: error.message });
    }
    next(error);
  }
};

module.exports = {
  createRegion,
  getRegions,
  updateRegion,
  deleteRegion,
  getRegionDeletionSummary,
};