const prisma = require("../config/prismaClient");
const { OWNER_TYPES } = require("../services/stockLotService");

const ensureRegional = (user) => {
  if (user.role !== "REGIONAL") {
    const error = new Error("Accès refusé");
    error.status = 403;
    throw error;
  }
  if (!user.regionId) {
    const error = new Error("Region non définie pour cet utilisateur");
    error.status = 400;
    throw error;
  }
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
    const error = new Error("Accès refusé à ce district");
    error.status = 403;
    throw error;
  }

  return district;
};

const ensureCommuneBelongsToRegion = async (communeId, regionId) => {
  const commune = await prisma.commune.findUnique({
    where: { id: communeId },
    select: { regionId: true },
  });

  if (!commune) {
    const error = new Error("Commune introuvable");
    error.status = 404;
    throw error;
  }

  if (commune.regionId !== regionId) {
    const error = new Error("Commune hors de votre région");
    error.status = 403;
    throw error;
  }
};

const collectDistrictCascadeData = async (tx, districtId) => {
  const district = await tx.district.findUnique({
    where: { id: districtId },
    select: {
      id: true,
      name: true,
      commune: {
        select: {
          id: true,
          name: true,
          regionId: true,
        },
      },
    },
  });

  if (!district) {
    const error = new Error("District introuvable");
    error.status = 404;
    throw error;
  }

  const healthCenters = await tx.healthCenter.findMany({
    where: { districtId },
    select: { id: true, name: true },
  });
  const healthCenterIds = healthCenters.map((item) => item.id);

  const children =
    healthCenterIds.length > 0
      ? await tx.children.findMany({
          where: { healthCenterId: { in: healthCenterIds } },
          select: { id: true, firstName: true, lastName: true },
        })
      : [];
  const childIds = children.map((item) => item.id);

  const users = await tx.user.findMany({
    where: {
      OR: [
        { districtId },
        ...(healthCenterIds.length
          ? [{ healthCenterId: { in: healthCenterIds } }]
          : []),
      ],
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      role: true,
      healthCenterId: true,
    },
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

  const lotConditions = [
    { ownerType: OWNER_TYPES.DISTRICT, ownerId: districtId },
  ];
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

  const pendingTransferConditions = [
    { fromType: OWNER_TYPES.DISTRICT, fromId: districtId },
    { toType: OWNER_TYPES.DISTRICT, toId: districtId },
  ];
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
    district,
    healthCenters,
    children,
    users,
    stockLots,
    pendingTransfers,
    childVaccinationCounts,
    stockReservationsCount,
    recordCount,
    healthCenterIds,
    childIds,
    lotIds,
    pendingTransferIds,
  };
};

const formatDistrictDeletionSummary = (data) => ({
  success: true,
  district: {
    id: data.district.id,
    name: data.district.name,
    commune: data.district.commune,
  },
  totals: {
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
    healthCenters: data.healthCenters,
    children: data.children,
    users: data.users,
    stockLots: data.stockLots,
    pendingTransfers: data.pendingTransfers,
  },
});

const listDistricts = async (req, res, next) => {
  try {
    let whereClause = {};

    if (req.user.role === "REGIONAL") {
      if (!req.user.regionId) {
        return res.json({ total: 0, items: [] });
      }
      whereClause = {
        commune: {
          regionId: req.user.regionId,
        },
      };
    } else if (req.user.role !== "NATIONAL") {
      return res.status(403).json({ message: "Accès refusé" });
    }

    const districts = await prisma.district.findMany({
      where: whereClause,
      include: {
        commune: {
          select: {
            id: true,
            name: true,
            region: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { name: "asc" },
    });

    res.json({
      total: districts.length,
      items: districts,
    });
  } catch (error) {
    next(error);
  }
};

const createDistrict = async (req, res, next) => {
  try {
    ensureRegional(req.user);

    const { name, communeId } = req.body ?? {};

    if (!name?.trim() || !communeId) {
      return res.status(400).json({ message: "Nom et commune requis" });
    }

    await ensureCommuneBelongsToRegion(communeId, req.user.regionId);

    // Vérifier si la commune a déjà un district
    const existingDistrict = await prisma.district.findUnique({
      where: { communeId },
      include: {
        commune: {
          select: {
            name: true,
          },
        },
      },
    });

    if (existingDistrict) {
      return res.status(400).json({
        message: `La commune "${existingDistrict.commune.name}" a déjà un district associé (${existingDistrict.name}). Une commune ne peut avoir qu'un seul district.`,
      });
    }

    const district = await prisma.district.create({
      data: {
        name: name.trim(),
        communeId,
      },
      include: {
        commune: {
          select: {
            id: true,
            name: true,
            region: { select: { id: true, name: true } },
          },
        },
      },
    });

    res.status(201).json(district);
  } catch (error) {
    // Gérer aussi l'erreur de contrainte unique au cas où
    if (error.code === "P2002") {
      return res.status(400).json({
        message: "Cette commune a déjà un district associé. Une commune ne peut avoir qu'un seul district.",
      });
    }
    next(error);
  }
};

const updateDistrict = async (req, res, next) => {
  try {
    ensureRegional(req.user);

    const { id } = req.params;
    const { name, communeId } = req.body ?? {};

    const district = await ensureDistrictBelongsToRegion(id, req.user.regionId);

    const updateData = {};

    if (typeof name === "string" && name.trim()) {
      updateData.name = name.trim();
    }

    if (communeId && communeId !== district.communeId) {
      await ensureCommuneBelongsToRegion(communeId, req.user.regionId);
      
      // Vérifier si la nouvelle commune a déjà un district
      const existingDistrict = await prisma.district.findUnique({
        where: { communeId },
        include: {
          commune: {
            select: {
              name: true,
            },
          },
        },
      });

      if (existingDistrict) {
        return res.status(400).json({
          message: `La commune "${existingDistrict.commune.name}" a déjà un district associé (${existingDistrict.name}). Une commune ne peut avoir qu'un seul district.`,
        });
      }

      updateData.communeId = communeId;
    }

    if (Object.keys(updateData).length === 0) {
      return res.json(district);
    }

    const updated = await prisma.district.update({
      where: { id },
      data: updateData,
      include: {
        commune: {
          select: {
            id: true,
            name: true,
            region: { select: { id: true, name: true } },
          },
        },
      },
    });

    res.json(updated);
  } catch (error) {
    // Gérer l'erreur de contrainte unique au cas où
    if (error.code === "P2002") {
      return res.status(400).json({
        message: "Cette commune a déjà un district associé. Une commune ne peut avoir qu'un seul district.",
      });
    }
    next(error);
  }
};

const deleteDistrict = async (req, res, next) => {
  try {
    ensureRegional(req.user);

    const { id } = req.params;
    await ensureDistrictBelongsToRegion(id, req.user.regionId);

    await prisma.$transaction(async (tx) => {
      const cascadeData = await collectDistrictCascadeData(tx, id);
      const {
        childIds,
        healthCenterIds,
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

      const lotConditions = [{ ownerType: OWNER_TYPES.DISTRICT, ownerId: id }];
      if (healthCenterIds.length) {
        lotConditions.push({
          ownerType: OWNER_TYPES.HEALTHCENTER,
          ownerId: { in: healthCenterIds },
        });
      }

      await tx.stockLot.deleteMany({
        where: { OR: lotConditions },
      });

      if (healthCenterIds.length) {
        await tx.stockHEALTHCENTER.deleteMany({
          where: { healthCenterId: { in: healthCenterIds } },
        });
      }

      await tx.stockDISTRICT.deleteMany({
        where: { districtId: id },
      });

      await tx.user.deleteMany({
        where: {
          OR: [
            { districtId: id },
            ...(healthCenterIds.length
              ? [{ healthCenterId: { in: healthCenterIds } }]
              : []),
          ],
        },
      });

      if (healthCenterIds.length) {
        await tx.healthCenter.deleteMany({
          where: { id: { in: healthCenterIds } },
        });
      }

      await tx.district.delete({ where: { id } });
    });

    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

const getDistrictDeletionSummary = async (req, res, next) => {
  try {
    ensureRegional(req.user);
    const { id } = req.params;
    await ensureDistrictBelongsToRegion(id, req.user.regionId);

    const summary = await prisma.$transaction((tx) =>
      collectDistrictCascadeData(tx, id),
    );

    res.json(formatDistrictDeletionSummary(summary));
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ message: error.message });
    }
    next(error);
  }
};

module.exports = {
  listDistricts,
  createDistrict,
  updateDistrict,
  deleteDistrict,
  getDistrictDeletionSummary,
};