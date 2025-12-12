const prisma = require("../config/prismaClient");
const { OWNER_TYPES } = require("../services/stockLotService");

const isNational = (user) => user.role === "NATIONAL";
const isRegional = (user) => user.role === "REGIONAL";

const collectCommuneCascadeData = async (tx, communeId) => {
  const commune = await tx.commune.findUnique({
    where: { id: communeId },
    select: {
      id: true,
      name: true,
      region: { select: { id: true, name: true } },
      district: { select: { id: true, name: true } },
    },
  });

  if (!commune) {
    const error = new Error("Commune introuvable");
    error.status = 404;
    throw error;
  }

  const districts = await tx.district.findMany({
    where: { communeId },
    select: { id: true, name: true },
  });
  const districtIds = districts.map((d) => d.id);

  const healthCenters = districtIds.length
    ? await tx.healthCenter.findMany({
        where: { districtId: { in: districtIds } },
        select: { id: true, name: true },
      })
    : [];
  const healthCenterIds = healthCenters.map((hc) => hc.id);

  const children = healthCenterIds.length
    ? await tx.children.findMany({
        where: { healthCenterId: { in: healthCenterIds } },
        select: { id: true, firstName: true, lastName: true },
      })
    : [];
  const childIds = children.map((c) => c.id);

  const users = await tx.user.findMany({
    where: {
      OR: [
        { districtId: { in: districtIds } },
        { healthCenterId: { in: healthCenterIds } },
      ],
    },
    select: { id: true, firstName: true, lastName: true, role: true },
  });

  const [scheduledCount, dueCount, lateCount, overdueCount, completedCount] =
    childIds.length
      ? await Promise.all([
          tx.childVaccineScheduled.count({ where: { childId: { in: childIds } } }),
          tx.childVaccineDue.count({ where: { childId: { in: childIds } } }),
          tx.childVaccineLate.count({ where: { childId: { in: childIds } } }),
          tx.childVaccineOverdue.count({ where: { childId: { in: childIds } } }),
          tx.childVaccineCompleted.count({ where: { childId: { in: childIds } } }),
        ])
      : [0, 0, 0, 0, 0];

  const stockReservationsCount = childIds.length
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
  const recordCount = recordConditions.length
    ? await tx.record.count({ where: { OR: recordConditions } })
    : 0;

  const lotConditions = [];
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
  const stockLots = lotConditions.length
    ? await tx.stockLot.findMany({
        where: { OR: lotConditions },
        select: { id: true, ownerType: true, ownerId: true, vaccineId: true },
      })
    : [];
  const lotIds = stockLots.map((lot) => lot.id);

  const pendingTransferConditions = [];
  if (districtIds.length) {
    pendingTransferConditions.push(
      { fromType: OWNER_TYPES.DISTRICT, fromId: { in: districtIds } },
      { toType: OWNER_TYPES.DISTRICT, toId: { in: districtIds } },
    );
  }
  if (healthCenterIds.length) {
    pendingTransferConditions.push(
      {
        fromType: OWNER_TYPES.HEALTHCENTER,
        fromId: { in: healthCenterIds },
      },
      { toType: OWNER_TYPES.HEALTHCENTER, toId: { in: healthCenterIds } },
    );
  }
  if (lotIds.length) {
    pendingTransferConditions.push({
      lots: { some: { lotId: { in: lotIds } } },
    });
  }

  const pendingTransfers = pendingTransferConditions.length
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
  const pendingTransferIds = pendingTransfers.map((p) => p.id);

  const vaccineRequestsCount = childIds.length
    ? await tx.vaccineRequest.count({
        where: { childId: { in: childIds } },
      })
    : 0;

  return {
    commune,
    districts,
    healthCenters,
    children,
    users,
    childIds,
    healthCenterIds,
    districtIds,
    lotIds,
    pendingTransferIds,
    stockLots,
    pendingTransfers,
    summary: {
      scheduled: scheduledCount,
      due: dueCount,
      late: lateCount,
      overdue: overdueCount,
      completed: completedCount,
      stockReservations: stockReservationsCount,
      records: recordCount,
      stockLots: stockLots.length,
      pendingTransfers: pendingTransfers.length,
      vaccineRequests: vaccineRequestsCount,
    },
  };
};

const formatCommuneDeletionSummary = (data) => ({
  success: true,
  commune: {
    id: data.commune.id,
    name: data.commune.name,
    region: data.commune.region,
  },
  totals: {
    districts: data.districts.length,
    healthCenters: data.healthCenters.length,
    children: data.children.length,
    users: data.users.length,
    stockLots: data.stockLots.length,
    pendingTransfers: data.pendingTransfers.length,
    stockReservations: data.summary.stockReservations,
    records: data.summary.records,
    vaccineRequests: data.summary.vaccineRequests,
    scheduledVaccines: data.summary.scheduled,
    dueVaccines: data.summary.due,
    lateVaccines: data.summary.late,
    overdueVaccines: data.summary.overdue,
    completedVaccines: data.summary.completed,
  },
  details: {
    districts: data.districts,
    healthCenters: data.healthCenters,
    children: data.children,
    users: data.users,
    stockLots: data.stockLots,
    pendingTransfers: data.pendingTransfers,
  },
});
const listCommunes = async (req, res, next) => {
  try {
    let whereClause = {};

    if (isRegional(req.user)) {
      if (!req.user.regionId) {
        return res.json({ total: 0, items: [] });
      }
      whereClause = { regionId: req.user.regionId };
    } else if (!isNational(req.user)) {
      return res.status(403).json({ message: "Accès refusé" });
    }

    const communes = await prisma.commune.findMany({
      where: whereClause,
      include: {
        region: { select: { id: true, name: true } },
        district: { select: { id: true, name: true } },
      },
      orderBy: { name: "asc" },
    });

    res.json({ total: communes.length, items: communes });
  } catch (error) {
    next(error);
  }
};

const createCommune = async (req, res, next) => {
  try {
    let regionId = req.body.regionId;

    if (isRegional(req.user)) {
      regionId = req.user.regionId;
    } else if (!isNational(req.user)) {
      return res.status(403).json({ message: "Accès refusé" });
    }

    if (!regionId || !req.body.name?.trim()) {
      return res.status(400).json({ message: "Nom et région requis" });
    }

    const commune = await prisma.commune.create({
      data: {
        name: req.body.name.trim(),
        regionId,
      },
      include: {
        region: { select: { id: true, name: true } },
      },
    });

    res.status(201).json(commune);
  } catch (error) {
    next(error);
  }
};

const updateCommune = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, regionId } = req.body ?? {};

    const commune = await prisma.commune.findUnique({
      where: { id },
      include: { region: { select: { id: true } } },
    });

    if (!commune) {
      return res.status(404).json({ message: "Commune introuvable" });
    }

    if (isRegional(req.user)) {
      if (!req.user.regionId || commune.region?.id !== req.user.regionId) {
        return res.status(403).json({ message: "Accès refusé" });
      }
    } else if (!isNational(req.user)) {
      return res.status(403).json({ message: "Accès refusé" });
    }

    const data = {};
    if (typeof name === "string" && name.trim()) {
      data.name = name.trim();
    }
    if (regionId && isNational(req.user)) {
      data.regionId = regionId;
    }

    if (Object.keys(data).length === 0) {
      return res.json(commune);
    }

    const updated = await prisma.commune.update({
      where: { id },
      data,
      include: {
        region: { select: { id: true, name: true } },
      },
    });

    res.json(updated);
  } catch (error) {
    next(error);
  }
};

const deleteCommune = async (req, res, next) => {
  try {
    const { id } = req.params;

    const commune = await prisma.commune.findUnique({
      where: { id },
      select: { regionId: true },
    });

    if (!commune) {
      return res.status(404).json({ message: "Commune introuvable" });
    }

    if (isRegional(req.user)) {
      if (!req.user.regionId || commune.regionId !== req.user.regionId) {
        return res.status(403).json({ message: "Accès refusé" });
      }
    } else if (!isNational(req.user)) {
      return res.status(403).json({ message: "Accès refusé" });
    }

    await prisma.$transaction(async (tx) => {
      const cascadeData = await collectCommuneCascadeData(tx, id);
      const {
        childIds,
        healthCenterIds,
        districtIds,
        lotIds,
        pendingTransferIds,
      } = cascadeData;

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

        await tx.vaccineRequest.deleteMany({
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
        await tx.children.deleteMany({ where: { id: { in: childIds } } });
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

      if (lotIds.length) {
        await tx.stockLot.deleteMany({
          where: { id: { in: lotIds } },
        });
      }

      if (districtIds.length || healthCenterIds.length) {
        const userConditions = [];
        if (districtIds.length) {
          userConditions.push({ districtId: { in: districtIds } });
        }
        if (healthCenterIds.length) {
          userConditions.push({ healthCenterId: { in: healthCenterIds } });
        }
        if (userConditions.length) {
          await tx.user.deleteMany({
            where: { OR: userConditions },
          });
        }
      }

      if (healthCenterIds.length) {
        await tx.stockHEALTHCENTER.deleteMany({
          where: { healthCenterId: { in: healthCenterIds } },
        });
        await tx.healthCenter.deleteMany({
          where: { id: { in: healthCenterIds } },
        });
      }

      if (districtIds.length) {
        await tx.stockDISTRICT.deleteMany({
          where: { districtId: { in: districtIds } },
        });
        await tx.district.deleteMany({
          where: { id: { in: districtIds } },
        });
      }

      await tx.commune.delete({ where: { id } });
    });

    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

const getCommuneDeletionSummary = async (req, res, next) => {
  try {
    const { id } = req.params;

    const commune = await prisma.commune.findUnique({
      where: { id },
      select: { regionId: true },
    });

    if (!commune) {
      return res.status(404).json({ message: "Commune introuvable" });
    }

    if (isRegional(req.user)) {
      if (!req.user.regionId || commune.regionId !== req.user.regionId) {
        return res.status(403).json({ message: "Accès refusé" });
      }
    } else if (!isNational(req.user)) {
      return res.status(403).json({ message: "Accès refusé" });
    }

    const summary = await prisma.$transaction((tx) =>
      collectCommuneCascadeData(tx, id),
    );

    return res.json(formatCommuneDeletionSummary(summary));
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ message: error.message });
    }
    next(error);
  }
};

module.exports = {
  listCommunes,
  createCommune,
  updateCommune,
  deleteCommune,
  getCommuneDeletionSummary,
};