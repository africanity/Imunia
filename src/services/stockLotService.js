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
  PENDING: "PENDING",
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
    pendingTransferId = null,
  },
) => {
  const db = getDbClient(tx);
  const expirationDate = new Date(expiration);
  if (Number.isNaN(expirationDate.getTime())) {
    const error = new Error("Date d'expiration invalide");
    error.status = 400;
    throw error;
  }

  // Permettre quantity: 0 uniquement pour les lots PENDING
  const isPending = status === LOT_STATUS.PENDING;
  if (!Number.isFinite(quantity) || quantity < 0 || (!isPending && quantity <= 0)) {
    const error = new Error("La quantité du lot doit être positive (ou 0 pour PENDING)");
    error.status = 400;
    throw error;
  }

  // Déterminer le statut : si un statut est fourni explicitement, l'utiliser
  // Sinon, déterminer selon la date d'expiration
  // MAIS : si la date est expirée, forcer EXPIRED même si PENDING était demandé
  let lotStatus = status ?? determineStatusFromExpiration(expirationDate);
  const now = new Date();
  if (expirationDate <= now && lotStatus !== LOT_STATUS.EXPIRED) {
    // Si le lot est expiré, forcer EXPIRED même si PENDING ou VALID était demandé
    lotStatus = LOT_STATUS.EXPIRED;
  }

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
      pendingTransferId,
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

  // Récupérer tous les lots expirés (VALID ou PENDING)
  const expiredLots = await db.stockLot.findMany({
    where: {
      status: { in: [LOT_STATUS.VALID, LOT_STATUS.PENDING] },
      expiration: {
        lt: now,
      },
    },
  });

  if (!expiredLots.length) {
    return [];
  }

  const expiredIds = expiredLots.map((lot) => lot.id);

  // Mettre à jour tous les lots expirés (VALID ou PENDING) en EXPIRED
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

// Supprime un lot directement sans cascade (ne supprime pas les lots dérivés)
const deleteLotDirect = async (tx, lotId) => {
  const db = getDbClient(tx);

  const lot = await db.stockLot.findUnique({
    where: { id: lotId },
  });

  if (!lot) {
    return null;
  }

  // Ne PAS supprimer les références dans les transferts en attente
  // On laisse lotId devenir null grâce à onDelete: SetNull dans le schéma
  // Les snapshots sont conservés dans PendingStockTransferLot pour permettre
  // la restauration lors de l'annulation/rejet du transfert
  // Note: onDelete: SetNull dans le schéma Prisma gère automatiquement la mise à null de lotId

  // Supprimer les références dans les transferts confirmés
  await db.stockTransferLot.deleteMany({
    where: { lotId: lot.id },
  });

  // Supprimer les réservations
  await db.stockReservation.deleteMany({
    where: { stockLotId: lot.id },
  });

  // Ajuster la quantité du stock si le lot a une quantité restante
  if (lot.remainingQuantity > 0) {
    await modifyStockQuantity(db, {
      vaccineId: lot.vaccineId,
      ownerType: lot.ownerType,
      ownerId: lot.ownerId,
      delta: -lot.remainingQuantity,
    });
  }

  // Mettre à jour la date d'expiration la plus proche
  await updateNearestExpiration(db, {
    vaccineId: lot.vaccineId,
    ownerType: lot.ownerType,
    ownerId: lot.ownerId,
  });

  // Supprimer le lot
  // Note: onDelete: SetNull dans le schéma Prisma mettra automatiquement lotId à null
  // dans PendingStockTransferLot, préservant ainsi les snapshots
  await db.stockLot.delete({
    where: { id: lot.id },
  });

  return lot.id;
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

// Restaure ou recrée un lot pour un transfert refusé/annulé
const restoreOrRecreateLotForRejectedTransfer = async (
  tx,
  { lotId, quantity, vaccineId, ownerType, ownerId, expiration, status },
) => {
  const db = getDbClient(tx);
  const normalizedOwnerId = normalizeOwnerId(ownerType, ownerId);

  // 1. Vérifier si le lot parent existe encore
  const existingLot = await db.stockLot.findUnique({
    where: { id: lotId },
  });

  if (existingLot) {
    // Le lot existe : restaurer la quantité
    await db.stockLot.update({
      where: { id: lotId },
      data: {
        remainingQuantity: existingLot.remainingQuantity + quantity,
      },
    });

    // Augmenter le stock - vérifier d'abord si le stock existe, puis créer ou mettre à jour
    // même si le stock a été supprimé
    let stockUpdated = null;
  switch (ownerType) {
      case OWNER_TYPES.NATIONAL: {
        const existingStock = await db.stockNATIONAL.findUnique({
          where: { vaccineId },
        });
        
        if (existingStock) {
          // Le stock existe : incrémenter la quantité
          const result = await db.stockNATIONAL.update({
        where: { vaccineId },
            data: {
              quantity: (existingStock.quantity ?? 0) + quantity,
            },
      });
          stockUpdated = result.quantity;
        } else {
          // Le stock n'existe pas : le créer avec la quantité
          const result = await db.stockNATIONAL.create({
            data: {
              vaccineId,
              quantity: quantity,
            },
        });
          stockUpdated = result.quantity;
      }
      break;
      }
    case OWNER_TYPES.REGIONAL: {
        if (!normalizedOwnerId) {
          throw new Error("regionId est requis pour un stock régional");
        }
        
        const existingStock = await db.stockREGIONAL.findUnique({
        where: {
          vaccineId_regionId: {
            vaccineId,
            regionId: normalizedOwnerId,
          },
        },
      });
        
        if (existingStock) {
          // Le stock existe : incrémenter la quantité
          const result = await db.stockREGIONAL.update({
            where: {
              vaccineId_regionId: {
                vaccineId,
                regionId: normalizedOwnerId,
              },
            },
            data: {
              quantity: (existingStock.quantity ?? 0) + quantity,
            },
          });
          stockUpdated = result.quantity;
        } else {
          // Le stock n'existe pas : le créer avec la quantité
          const result = await db.stockREGIONAL.create({
          data: {
            vaccineId,
            regionId: normalizedOwnerId,
              quantity: quantity,
          },
        });
          stockUpdated = result.quantity;
      }
      break;
    }
    case OWNER_TYPES.DISTRICT: {
        if (!normalizedOwnerId) {
          throw new Error("districtId est requis pour un stock district");
        }
        
        const existingStock = await db.stockDISTRICT.findUnique({
        where: {
          vaccineId_districtId: {
            vaccineId,
            districtId: normalizedOwnerId,
          },
        },
      });
        
        if (existingStock) {
          // Le stock existe : incrémenter la quantité
          const result = await db.stockDISTRICT.update({
            where: {
              vaccineId_districtId: {
                vaccineId,
                districtId: normalizedOwnerId,
              },
            },
            data: {
              quantity: (existingStock.quantity ?? 0) + quantity,
            },
          });
          stockUpdated = result.quantity;
        } else {
          // Le stock n'existe pas : le créer avec la quantité
          const result = await db.stockDISTRICT.create({
          data: {
            vaccineId,
            districtId: normalizedOwnerId,
              quantity: quantity,
          },
        });
          stockUpdated = result.quantity;
      }
      break;
    }
    case OWNER_TYPES.HEALTHCENTER: {
        if (!normalizedOwnerId) {
          throw new Error("healthCenterId est requis pour un stock centre de santé");
        }
        
        const existingStock = await db.stockHEALTHCENTER.findUnique({
        where: {
          vaccineId_healthCenterId: {
            vaccineId,
            healthCenterId: normalizedOwnerId,
          },
        },
      });
        
        if (existingStock) {
          // Le stock existe : incrémenter la quantité
          const result = await db.stockHEALTHCENTER.update({
            where: {
              vaccineId_healthCenterId: {
                vaccineId,
                healthCenterId: normalizedOwnerId,
              },
            },
            data: {
              quantity: (existingStock.quantity ?? 0) + quantity,
            },
          });
          stockUpdated = result.quantity;
        } else {
          // Le stock n'existe pas : le créer avec la quantité
          const result = await db.stockHEALTHCENTER.create({
          data: {
            vaccineId,
            healthCenterId: normalizedOwnerId,
              quantity: quantity,
          },
        });
          stockUpdated = result.quantity;
      }
      break;
    }
  }

    await updateNearestExpiration(db, { vaccineId, ownerType, ownerId });

    return { restored: true, lotId: existingLot.id };
  }

  // 2. Créer un nouveau lot avec la quantité refusée
  const newLot = await createLot(db, {
    vaccineId,
    ownerType,
    ownerId,
    quantity,
    expiration: expiration || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // Par défaut 1 an si pas d'expiration
    status: status || LOT_STATUS.VALID,
    sourceLotId: null, // Pas de source car le lot original a été supprimé
  });

  // 3. Créer ou mettre à jour le stock avec la quantité
  // On vérifie d'abord si le stock existe, puis on le crée ou on le met à jour
  // Cela évite les problèmes potentiels avec upsert dans les transactions
  let stockUpdated = null;
  switch (ownerType) {
    case OWNER_TYPES.NATIONAL: {
      const existingStock = await db.stockNATIONAL.findUnique({
        where: { vaccineId },
      });
      
      if (existingStock) {
        // Le stock existe : incrémenter la quantité
        const result = await db.stockNATIONAL.update({
          where: { vaccineId },
          data: {
            quantity: (existingStock.quantity ?? 0) + quantity,
          },
        });
        stockUpdated = result.quantity;
      } else {
        // Le stock n'existe pas : le créer avec la quantité
        const result = await db.stockNATIONAL.create({
          data: {
    vaccineId,
            quantity: quantity,
          },
        });
        stockUpdated = result.quantity;
      }
      break;
    }
    case OWNER_TYPES.REGIONAL: {
      if (!normalizedOwnerId) {
        // Si normalizedOwnerId est null pour REGIONAL, c'est une erreur
        throw new Error("regionId est requis pour un stock régional");
      }
      
      const existingStock = await db.stockREGIONAL.findUnique({
        where: {
          vaccineId_regionId: {
            vaccineId,
            regionId: normalizedOwnerId,
          },
        },
      });
      
      if (existingStock) {
        // Le stock existe : incrémenter la quantité
        const result = await db.stockREGIONAL.update({
          where: {
            vaccineId_regionId: {
              vaccineId,
              regionId: normalizedOwnerId,
            },
          },
          data: {
            quantity: (existingStock.quantity ?? 0) + quantity,
          },
        });
        stockUpdated = result.quantity;
      } else {
        // Le stock n'existe pas : le créer avec la quantité
        const result = await db.stockREGIONAL.create({
          data: {
            vaccineId,
            regionId: normalizedOwnerId,
            quantity: quantity,
          },
        });
        stockUpdated = result.quantity;
      }
      break;
    }
    case OWNER_TYPES.DISTRICT: {
      if (!normalizedOwnerId) {
        // Si normalizedOwnerId est null pour DISTRICT, c'est une erreur
        throw new Error("districtId est requis pour un stock district");
      }
      
      const existingStock = await db.stockDISTRICT.findUnique({
        where: {
          vaccineId_districtId: {
            vaccineId,
            districtId: normalizedOwnerId,
          },
        },
      });
      
      if (existingStock) {
        // Le stock existe : incrémenter la quantité
        const result = await db.stockDISTRICT.update({
          where: {
            vaccineId_districtId: {
              vaccineId,
              districtId: normalizedOwnerId,
            },
          },
          data: {
            quantity: (existingStock.quantity ?? 0) + quantity,
          },
        });
        stockUpdated = result.quantity;
      } else {
        // Le stock n'existe pas : le créer avec la quantité
        const result = await db.stockDISTRICT.create({
          data: {
            vaccineId,
            districtId: normalizedOwnerId,
            quantity: quantity,
          },
        });
        stockUpdated = result.quantity;
      }
      break;
    }
    case OWNER_TYPES.HEALTHCENTER: {
      if (!normalizedOwnerId) {
        // Si normalizedOwnerId est null pour HEALTHCENTER, c'est une erreur
        throw new Error("healthCenterId est requis pour un stock centre de santé");
      }
      
      const existingStock = await db.stockHEALTHCENTER.findUnique({
        where: {
          vaccineId_healthCenterId: {
            vaccineId,
            healthCenterId: normalizedOwnerId,
          },
        },
      });
      
      if (existingStock) {
        // Le stock existe : incrémenter la quantité
        const result = await db.stockHEALTHCENTER.update({
          where: {
            vaccineId_healthCenterId: {
              vaccineId,
              healthCenterId: normalizedOwnerId,
            },
          },
          data: {
            quantity: (existingStock.quantity ?? 0) + quantity,
          },
        });
        stockUpdated = result.quantity;
      } else {
        // Le stock n'existe pas : le créer avec la quantité
        const result = await db.stockHEALTHCENTER.create({
          data: {
            vaccineId,
            healthCenterId: normalizedOwnerId,
            quantity: quantity,
          },
        });
        stockUpdated = result.quantity;
      }
      break;
    }
  }

  // Mettre à jour la date d'expiration la plus proche
  await updateNearestExpiration(db, { vaccineId, ownerType, ownerId });

  return { restored: false, lotId: newLot.id, created: true };
};

module.exports = {
  OWNER_TYPES,
  LOT_STATUS,
  normalizeOwnerId,
  determineStatusFromExpiration,
  ensurePositiveInteger,
  createLot,
  consumeLots,
  recordTransfer,
  refreshExpiredLots,
  deleteLotCascade,
  deleteLotDirect,
  updateNearestExpiration,
  modifyStockQuantity,
  reserveDoseForHealthCenter,
  releaseDoseForHealthCenter,
  restoreOrRecreateLotForRejectedTransfer,
};

