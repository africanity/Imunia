const prisma = require("../config/prismaClient");

const OWNER_TYPES = {
  NATIONAL: "NATIONAL",
  REGIONAL: "REGIONAL",
  DISTRICT: "DISTRICT",
  HEALTHCENTER: "HEALTHCENTER",
};

const LOT_STATUS = {
  VALID: "VALID",
  EXPIRED: "EXPIRED",
};

const normalizeOwnerId = (ownerType, ownerId) =>
  ownerType === OWNER_TYPES.NATIONAL ? null : ownerId ?? null;

const ownerKey = (ownerType, ownerId, vaccineId) =>
  `${ownerType}::${ownerId ?? "root"}::${vaccineId}`;

const determineStatusFromExpiration = (expirationDate) => {
  const now = new Date();
  return expirationDate <= now ? LOT_STATUS.EXPIRED : LOT_STATUS.VALID;
};

const ensurePositiveInteger = (value, fieldName) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    const error = new Error(
      fieldName
        ? `${fieldName} doit être un entier positif`
        : "La valeur doit être un entier positif",
    );
    error.status = 400;
    throw error;
  }
  return parsed;
};

const getDbClient = (tx) => tx ?? prisma;

const updateNearestExpiration = async (
  tx,
  { vaccineId, ownerType, ownerId },
) => {
  // Le champ nearestExpiration a été supprimé du schéma
  // Cette fonction est conservée pour la compatibilité mais ne fait rien
  return;
};

const createLot = async (
  tx,
  {
    vaccineId,
    ownerType,
    ownerId,
    quantity,
    expiration,
    sourceLotId = null,
    status,
  },
) => {
  const db = getDbClient(tx);
  const expirationDate = new Date(expiration);
  if (Number.isNaN(expirationDate.getTime())) {
    const error = new Error("Date d'expiration invalide");
    error.status = 400;
    throw error;
  }

  if (!Number.isFinite(quantity) || quantity <= 0) {
    const error = new Error("La quantité du lot doit être positive");
    error.status = 400;
    throw error;
  }

  const lotStatus = status ?? determineStatusFromExpiration(expirationDate);

  const lot = await db.stockLot.create({
    data: {
      vaccineId,
      ownerType,
      ownerId: normalizeOwnerId(ownerType, ownerId),
      quantity,
      remainingQuantity: quantity,
      expiration: expirationDate,
      status: lotStatus,
      sourceLotId,
    },
  });

  await updateNearestExpiration(db, { vaccineId, ownerType, ownerId });

  return lot;
};

const consumeLots = async (
  tx,
  { vaccineId, ownerType, ownerId, quantity },
) => {
  const db = getDbClient(tx);
  const normalizedOwnerId = normalizeOwnerId(ownerType, ownerId);
  const qty = Number(quantity);

  if (!Number.isFinite(qty) || qty <= 0) {
    const error = new Error("La quantité demandée doit être positive");
    error.status = 400;
    throw error;
  }

  const lots = await db.stockLot.findMany({
    where: {
      vaccineId,
      ownerType,
      ownerId: normalizedOwnerId,
      status: LOT_STATUS.VALID,
      remainingQuantity: { gt: 0 },
    },
    orderBy: {
      expiration: "asc",
    },
  });

  let remaining = qty;
  const allocations = [];

  for (const lot of lots) {
    if (remaining <= 0) break;
    if (lot.remainingQuantity <= 0) continue;

    const take = Math.min(remaining, lot.remainingQuantity);
    if (take <= 0) continue;

    await db.stockLot.update({
      where: { id: lot.id },
      data: { remainingQuantity: lot.remainingQuantity - take },
    });

    allocations.push({
      lotId: lot.id,
      quantity: take,
      expiration: lot.expiration,
      status: lot.status,
    });

    remaining -= take;
  }

  if (remaining > 0) {
    const error = new Error(
      "Quantité insuffisante dans les lots disponibles pour ce stock",
    );
    error.status = 400;
    throw error;
  }

  await updateNearestExpiration(db, { vaccineId, ownerType, ownerId });

  return allocations;
};

const recordTransfer = async (
  tx,
  { vaccineId, fromType, fromId, toType, toId, allocations },
) => {
  const db = getDbClient(tx);

  if (!allocations?.length) {
    return null;
  }

  const totalQuantity = allocations.reduce(
    (sum, allocation) => sum + allocation.quantity,
    0,
  );

  const transfer = await db.stockTransfer.create({
    data: {
      vaccineId,
      fromType,
      fromId: normalizeOwnerId(fromType, fromId),
      toType,
      toId: normalizeOwnerId(toType, toId),
      quantity: totalQuantity,
      lots: {
        create: allocations.map((allocation) => ({
          lotId: allocation.lotId,
          quantity: allocation.quantity,
        })),
      },
    },
    include: {
      lots: true,
    },
  });

  return transfer;
};

const refreshExpiredLots = async (tx) => {
  const db = getDbClient(tx);
  const now = new Date();

  const expiredLots = await db.stockLot.findMany({
    where: {
      status: LOT_STATUS.VALID,
      expiration: {
        lt: now,
      },
    },
  });

  if (!expiredLots.length) {
    return [];
  }

  const expiredIds = expiredLots.map((lot) => lot.id);

  await db.stockLot.updateMany({
    where: { id: { in: expiredIds } },
    data: { status: LOT_STATUS.EXPIRED },
  });

  const combos = new Map();
  expiredLots.forEach((lot) => {
    combos.set(
      ownerKey(lot.ownerType, lot.ownerId, lot.vaccineId),
      {
        ownerType: lot.ownerType,
        ownerId: lot.ownerId,
        vaccineId: lot.vaccineId,
      },
    );
  });

  for (const combo of combos.values()) {
    await updateNearestExpiration(db, combo);
  }

  return expiredLots;
};

const modifyStockQuantity = async (
  tx,
  { vaccineId, ownerType, ownerId, delta },
) => {
  const db = getDbClient(tx);
  if (!Number.isFinite(delta) || delta === 0) {
    return null;
  }

  switch (ownerType) {
    case OWNER_TYPES.NATIONAL: {
      const stock = await db.stockNATIONAL.findUnique({
        where: { vaccineId },
      });
      if (!stock) return null;
      const base = stock.quantity ?? 0;
      const updated = Math.max(0, base + delta);
      await db.stockNATIONAL.update({
        where: { vaccineId },
        data: { quantity: updated },
      });
      return updated;
    }
    case OWNER_TYPES.REGIONAL: {
      const regionId = normalizeOwnerId(ownerType, ownerId);
      if (!regionId) return null;
      const stock = await db.stockREGIONAL.findUnique({
        where: {
          vaccineId_regionId: {
            vaccineId,
            regionId,
          },
        },
      });
      if (!stock) return null;
      const base = stock.quantity ?? 0;
      const updated = Math.max(0, base + delta);
      await db.stockREGIONAL.update({
        where: {
          vaccineId_regionId: {
            vaccineId,
            regionId,
          },
        },
        data: { quantity: updated },
      });
      return updated;
    }
    case OWNER_TYPES.DISTRICT: {
      const districtId = normalizeOwnerId(ownerType, ownerId);
      if (!districtId) return null;
      const stock = await db.stockDISTRICT.findUnique({
        where: {
          vaccineId_districtId: {
            vaccineId,
            districtId,
          },
        },
      });
      if (!stock) return null;
      const base = stock.quantity ?? 0;
      const updated = Math.max(0, base + delta);
      await db.stockDISTRICT.update({
        where: {
          vaccineId_districtId: {
            vaccineId,
            districtId,
          },
        },
        data: { quantity: updated },
      });
      return updated;
    }
    case OWNER_TYPES.HEALTHCENTER: {
      const healthCenterId = normalizeOwnerId(ownerType, ownerId);
      if (!healthCenterId) return null;
      const stock = await db.stockHEALTHCENTER.findUnique({
        where: {
          vaccineId_healthCenterId: {
            vaccineId,
            healthCenterId,
          },
        },
      });
      if (!stock) return null;
      const base = stock.quantity ?? 0;
      const updated = Math.max(0, base + delta);
      await db.stockHEALTHCENTER.update({
        where: {
          vaccineId_healthCenterId: {
            vaccineId,
            healthCenterId,
          },
        },
        data: { quantity: updated },
      });
      return updated;
    }
    default:
      return null;
  }
};

const deleteLotCascade = async (tx, lotId) => {
  const db = getDbClient(tx);
  const stack = [{ id: lotId, depth: 0 }];
  const visited = new Set();
  const collected = [];
  const pendingTransfersToCheck = new Set();

  while (stack.length) {
    const { id, depth } = stack.pop();
    if (visited.has(id)) continue;

    const lot = await db.stockLot.findUnique({
      where: { id },
      include: {
        derivedLots: {
          select: { id: true },
        },
      },
    });

    if (!lot) continue;
    visited.add(id);
    collected.push({ lot, depth });

    const relatedPendingLots = await db.pendingStockTransferLot.findMany({
      where: { lotId: lot.id },
      select: { pendingTransferId: true },
    });

    if (relatedPendingLots.length) {
      relatedPendingLots.forEach(({ pendingTransferId }) => {
        if (pendingTransferId) {
          pendingTransfersToCheck.add(pendingTransferId);
        }
      });

      await db.pendingStockTransferLot.deleteMany({
        where: { lotId: lot.id },
      });
    }

    await db.stockReservation.deleteMany({
      where: { stockLotId: lot.id },
    });

    for (const child of lot.derivedLots) {
      stack.push({ id: child.id, depth: depth + 1 });
    }
  }

  if (!collected.length) {
    return [];
  }

  collected.sort((a, b) => b.depth - a.depth);

  const lotIds = collected.map(({ lot }) => lot.id);

  await db.stockTransferLot.deleteMany({
    where: {
      lotId: { in: lotIds },
    },
  });

  const combos = new Map();

  for (const { lot } of collected) {
    if (lot.remainingQuantity > 0) {
      await modifyStockQuantity(db, {
        vaccineId: lot.vaccineId,
        ownerType: lot.ownerType,
        ownerId: lot.ownerId,
        delta: -lot.remainingQuantity,
      });
    }

    combos.set(
      ownerKey(lot.ownerType, lot.ownerId, lot.vaccineId),
      {
        ownerType: lot.ownerType,
        ownerId: lot.ownerId,
        vaccineId: lot.vaccineId,
      },
    );

    await db.stockLot.delete({
      where: { id: lot.id },
    });
  }

  for (const combo of combos.values()) {
    await updateNearestExpiration(db, combo);
  }

  if (pendingTransfersToCheck.size) {
    for (const pendingTransferId of pendingTransfersToCheck) {
      const remainingLots = await db.pendingStockTransferLot.count({
        where: { pendingTransferId },
      });

      if (remainingLots === 0) {
        await db.pendingStockTransfer.delete({
          where: { id: pendingTransferId },
        });
      }
    }
  }

  return collected.map(({ lot }) => lot.id);
};

const reserveDoseForHealthCenter = async (
  tx,
  { vaccineId, healthCenterId, quantity = 1, appointmentDate = null },
) => {
  const db = getDbClient(tx);
  if (!healthCenterId) {
    const error = new Error("Centre de santé invalide pour la réservation");
    error.status = 400;
    throw error;
  }

  const qty = ensurePositiveInteger(quantity, "La quantité réservée");

  const stock = await db.stockHEALTHCENTER.findUnique({
    where: {
      vaccineId_healthCenterId: {
        vaccineId,
        healthCenterId,
      },
    },
    select: {
      quantity: true,
    },
  });

  const available = stock?.quantity ?? 0;
  if (available < qty) {
    const error = new Error("Stock insuffisant pour ce vaccin");
    error.status = 400;
    throw error;
  }

  // Si une date de rendez-vous est fournie, on vérifie que le lot ne sera pas expiré
  const appointmentDateObj = appointmentDate
    ? new Date(appointmentDate)
    : null;
  const appointmentDateOnly = appointmentDateObj
    ? new Date(
        appointmentDateObj.getFullYear(),
        appointmentDateObj.getMonth(),
        appointmentDateObj.getDate(),
      )
    : null;

  // Chercher un lot valide qui ne sera pas expiré au moment du rendez-vous
  // On utilise 'gt' (greater than) pour s'assurer que le lot est encore valide le jour du rendez-vous
  const lot = await db.stockLot.findFirst({
    where: {
      vaccineId,
      ownerType: OWNER_TYPES.HEALTHCENTER,
      ownerId: healthCenterId,
      status: LOT_STATUS.VALID,
      remainingQuantity: { gt: 0 },
      ...(appointmentDateOnly
        ? {
            expiration: {
              gt: appointmentDateOnly,
            },
          }
        : {}),
    },
    orderBy: {
      expiration: "asc",
    },
  });

  if (!lot || lot.remainingQuantity < qty) {
      // Vérifier s'il y a des lots valides mais qui seront expirés avant ou le jour du rendez-vous
      if (appointmentDateOnly) {
        const validButExpiredLot = await db.stockLot.findFirst({
          where: {
            vaccineId,
            ownerType: OWNER_TYPES.HEALTHCENTER,
            ownerId: healthCenterId,
            status: LOT_STATUS.VALID,
            remainingQuantity: { gt: 0 },
            expiration: {
              lte: appointmentDateOnly,
            },
          },
        });

        if (validButExpiredLot) {
          const error = new Error(
            "Le stock restant sera expiré avant le rendez-vous programmé",
          );
          error.status = 400;
          throw error;
        }
      }

    const expiredLot = await db.stockLot.findFirst({
      where: {
        vaccineId,
        ownerType: OWNER_TYPES.HEALTHCENTER,
        ownerId: healthCenterId,
        status: LOT_STATUS.EXPIRED,
        remainingQuantity: { gt: 0 },
      },
    });

    const error = new Error(
      expiredLot
        ? "Tous les lots disponibles pour ce vaccin sont expirés"
        : "Impossible de réserver ce vaccin car aucun lot disponible",
    );
    error.status = 400;
    throw error;
  }

  const newQuantity = available - qty;
  await db.stockHEALTHCENTER.update({
    where: {
      vaccineId_healthCenterId: {
        vaccineId,
        healthCenterId,
      },
    },
    data: {
      quantity: newQuantity,
    },
  });

  await db.stockLot.update({
    where: { id: lot.id },
    data: { remainingQuantity: { decrement: qty } },
  });

  await updateNearestExpiration(db, {
    vaccineId,
    ownerType: OWNER_TYPES.HEALTHCENTER,
    ownerId: healthCenterId,
  });

  return {
    lotId: lot.id,
    quantity: qty,
  };
};

const releaseDoseForHealthCenter = async (
  tx,
  { vaccineId, healthCenterId, lotId, quantity = 1 },
) => {
  const db = getDbClient(tx);
  if (!healthCenterId || !lotId) {
    return null;
  }

  const qty = ensurePositiveInteger(quantity, "La quantité libérée");

  await db.stockLot.update({
    where: { id: lotId },
    data: { remainingQuantity: { increment: qty } },
  });

  const stock = await db.stockHEALTHCENTER.findUnique({
    where: {
      vaccineId_healthCenterId: {
        vaccineId,
        healthCenterId,
      },
    },
    select: { quantity: true },
  });

  if (stock) {
    const nextQuantity = (stock.quantity ?? 0) + qty;
    await db.stockHEALTHCENTER.update({
      where: {
        vaccineId_healthCenterId: {
          vaccineId,
          healthCenterId,
        },
      },
      data: { quantity: nextQuantity },
    });
  } else {
    await db.stockHEALTHCENTER.create({
      data: {
        vaccineId,
        healthCenterId,
        quantity: qty,
      },
    });
  }

  await updateNearestExpiration(db, {
    vaccineId,
    ownerType: OWNER_TYPES.HEALTHCENTER,
    ownerId: healthCenterId,
  });

  return true;
};

module.exports = {
  OWNER_TYPES,
  LOT_STATUS,
  createLot,
  consumeLots,
  recordTransfer,
  refreshExpiredLots,
  deleteLotCascade,
  updateNearestExpiration,
  modifyStockQuantity,
  reserveDoseForHealthCenter,
  releaseDoseForHealthCenter,
};

