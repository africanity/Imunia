const prisma = require("../config/prismaClient");

// Seuils d'expiration en jours (configurables via env)
const EXPIRATION_WARNING_DAYS = process.env.STOCK_EXPIRATION_WARNING_DAYS
  ? process.env.STOCK_EXPIRATION_WARNING_DAYS.split(",").map(Number)
  : [30, 14, 7, 2, 0];

/**
 * Trouve tous les lots valides qui peuvent expirer
 */
const findAllValidLots = async () => {
  const lots = await prisma.stockLot.findMany({
    where: {
      status: "VALID",
      remainingQuantity: { gt: 0 },
      expiration: { gte: new Date() }, // Pas encore expirés
    },
    include: {
      vaccine: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  return lots;
};

/**
 * Calcule les jours restants jusqu'à expiration (en décimal)
 */
const calculateDaysUntilExpiration = (expirationDate) => {
  const now = new Date();
  const expiration = new Date(expirationDate);
  const diffMs = expiration - now;
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  return diffDays;
};

/**
 * Trouve le seuil supérieur le plus proche pour un nombre de jours donné
 * Retourne le plus petit seuil qui est >= jours restants
 * Retourne null si aucun seuil n'est trouvé
 */
const findNextThreshold = (daysRemaining) => {
  // Trier les seuils par ordre croissant pour trouver le plus petit seuil >= jours restants
  const sortedThresholds = [...EXPIRATION_WARNING_DAYS].sort((a, b) => a - b);

  // Trouver le premier seuil qui est >= jours restants (le plus petit seuil supérieur)
  for (const threshold of sortedThresholds) {
    if (daysRemaining <= threshold) {
      // Debug pour le lot spécifique
      if (Math.abs(daysRemaining - 1.45) < 0.1) {
        console.log(`    DEBUG findNextThreshold: jours=${daysRemaining.toFixed(2)}, seuils triés=${sortedThresholds.join(', ')}, retourné=${threshold}`);
      }
      return threshold;
    }
  }

  // Si tous les seuils sont passés (jours restants > tous les seuils), retourner le plus grand
  // Si jours restants < 0 (déjà expiré), retourner le plus petit (0)
  if (daysRemaining < 0) {
    return sortedThresholds[0]; // 0
  }
  return sortedThresholds[sortedThresholds.length - 1]; // Le plus grand (30)
};

/**
 * Identifie les agents concernés par un lot selon son ownerType
 */
const getConcernedAgents = async (lot) => {
  const agents = [];

  switch (lot.ownerType) {
    case "HEALTHCENTER": {
      // Tous les agents du centre de santé
      const healthCenterAgents = await prisma.user.findMany({
        where: {
          role: "AGENT",
          healthCenterId: lot.ownerId,
          isActive: true,
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
        },
      });
      agents.push(...healthCenterAgents);
      break;
    }

    case "DISTRICT": {
      // Agents ADMIN du district
      const districtAgents = await prisma.user.findMany({
        where: {
          role: "AGENT",
          districtId: lot.ownerId,
          agentLevel: "ADMIN",
          isActive: true,
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
        },
      });
      agents.push(...districtAgents);

      // Administrateur du district
      const districtAdmin = await prisma.user.findMany({
        where: {
          role: "DISTRICT",
          districtId: lot.ownerId,
          isActive: true,
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
        },
      });
      agents.push(...districtAdmin);
      break;
    }

    case "REGIONAL": {
      // Administrateurs régionaux
      const regionalAdmins = await prisma.user.findMany({
        where: {
          role: "REGIONAL",
          regionId: lot.ownerId,
          isActive: true,
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
        },
      });
      agents.push(...regionalAdmins);
      break;
    }

    case "NATIONAL": {
      // Administrateurs nationaux
      const nationalAdmins = await prisma.user.findMany({
        where: {
          role: "NATIONAL",
          isActive: true,
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
        },
      });
      agents.push(...nationalAdmins);
      break;
    }
  }

  // Dédupliquer par email
  const uniqueAgents = Array.from(
    new Map(agents.map((agent) => [agent.email, agent])).values()
  );

  return uniqueAgents;
};

/**
 * Vérifie si une notification a déjà été envoyée pour ce lot + agent + type
 */
const hasNotificationBeenSent = async (stockLotId, userId, notificationType) => {
  const existing = await prisma.stockExpirationNotification.findUnique({
    where: {
      stockLotId_userId_notificationType: {
        stockLotId,
        userId,
        notificationType,
      },
    },
  });

  return !!existing;
};

/**
 * Enregistre qu'une notification a été envoyée
 */
const recordNotificationSent = async (
  stockLotId,
  userId,
  expirationDate,
  daysBeforeExpiration,
  notificationType
) => {
  await prisma.stockExpirationNotification.create({
    data: {
      stockLotId,
      userId,
      expirationDate,
      daysBeforeExpiration,
      notificationType,
    },
  });
};

/**
 * Récupère les informations du centre/district/région pour l'email
 */
const getOwnerInfo = async (lot) => {
  switch (lot.ownerType) {
    case "HEALTHCENTER": {
      const healthCenter = await prisma.healthCenter.findUnique({
        where: { id: lot.ownerId },
        select: {
          name: true,
          district: {
            select: {
              name: true,
              commune: {
                select: {
                  name: true,
                  region: {
                    select: {
                      name: true,
                    },
                  },
                },
              },
            },
          },
        },
      });
      return {
        type: "Centre de santé",
        name: healthCenter?.name || "Inconnu",
        location: healthCenter?.district?.commune?.region?.name || "",
      };
    }

    case "DISTRICT": {
      const district = await prisma.district.findUnique({
        where: { id: lot.ownerId },
        select: {
          name: true,
          commune: {
            select: {
              name: true,
              region: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
      });
      return {
        type: "District",
        name: district?.name || "Inconnu",
        location: district?.commune?.region?.name || "",
      };
    }

    case "REGIONAL": {
      const region = await prisma.region.findUnique({
        where: { id: lot.ownerId },
        select: {
          name: true,
        },
      });
      return {
        type: "Région",
        name: region?.name || "Inconnu",
        location: "",
      };
    }

    case "NATIONAL": {
      return {
        type: "National",
        name: "Stock National",
        location: "",
      };
    }

    default:
      return {
        type: "Inconnu",
        name: "Inconnu",
        location: "",
      };
  }
};

module.exports = {
  EXPIRATION_WARNING_DAYS,
  findAllValidLots,
  calculateDaysUntilExpiration,
  findNextThreshold,
  getConcernedAgents,
  hasNotificationBeenSent,
  recordNotificationSent,
  getOwnerInfo,
};

