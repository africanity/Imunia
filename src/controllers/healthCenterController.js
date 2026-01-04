const prisma = require("../config/prismaClient");
const { OWNER_TYPES } = require("../services/stockLotService");

const ensureDistrictUser = (user) => {
  if (user.role !== "DISTRICT") {
    const error = new Error("Accès refusé");
    error.status = 403;
    throw error;
  }
  if (!user.districtId) {
    const error = new Error("Votre compte n'est pas rattaché à un district");
    error.status = 400;
    throw error;
  }
};

const resolveHealthCenterIdForUser = async (user) => {
  if (user.healthCenterId) {
    return user.healthCenterId;
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { healthCenterId: true },
  });

  return dbUser?.healthCenterId ?? null;
};

const listHealthCenters = async (req, res, next) => {
  try {
    let whereClause = {};

    // Pour SUPERADMIN, accepter districtId depuis query params
    const overrideDistrictId = req.user.role === "SUPERADMIN" ? req.query.districtId : null;

    if (req.user.role === "DISTRICT") {
      if (!req.user.districtId) {
        return res.json({ total: 0, items: [] });
      }
      whereClause = { districtId: req.user.districtId };
    } else if (req.user.role === "SUPERADMIN" && overrideDistrictId) {
      // Filtrer par districtId pour le superadmin
      whereClause = { districtId: overrideDistrictId };
    } else if (req.user.role === "AGENT") {
      const healthCenterId = await resolveHealthCenterIdForUser(req.user);
      if (!healthCenterId) {
        return res.json({ total: 0, items: [] });
      }
      whereClause = { id: healthCenterId };
    } else if (!["SUPERADMIN", "NATIONAL", "REGIONAL"].includes(req.user.role)) {
      return res.status(403).json({ message: "Accès refusé" });
    }
    // Si SUPERADMIN sans districtId, REGIONAL ou NATIONAL : voir tous les centres (whereClause reste vide)

    const centers = await prisma.healthCenter.findMany({
      where: whereClause,
      include: {
        district: {
          select: {
            id: true,
            name: true,
            commune: {
              select: {
                id: true,
                name: true,
                region: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
      orderBy: { name: "asc" },
    });

    res.json({ total: centers.length, items: centers });
  } catch (error) {
    next(error);
  }
};

const createHealthCenter = async (req, res, next) => {
  try {
    let districtId = req.body.districtId;

    // Pour SUPERADMIN, accepter districtId depuis le body
    if (req.user.role !== "SUPERADMIN") {
      try {
        ensureDistrictUser(req.user);
        districtId = req.user.districtId;
      } catch (error) {
        if (error.status) {
          return res.status(error.status).json({ message: error.message });
        }
        throw error;
      }
    }

    const { name, address } = req.body ?? {};

    if (!name?.trim() || !address?.trim()) {
      return res.status(400).json({ message: "Nom et adresse requis" });
    }

    if (!districtId) {
      return res.status(400).json({ message: "District requis" });
    }

    const center = await prisma.healthCenter.create({
      data: {
        name: name.trim(),
        address: address.trim(),
        districtId,
      },
      include: {
        district: {
          select: {
            id: true,
            name: true,
            commune: {
              select: {
                id: true,
                name: true,
                region: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
    });

    res.status(201).json(center);
  } catch (error) {
    next(error);
  }
};

const updateHealthCenter = async (req, res, next) => {
  try {
    try {
      ensureDistrictUser(req.user);
    } catch (error) {
      if (error.status) {
        return res.status(error.status).json({ message: error.message });
      }
      throw error;
    }

    const { id } = req.params;
    const { name, address } = req.body ?? {};

    const center = await prisma.healthCenter.findUnique({
      where: { id },
    });

    if (!center || center.districtId !== req.user.districtId) {
      return res.status(center ? 403 : 404).json({ message: center ? "Accès refusé" : "Centre introuvable" });
    }

    const data = {};
    if (typeof name === "string" && name.trim()) {
      data.name = name.trim();
    }
    if (typeof address === "string" && address.trim()) {
      data.address = address.trim();
    }

    if (Object.keys(data).length === 0) {
      return res.json(center);
    }

    const updated = await prisma.healthCenter.update({
      where: { id },
      data,
      include: {
        district: {
          select: {
            id: true,
            name: true,
            commune: {
              select: {
                id: true,
                name: true,
                region: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
    });

    res.json(updated);
  } catch (error) {
    next(error);
  }
};

const deleteHealthCenter = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Pour SUPERADMIN, pas de vérification de district
    if (req.user.role !== "SUPERADMIN") {
      try {
        ensureDistrictUser(req.user);
      } catch (error) {
        if (error.status) {
          return res.status(error.status).json({ message: error.message });
        }
        throw error;
      }

      const center = await prisma.healthCenter.findUnique({ where: { id } });

      if (!center || center.districtId !== req.user.districtId) {
        return res.status(center ? 403 : 404).json({ message: center ? "Accès refusé" : "Centre introuvable" });
      }
    } else {
      // Pour SUPERADMIN, vérifier juste que le centre existe
      const center = await prisma.healthCenter.findUnique({ where: { id } });
      if (!center) {
        return res.status(404).json({ message: "Centre introuvable" });
      }
    }

    await prisma.$transaction(async (tx) => {
      const cascadeData = await collectHealthCenterCascadeData(tx, id);
      const { childIds, lotIds, pendingTransferIds } = cascadeData;

      if (childIds.length) {
        await tx.stockReservation.deleteMany({
          where: { schedule: { childId: { in: childIds } } },
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

      const recordConditions = [{ healthCenterId: id }];
      if (childIds.length) {
        recordConditions.push({ childrenId: { in: childIds } });
      }
      await tx.record.deleteMany({ where: { OR: recordConditions } });

      if (childIds.length) {
        await tx.children.deleteMany({
          where: { id: { in: childIds } },
        });
      }

      if (lotIds.length || pendingTransferIds.length) {
        const pendingLotConditions = [];
        if (lotIds.length) {
          pendingLotConditions.push({ lotId: { in: lotIds } });
        }
        if (pendingTransferIds.length) {
          pendingLotConditions.push({
            pendingTransferId: { in: pendingTransferIds },
          });
        }
        if (pendingLotConditions.length) {
          await tx.pendingStockTransferLot.deleteMany({
            where: { OR: pendingLotConditions },
          });
        }

        if (lotIds.length) {
          await tx.stockTransferLot.deleteMany({
            where: { lotId: { in: lotIds } },
          });
        }

        if (pendingTransferIds.length) {
          await tx.pendingStockTransfer.deleteMany({
            where: { id: { in: pendingTransferIds } },
          });
        }
      }

      await tx.stockLot.deleteMany({
        where: {
          ownerType: OWNER_TYPES.HEALTHCENTER,
          ownerId: id,
        },
      });

      await tx.stockHEALTHCENTER.deleteMany({
        where: { healthCenterId: id },
      });

      await tx.user.deleteMany({
        where: { healthCenterId: id },
      });

      await tx.healthCenter.delete({ where: { id } });
    });

    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

const collectHealthCenterCascadeData = async (tx, healthCenterId) => {
  const center = await tx.healthCenter.findUnique({
    where: { id: healthCenterId },
    select: {
      id: true,
      name: true,
      districtId: true,
      district: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  if (!center) {
    const error = new Error("Centre introuvable");
    error.status = 404;
    throw error;
  }

  const children = await tx.children.findMany({
    where: { healthCenterId },
    select: { id: true, firstName: true, lastName: true },
  });
  const childIds = children.map((item) => item.id);

  const users = await tx.user.findMany({
    where: { healthCenterId },
    select: { id: true, firstName: true, lastName: true, role: true },
  });

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

  const recordCount =
    childIds.length > 0
      ? await tx.record.count({ where: { childrenId: { in: childIds } } })
      : 0;

  const stockLots = await tx.stockLot.findMany({
    where: {
      ownerType: OWNER_TYPES.HEALTHCENTER,
      ownerId: healthCenterId,
    },
    select: { id: true, vaccineId: true },
  });
  const lotIds = stockLots.map((lot) => lot.id);

  const pendingTransferConditions = [
    { fromType: OWNER_TYPES.HEALTHCENTER, fromId: healthCenterId },
    { toType: OWNER_TYPES.HEALTHCENTER, toId: healthCenterId },
  ];
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
    healthCenter: center,
    children,
    users,
    stockLots,
    pendingTransfers,
    childVaccinationCounts,
    stockReservationsCount,
    recordCount,
    childIds,
    lotIds,
    pendingTransferIds,
  };
};

const formatHealthCenterDeletionSummary = (data) => ({
  success: true,
  healthCenter: data.healthCenter,
  totals: {
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
    children: data.children,
    users: data.users,
    stockLots: data.stockLots,
    pendingTransfers: data.pendingTransfers,
  },
});

const getHealthCenterDeletionSummary = async (req, res, next) => {
  try {
    // Pour SUPERADMIN, pas de vérification de district
    if (req.user.role !== "SUPERADMIN") {
      try {
        ensureDistrictUser(req.user);
      } catch (error) {
        if (error.status) {
          return res.status(error.status).json({ message: error.message });
        }
        throw error;
      }
    }

    const { id } = req.params;
    const summary = await prisma.$transaction((tx) =>
      collectHealthCenterCascadeData(tx, id),
    );

    // Pour SUPERADMIN, pas de vérification de district
    if (req.user.role !== "SUPERADMIN" && summary.healthCenter.districtId !== req.user.districtId) {
      return res.status(403).json({ message: "Accès refusé" });
    }

    res.json(formatHealthCenterDeletionSummary(summary));
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ message: error.message });
    }
    next(error);
  }
};

module.exports = {
  listHealthCenters,
  createHealthCenter,
  updateHealthCenter,
  deleteHealthCenter,
  getHealthCenterDeletionSummary,
};