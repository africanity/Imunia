const bcrypt = require("bcryptjs");
const prisma = require("../config/prismaClient");
const tokenService = require("../services/tokenService");
const { missVaccine } = require("./vaccineController");
const { refreshExpiredLots } = require("../services/stockLotService");
const {
  rebuildAllVaccinationBuckets,
} = require("../services/vaccineBucketService");
const { sendPasswordResetCode } = require("../services/emailService");

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

const refreshToken = async (req, res, next) => {
  try {
    const { refreshToken: token } = req.body;

    if (!token) {
      return res.status(400).json({ message: "Refresh token requis" });
    }

    // Vérifier le refresh token
    let payload;
    try {
      payload = tokenService.verifyRefreshToken(token);
    } catch (error) {
      return res.status(401).json({ message: "Refresh token invalide ou expiré" });
    }

    // Vérifier que l'utilisateur existe toujours
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        role: true,
        agentLevel: true,
        isActive: true,
      },
    });

    if (!user || !user.isActive) {
      return res.status(401).json({ message: "Utilisateur non trouvé ou inactif" });
    }

    // Générer de nouveaux tokens
    const newPayload = {
      sub: user.id,
      role: user.role,
      agentLevel: user.agentLevel,
    };

    const newAccessToken = tokenService.signAccessToken(newPayload);
    const newRefreshToken = tokenService.signRefreshToken(newPayload);

    res.json({
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    });
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

// Demander la réinitialisation de mot de passe
const requestPasswordReset = async (req, res, next) => {
  try {
    const { email } = req.body ?? {};

    if (!email?.trim()) {
      return res.status(400).json({ message: "Email requis." });
    }

    const user = await prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
      select: { id: true, email: true, firstName: true, isActive: true },
    });

    // Ne pas révéler si l'email existe ou non pour des raisons de sécurité
    if (!user || !user.isActive) {
      return res.json({
        message: "Si cet email existe, un code de réinitialisation a été envoyé.",
      });
    }

    // Générer un code à 6 chiffres
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiryDate = new Date();
    expiryDate.setMinutes(expiryDate.getMinutes() + 10); // 10 minutes

    // Sauvegarder le code et réinitialiser les tentatives
    await prisma.user.update({
      where: { id: user.id },
      data: {
        code,
        passwordResetCodeExpiry: expiryDate,
        passwordResetAttempts: 0,
      },
    });

    // Envoyer l'email
    try {
      await sendPasswordResetCode({
        email: user.email,
        code,
        firstName: user.firstName,
      });
    } catch (emailError) {
      console.error("Erreur envoi email code reset:", emailError);
      // Ne pas révéler l'erreur à l'utilisateur
    }

    res.json({
      message: "Si cet email existe, un code de réinitialisation a été envoyé.",
      email: user.email, // Pour le frontend, on peut retourner l'email pour la page suivante
    });
  } catch (error) {
    next(error);
  }
};

// Vérifier le code de réinitialisation
const verifyPasswordResetCode = async (req, res, next) => {
  try {
    const { email, code } = req.body ?? {};

    if (!email?.trim() || !code?.trim()) {
      return res.status(400).json({ message: "Email et code requis." });
    }

    const user = await prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
      select: {
        id: true,
        code: true,
        passwordResetCodeExpiry: true,
        passwordResetAttempts: true,
      },
    });

    if (!user) {
      return res.status(404).json({ message: "Email introuvable." });
    }

    // Vérifier si le code a expiré
    if (!user.passwordResetCodeExpiry || new Date() > user.passwordResetCodeExpiry) {
      return res.status(400).json({
        message: "Le code a expiré. Veuillez demander un nouveau code.",
        expired: true,
      });
    }

    // Vérifier le nombre de tentatives
    if (user.passwordResetAttempts >= 3) {
      return res.status(400).json({
        message: "Nombre maximum de tentatives atteint. Veuillez demander un nouveau code.",
        maxAttemptsReached: true,
      });
    }

    // Vérifier le code
    if (user.code !== code.trim()) {
      // Incrémenter les tentatives
      await prisma.user.update({
        where: { id: user.id },
        data: {
          passwordResetAttempts: user.passwordResetAttempts + 1,
        },
      });

      const remainingAttempts = 3 - (user.passwordResetAttempts + 1);
      return res.status(400).json({
        message: `Code incorrect. Il vous reste ${remainingAttempts} tentative${remainingAttempts > 1 ? "s" : ""}.`,
        remainingAttempts,
      });
    }

    // Code correct, retourner un token temporaire pour la mise à jour du mot de passe
    const resetToken = tokenService.generatePasswordResetToken(user.id);

    res.json({
      message: "Code vérifié avec succès.",
      resetToken,
    });
  } catch (error) {
    next(error);
  }
};

// Renvoyer le code de réinitialisation
const resendPasswordResetCode = async (req, res, next) => {
  try {
    const { email } = req.body ?? {};

    if (!email?.trim()) {
      return res.status(400).json({ message: "Email requis." });
    }

    const user = await prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
      select: { id: true, email: true, firstName: true, isActive: true },
    });

    // Ne pas révéler si l'email existe ou non
    if (!user || !user.isActive) {
      return res.json({
        message: "Si cet email existe, un nouveau code a été envoyé.",
      });
    }

    // Générer un nouveau code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiryDate = new Date();
    expiryDate.setMinutes(expiryDate.getMinutes() + 10); // 10 minutes

    // Sauvegarder le nouveau code et réinitialiser les tentatives
    await prisma.user.update({
      where: { id: user.id },
      data: {
        code,
        passwordResetCodeExpiry: expiryDate,
        passwordResetAttempts: 0,
      },
    });

    // Envoyer l'email
    try {
      await sendPasswordResetCode({
        email: user.email,
        code,
        firstName: user.firstName,
      });
    } catch (emailError) {
      console.error("Erreur envoi email code reset:", emailError);
    }

    res.json({
      message: "Si cet email existe, un nouveau code a été envoyé.",
    });
  } catch (error) {
    next(error);
  }
};

// Mettre à jour le mot de passe après vérification du code
const updatePasswordAfterReset = async (req, res, next) => {
  try {
    const { resetToken, password, confirmPassword } = req.body ?? {};

    if (!resetToken || !password || !confirmPassword) {
      return res.status(400).json({ message: "Token, mot de passe et confirmation requis." });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: "Le mot de passe doit contenir au moins 6 caractères." });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ message: "Les mots de passe ne correspondent pas." });
    }

    // Vérifier et décoder le token
    let userId;
    try {
      const decoded = tokenService.verifyPasswordResetToken(resetToken);
      userId = decoded.userId;
    } catch (tokenError) {
      return res.status(400).json({ message: "Token invalide ou expiré." });
    }

    // Vérifier que l'utilisateur existe et a un code valide
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        passwordResetCodeExpiry: true,
        code: true,
      },
    });

    if (!user) {
      return res.status(404).json({ message: "Utilisateur introuvable." });
    }

    // Vérifier que le code n'a pas expiré
    if (!user.passwordResetCodeExpiry || new Date() > user.passwordResetCodeExpiry) {
      return res.status(400).json({
        message: "Le code a expiré. Veuillez recommencer le processus.",
      });
    }

    // Hasher le nouveau mot de passe
    const hashedPassword = await bcrypt.hash(password, 10);

    // Mettre à jour le mot de passe et nettoyer les champs de réinitialisation
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        code: null,
        passwordResetCodeExpiry: null,
        passwordResetAttempts: 0,
      },
    });

    res.json({
      message: "Mot de passe mis à jour avec succès.",
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  login,
  logout,
  refreshToken,
  requestPasswordReset,
  verifyPasswordResetCode,
  resendPasswordResetCode,
  updatePasswordAfterReset,
};