const bcrypt = require("bcryptjs");
const prisma = require("../config/prismaClient");
const tokenService = require("../services/tokenService");
const { missVaccine } = require("./vaccineController");
const { refreshExpiredLots } = require("../services/stockLotService");
const {
  rebuildAllVaccinationBuckets,
} = require("../services/vaccineBucketService");

const ensureNationalBuckets = async () => {
  await rebuildAllVaccinationBuckets();
};

const login = async (req, res, next) => {
  try {
    const { email, password, role: requestedRole } = req.body ?? {};

    if (!email?.trim() || !password) {
      return res.status(400).json({ message: "Email et mot de passe requis." });
    }

    const includeRelations = {
      region: { select: { id: true, name: true } },
      district: {
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
      },
      healthCenter: {
        select: {
          id: true,
          name: true,
          district: {
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
          },
        },
      },
    };

    let candidateUsers = [];

    if (requestedRole) {
      const user = await prisma.user.findUnique({
        where: {
          email_role: {
            email,
            role: requestedRole,
          },
        },
        include: includeRelations,
      });
      candidateUsers = user ? [user] : [];
    } else {
      candidateUsers = await prisma.user.findMany({
        where: { email },
        include: includeRelations,
      });
    }

    if (!candidateUsers.length) {
      return res.status(401).json({ message: "Identifiants invalides." });
    }

    const matchingUsers = [];
    for (const user of candidateUsers) {
      if (!user.isActive) {
        continue;
      }

      const isValid = await bcrypt.compare(password, user.password);
      if (isValid) {
        matchingUsers.push(user);
      }
    }

    if (!matchingUsers.length) {
      return res.status(401).json({ message: "Identifiants invalides." });
    }

    if (matchingUsers.length > 1 && !requestedRole) {
      return res.json({
        requiresRoleSelection: true,
        roles: matchingUsers.map((user) => ({
          role: user.role,
          agentLevel: user.agentLevel,
          region: user.region
            ? { id: user.region.id, name: user.region.name }
            : null,
          district: user.district
            ? { id: user.district.id, name: user.district.name }
            : null,
          healthCenter: user.healthCenter
            ? { id: user.healthCenter.id, name: user.healthCenter.name }
            : null,
        })),
      });
    }

    const user = matchingUsers[0];

    // Valider que l'utilisateur a les relations requises selon son rôle
    if (user.role === "AGENT" && !user.healthCenterId) {
      return res.status(403).json({
        message: "Compte incomplet : l'agent doit être associé à un centre de santé.",
      });
    }

    if (user.role === "DISTRICT" && !user.district) {
      return res.status(403).json({
        message: "Compte incomplet : l'utilisateur DISTRICT doit être associé à un district.",
      });
    }

    if (user.role === "REGIONAL" && !user.region) {
      return res.status(403).json({
        message: "Compte incomplet : l'utilisateur REGIONAL doit être associé à une région.",
      });
    }

    let expiredLotsSummary = [];

    if (user.role === "NATIONAL") {
      await ensureNationalBuckets();
      const expiredLots = await refreshExpiredLots();
      expiredLotsSummary = expiredLots.map((lot) => ({
        id: lot.id,
        vaccineId: lot.vaccineId,
        expiration: lot.expiration,
        remainingQuantity: lot.remainingQuantity,
      }));
    }

    if (user.role === "AGENT" && typeof missVaccine.forPlanner === "function") {
      const planId = user.id;
      missVaccine.forPlanner(planId).catch((error) =>
        console.error(
          "[login] missVaccine.forPlanner failed",
          { plannerId: planId },
          error,
        ),
      );

      if (user.healthCenterId) {
        missVaccine
          .forHealthCenter(user.healthCenterId)
          .catch((error) =>
            console.error(
              "[login] missVaccine.forHealthCenter failed",
              { healthCenterId: user.healthCenterId },
              error,
            ),
          );
      }
    }

    const payload = {
      sub: user.id,
      role: user.role,
      agentLevel: user.agentLevel,
    };

    const accessToken = tokenService.signAccessToken(payload);
    const refreshToken = tokenService.signRefreshToken(payload);

    res.json({ accessToken, refreshToken, expiredLots: expiredLotsSummary });
  } catch (error) {
    next(error);
  }
};

const logout = async (req, res, next) => {
  try {
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

module.exports = {
  login,
  logout,
};