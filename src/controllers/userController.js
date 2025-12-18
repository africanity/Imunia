const bcrypt = require("bcryptjs");
const prisma = require("../config/prismaClient");
const tokenService = require("../services/tokenService");
const { sendInvitationEmail, sendTwoFactorCode } = require("../services/emailService");

const SALT_ROUNDS = 10;

const respondIfUniqueConstraint = (error, res, defaultMessage) => {
  if (error?.code !== "P2002") {
    return false;
  }

  // Récupérer les informations de la contrainte
  const metaField = error.meta?.target?.[0] ?? error.meta?.field_name;
  const constraintName = error.meta?.constraint;
  const target = error.meta?.target;

  // Messages spécifiques selon le champ
  let message = null;

  // Vérifier si c'est l'email
  if (
    metaField === "email" ||
    (Array.isArray(target) && target.includes("email")) ||
    (typeof constraintName === "string" && constraintName.toLowerCase().includes("email"))
  ) {
    message = "Cet email est déjà utilisé. Veuillez utiliser un autre email.";
  }
  // Vérifier si c'est le téléphone
  else if (
    metaField === "phone" ||
    (Array.isArray(target) && target.includes("phone")) ||
    (typeof constraintName === "string" && constraintName.toLowerCase().includes("phone"))
  ) {
    message = "Ce numéro de téléphone est déjà utilisé. Veuillez utiliser un autre numéro.";
  }
  // Vérifier si c'est le code
  else if (
    metaField === "code" ||
    (Array.isArray(target) && target.includes("code")) ||
    (typeof constraintName === "string" && constraintName.toLowerCase().includes("code"))
  ) {
    message = "Ce code est déjà utilisé. Veuillez utiliser un autre code.";
  }
  // Vérifier si c'est le nom (pour les districts, communes, etc.)
  else if (
    metaField === "name" ||
    (Array.isArray(target) && target.includes("name")) ||
    (typeof constraintName === "string" && constraintName.toLowerCase().includes("name"))
  ) {
    message = "Ce nom est déjà utilisé. Veuillez utiliser un autre nom.";
  }
  // Vérifier les contraintes composites
  else if (constraintName === "User_email_role_key") {
    message = "Cet email est déjà utilisé pour ce rôle.";
  } else if (constraintName === "User_phone_role_key") {
    message = "Ce numéro de téléphone est déjà utilisé pour ce rôle.";
  }
  // Essayer d'extraire le nom du champ depuis le nom de la contrainte
  else if (typeof constraintName === "string") {
    const constraintLower = constraintName.toLowerCase();
    // Extraire le nom du modèle et du champ depuis le nom de la contrainte
    // Format typique: ModelName_fieldName_key ou ModelName_field1_field2_key
    const parts = constraintName.split("_");
    if (parts.length >= 2) {
      // Le champ est généralement le dernier élément avant "key" ou l'avant-dernier
      const fieldCandidate = parts[parts.length - 2] || parts[parts.length - 1];
      const fieldLabels = {
        email: "email",
        phone: "numéro de téléphone",
        code: "code",
        name: "nom",
        communeid: "commune",
        districtid: "district",
        regionid: "région",
        healthcenterid: "centre de santé",
      };
      const label = fieldLabels[fieldCandidate.toLowerCase()];
      if (label) {
        message = `Ce ${label} est déjà utilisé. Veuillez utiliser un autre ${label}.`;
      }
    }
  }
  // Si on a un target array avec un seul élément, essayer de le mapper
  else if (Array.isArray(target) && target.length === 1) {
    const fieldLabels = {
      email: "email",
      phone: "numéro de téléphone",
      code: "code",
      name: "nom",
      communeid: "commune",
      districtid: "district",
      regionid: "région",
      healthcenterid: "centre de santé",
    };
    const label = fieldLabels[target[0].toLowerCase()];
    if (label) {
      message = `Ce ${label} est déjà utilisé. Veuillez utiliser un autre ${label}.`;
    }
  }
  // Si on a un metaField, essayer de le mapper
  else if (metaField) {
    const fieldLabels = {
      email: "email",
      phone: "numéro de téléphone",
      code: "code",
      name: "nom",
      communeid: "commune",
      districtid: "district",
      regionid: "région",
      healthcenterid: "centre de santé",
    };
    const label = fieldLabels[metaField.toLowerCase()];
    if (label) {
      message = `Ce ${label} est déjà utilisé. Veuillez utiliser un autre ${label}.`;
    }
  }

  // Si on n'a toujours pas de message, utiliser un message générique mais informatif
  if (!message) {
    message = "Une des informations saisies est déjà utilisée. Veuillez vérifier et modifier les champs concernés.";
  }

  res.status(409).json({ message });
  return true;
};

/**
 * Détermine quel rôle (et agentLevel) le créateur est autorisé à produire.
 */
const resolveCreationTarget = (creator) => {
  switch (creator.role) {
    case "NATIONAL":
      return { role: "REGIONAL" };
    case "REGIONAL":
      return { role: "DISTRICT" };
    case "DISTRICT":
      return { role: "AGENT", agentLevel: "ADMIN" };
    case "AGENT":
      return creator.agentLevel === "ADMIN"
        ? { role: "AGENT", agentLevel: "STAFF" }
        : null;
    default:
      return null;
  }
};

/**
 * Vérifie les règles de création selon le rôle du créateur.
 */
const assertCreationRules = (creator, data) => {
  const target = resolveCreationTarget(creator);

  if (!target) {
    throw new Error("Vous n'êtes pas autorisé à créer des utilisateurs.");
  }

  data.role = target.role;
  if (target.agentLevel) {
    data.agentLevel = target.agentLevel;
  }

  if (["REGIONAL", "DISTRICT", "AGENT"].includes(data.role) && !data.region) {
    throw new Error("Le champ 'region' est obligatoire pour ce rôle.");
  }

  if (["DISTRICT", "AGENT"].includes(data.role) && !data.healthCenterId) {
    throw new Error("Le champ 'healthCenterId' est obligatoire pour ce rôle.");
  }

  return data;
};

/**
 * POST /api/users — création hiérarchique.
 */
/*
const createUser = async (req, res, next) => {
  try {
    const creator = req.user;
    const payload = { ...req.body };

    delete payload.password;
    delete payload.role;
    delete payload.agentLevel;

    const data = assertCreationRules(creator, payload);
    const { token, expiresAt } = tokenService.generateActivationToken();

    let healthCenterName;
    if (data.healthCenterId) {
      const healthCenter = await prisma.healthCenter.findUnique({
        where: { id: data.healthCenterId },
        select: { name: true },
      });
      healthCenterName = healthCenter?.name;
    }

    let regionName;
    if (data.regionId) {
      const region = await prisma.region.findUnique({
        where: { id: data.regionId },
        select: { name: true },
      });
      regionName = region?.name;
    }

    const user = await prisma.user.create({
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        phone: data.phone,
        code: data.code,
        role: data.role,
        regionId: data.regionId,
        agentLevel: data.agentLevel,
        healthCenterId: data.healthCenterId,
        isActive: false,
        activationToken: token,
        activationExpires: expiresAt,
        password: "", // défini lors de l'activation
      },
    });

    await sendInvitationEmail({
      email: user.email,
      token,
      role: user.role,
      region: regionName,
      healthCenter: healthCenterName,
    });

    res.status(201).json({
      id: user.id,
      role: user.role,
      agentLevel: user.agentLevel,
      email: user.email,
    });
  } catch (error) {
    if (respondIfUniqueConstraint(error, res, "Cette valeur est déjà utilisée.")) {
      return;
    }
    // Gérer les autres erreurs Prisma
    if (error.code === "P2003") {
      return res.status(400).json({
        message: "Une référence invalide a été fournie. Veuillez vérifier les informations saisies.",
      });
    }
    console.error("Erreur création régional:", error);
    next(error);
  }
};
*/


const createRegional = async (req, res, next) => {

  if (req.user.role !== "NATIONAL") {
    return res.status(403).json({ message: "Accès refusé" });
  }  

    if (!req.body.regionId || !req.body.firstName || !req.body.lastName || !req.body.email || !req.body.phone ) {
      return res.status(400).json({ message: "Remplir les champs obligatoires pour ce rôle." });
    }

  try {
    const { token, expiresAt } = tokenService.generateActivationToken();
    const newRegional = await prisma.user.create({
      data: {
        firstName: req.body.firstName,
        lastName: req.body.lastName,
        email: req.body.email,
        phone: req.body.phone,
        role: "REGIONAL",
        regionId: req.body.regionId,
        isActive: false,
        activationToken: token,
        activationExpires: expiresAt,
        password: "", 
      },
    });

    res.status(201).json(newRegional);

    const region = await prisma.region.findUnique({
      where: { id: newRegional.regionId },
      select: { name: true },
    });
    

    try {
      await sendInvitationEmail({
        email: newRegional.email,
        token,
        role: newRegional.role,
        region: region?.name ?? null,
        user: newRegional,
      });
    } catch (emailError) {
      console.error("Erreur envoi email invitation:", emailError);
      // Ne pas bloquer la création si l'email échoue
    }

    /*res.status(201).json({
      user: newRegional.id,
      role: newRegional.role,
      email: newRegional.email,
    });*/
  } catch (error) {
    if (respondIfUniqueConstraint(error, res, "Cette valeur est déjà utilisée.")) {
      return;
    }
    // Gérer les autres erreurs Prisma
    if (error.code === "P2003") {
      return res.status(400).json({
        message: "Une référence invalide a été fournie. Veuillez vérifier les informations saisies.",
      });
    }
    console.error("Erreur création régional:", error);
    next(error);
  }
};


const createDistricit = async (req, res, next) => {
  try {
    if (req.user.role !== "REGIONAL") {
      return res.status(403).json({ message: "Accès refusé" });
    }

    const { firstName, lastName, email, phone, districtId } = req.body ?? {};

    if (!firstName?.trim() || !lastName?.trim() || !email?.trim() || !phone?.trim() || !districtId) {
      return res.status(400).json({ message: "Remplir les champs obligatoires pour ce rôle." });
    }

    if (!req.user.regionId) {
      return res.status(400).json({ message: "Votre compte n'est pas associé à une région." });
    }

    const district = await prisma.district.findUnique({
      where: { id: districtId },
      include: {
        commune: { select: { regionId: true } },
      },
    });

    if (!district) {
      return res.status(404).json({ message: "District introuvable" });
    }

    if (!district.commune || district.commune.regionId !== req.user.regionId) {
      return res.status(403).json({ message: "Ce district n'appartient pas à votre région." });
    }

    const { token, expiresAt } = tokenService.generateActivationToken();

    const newDistrictUser = await prisma.user.create({
      data: {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        role: "DISTRICT",
        regionId: req.user.regionId,
        districtId,
        isActive: false,
        activationToken: token,
        activationExpires: expiresAt,
        password: "",
      },
      include: {
        district: { select: { name: true } },
      },
    });

    res.status(201).json(newDistrictUser);

    try {
      await sendInvitationEmail({
        email: newDistrictUser.email,
        token,
        role: newDistrictUser.role,
        region: null,
        district: newDistrictUser.district?.name ?? null,
        user: newDistrictUser,
      });
    } catch (emailError) {
      console.error("Erreur envoi email invitation:", emailError);
      // Ne pas bloquer la création si l'email échoue
    }
  } catch (error) {
    if (respondIfUniqueConstraint(error, res, "Cette valeur est déjà utilisée.")) {
      return;
    }
    // Gérer les autres erreurs Prisma
    if (error.code === "P2003") {
      return res.status(400).json({
        message: "Une référence invalide a été fournie. Veuillez vérifier les informations saisies.",
      });
    }
    console.error("Erreur création régional:", error);
    next(error);
  }
};

const createAgentAdmin = async (req, res, next) => {
  try {
    if (req.user.role !== "DISTRICT") {
      return res.status(403).json({ message: "Accès refusé" });
    }

    const { firstName, lastName, email, phone, healthCenterId } = req.body ?? {};

    if (!firstName?.trim() || !lastName?.trim() || !email?.trim() || !phone?.trim() || !healthCenterId) {
      return res.status(400).json({ message: "Remplir les champs obligatoires pour ce rôle." });
    }

    if (!req.user.districtId) {
      return res.status(400).json({ message: "Votre compte n'est pas associé à un district." });
    }

    const healthCenter = await prisma.healthCenter.findUnique({
      where: { id: healthCenterId },
      select: { id: true, name: true, districtId: true },
    });

    if (!healthCenter || healthCenter.districtId !== req.user.districtId) {
      return res.status(403).json({ message: "Centre de santé hors de votre district" });
    }

    const { token, expiresAt } = tokenService.generateActivationToken();

    const newAgentAdmin = await prisma.user.create({
      data: {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        role: "AGENT",
        agentLevel: "ADMIN",
        districtId: req.user.districtId,
        healthCenterId,
        isActive: false,
        activationToken: token,
        activationExpires: expiresAt,
        password: "",
      },
      include: {
        healthCenter: { select: { name: true } },
      },
    });

    res.status(201).json(newAgentAdmin);

    try {
      await sendInvitationEmail({
        email: newAgentAdmin.email,
        token,
        role: newAgentAdmin.role,
        healthCenter: newAgentAdmin.healthCenter?.name ?? null,
        user: newAgentAdmin,
      });
    } catch (emailError) {
      console.error("Erreur envoi email invitation:", emailError);
      // Ne pas bloquer la création si l'email échoue
    }
  } catch (error) {
    if (respondIfUniqueConstraint(error, res, "Cette valeur est déjà utilisée.")) {
      return;
    }
    // Gérer les autres erreurs Prisma
    if (error.code === "P2003") {
      return res.status(400).json({
        message: "Une référence invalide a été fournie. Veuillez vérifier les informations saisies.",
      });
    }
    console.error("Erreur création régional:", error);
    next(error);
  }
};

const createAgentStaff = async (req, res, next) => {
  try {
    if (req.user.role !== "AGENT" || req.user.agentLevel !== "ADMIN") {
      return res.status(403).json({ message: "Accès refusé" });
    }

    const { firstName, lastName, email, phone, code, healthCenterId } = req.body ?? {};

    if (!firstName?.trim() || !lastName?.trim() || !email?.trim() || !phone?.trim() || !healthCenterId) {
      return res.status(400).json({ message: "Remplir les champs obligatoires pour ce rôle." });
    }

    if (!req.user.healthCenterId || req.user.healthCenterId !== healthCenterId) {
      return res.status(403).json({ message: "Centre de santé invalide" });
    }

    const { token, expiresAt } = tokenService.generateActivationToken();

    const newAgentStaff = await prisma.user.create({
      data: {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        code: code?.trim() ?? null,
        role: "AGENT",
        healthCenterId,
        districtId: req.user.districtId,
        agentLevel: "STAFF",
        isActive: false,
        activationToken: token,
        activationExpires: expiresAt,
        password: "",
      },
      include: {
        healthCenter: { select: { name: true } },
      },
    });

    res.status(201).json(newAgentStaff);

    try {
      await sendInvitationEmail({
        email: newAgentStaff.email,
        token,
        role: newAgentStaff.role,
        healthCenter: newAgentStaff.healthCenter?.name ?? null,
        user: newAgentStaff,
      });
    } catch (emailError) {
      console.error("Erreur envoi email invitation:", emailError);
      // Ne pas bloquer la création si l'email échoue
    }
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/users/:id/activate — activation + choix du mot de passe.
 */
const activateUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { token, password, confirmPassword } = req.body;

    if (!password || password !== confirmPassword) {
      return res.status(400).json({ message: "Les mots de passe ne correspondent pas." });
    }

    const user = await prisma.user.findUnique({ where: { id } });

    if (!user || user.isActive) {
      return res.status(400).json({ message: "Activation invalide." });
    }

    if (!user.activationToken || user.activationToken !== token) {
      return res.status(400).json({ message: "Token d’activation invalide." });
    }

    if (user.activationExpires && user.activationExpires < new Date()) {
      return res.status(400).json({ message: "Token d’activation expiré." });
    }

    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    await prisma.user.update({
      where: { id },
      data: {
        password: hashedPassword,
        isActive: true,
        activationToken: null,
        activationExpires: null,
      },
    });

    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/users — liste filtrée selon le rôle du demandeur.
 */
const listUsers = async (req, res, next) => {
  try {
    const requester = req.user;
    let where = {};

    if (requester.role === "NATIONAL") {
      // tous les utilisateurs hors nationaux pour éviter la boucle ? on garde tout.
      where = {};
    } else if (requester.role === "REGIONAL") {
      if (!requester.regionId) {
        return res.json([]);
      }

      const districtIds = await prisma.district.findMany({
        where: { commune: { regionId: requester.regionId } },
        select: { id: true },
      });

      if (districtIds.length === 0) {
        return res.json([]);
      }

      where = {
        role: "DISTRICT",
        districtId: { in: districtIds.map((d) => d.id) },
      };
    } else if (requester.role === "DISTRICT") {
      if (!requester.districtId) {
        return res.json([]);
      }

      const healthCenters = await prisma.healthCenter.findMany({
        where: { districtId: requester.districtId },
        select: { id: true },
      });

      if (healthCenters.length === 0) {
        return res.json([]);
      }

      where = {
        role: "AGENT",
        healthCenterId: { in: healthCenters.map((hc) => hc.id) },
      };
    } else if (requester.role === "AGENT" && requester.agentLevel === "ADMIN") {
      if (!requester.healthCenterId) {
        return res.json([]);
      }

      where = {
        role: "AGENT",
        agentLevel: "STAFF",
        healthCenterId: requester.healthCenterId,
      };
    } else {
      return res.json([]);
    }

    const users = await prisma.user.findMany({
      where,
      orderBy: [{ role: "asc" }, { lastName: "asc" }, { firstName: "asc" }],
      select: {
        id: true,
        email: true,
        role: true,
        firstName: true,
        lastName: true,
        phone: true,
        regionId: true,
        districtId: true,
        healthCenterId: true,
        agentLevel: true,
      },
    });

    res.json(users);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/users/health-center/agents — récupérer les agents du centre de santé de l'utilisateur
 */
const getHealthCenterAgents = async (req, res, next) => {
  try {
    if (req.user.role !== "AGENT" || !req.user.healthCenterId) {
      return res.status(403).json({ message: "Accès refusé" });
    }

    const agents = await prisma.user.findMany({
      where: {
        role: "AGENT",
        healthCenterId: req.user.healthCenterId,
        isActive: true,
      },
      orderBy: [
        { agentLevel: "asc" }, // ADMIN en premier
        { lastName: "asc" },
        { firstName: "asc" },
      ],
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        agentLevel: true,
      },
    });

    res.json(agents);
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/users/me — mise à jour du compte.
 */
const updateSelf = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const data = { ...req.body };

    delete data.role;
    delete data.agentLevel;
    delete data.isActive;
    delete data.password;

    if (data.email && data.email !== req.user.email) {
      const { code, expiresAt } = tokenService.generateEmailCode();

      await sendTwoFactorCode({
        email: data.email,
        code,
      });

      data.pendingEmail = data.email;
      data.emailVerificationCode = code;
      data.emailVerificationExpiry = expiresAt;
      data.emailVerified = false;
      delete data.email;
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data,
    });

    res.json(updated);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/users/me/verify-email — validation du code envoyé à la nouvelle adresse.
 */
const verifyEmail = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { code } = req.body;

    const user = await prisma.user.findUnique({ where: { id: userId } });

    const isValid =
      user &&
      user.pendingEmail &&
      user.emailVerificationCode &&
      user.emailVerificationCode === code &&
      user.emailVerificationExpiry &&
      user.emailVerificationExpiry > new Date();

    if (!isValid) {
      return res.status(400).json({ message: "Code de vérification invalide." });
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        email: user.pendingEmail,
        pendingEmail: null,
        emailVerificationCode: null,
        emailVerificationExpiry: null,
        emailVerified: true,
      },
    });

    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/users/:id — suppression avec contrôle hiérarchique.
 */
const collectUserDeletionData = async (tx, userId, existingUser = null) => {
  let userInfo = existingUser;
  if (!userInfo) {
    userInfo = await tx.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
      },
    });
  }

  if (!userInfo) {
    const error = new Error("Utilisateur introuvable.");
    error.status = 404;
    throw error;
  }

  const [
    recordCount,
    scheduledCount,
    completedCount,
    overdueCount,
    childrenCount,
    vaccineRequestsCount,
    pendingTransfersCount,
  ] = await Promise.all([
    tx.record.count({ where: { agentId: userId } }),
    tx.childVaccineScheduled.count({ where: { plannerId: userId } }),
    tx.childVaccineCompleted.count({ where: { administeredById: userId } }),
    tx.childVaccineOverdue.count({ where: { escalatedToId: userId } }),
    tx.children.count({ where: { nextAgentId: userId } }),
    tx.vaccineRequest.count({ where: { scheduledById: userId } }),
    tx.pendingStockTransfer.count({ where: { confirmedById: userId } }),
  ]);

  return {
    user: {
      id: userInfo.id,
      firstName: userInfo.firstName,
      lastName: userInfo.lastName,
      email: userInfo.email,
      role: userInfo.role,
    },
    totals: {
      recordsDeleted: recordCount,
      scheduledPlannerCleared: scheduledCount,
      completedAdminCleared: completedCount,
      overdueEscalationCleared: overdueCount,
      childrenNextAgentCleared: childrenCount,
      vaccineRequestsCleared: vaccineRequestsCount,
      pendingTransfersCleared: pendingTransfersCount,
    },
  };
};

const getUserDeletionSummary = async (req, res, next) => {
  try {
    const requester = req.user;
    const { id } = req.params;

    const target = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
        regionId: true,
        districtId: true,
        healthCenterId: true,
        agentLevel: true,
      },
    });

    if (!target) {
      return res.status(404).json({ message: "Utilisateur introuvable." });
    }

    if (!canDelete(requester, target)) {
      return res.status(403).json({ message: "Action non autorisée." });
    }

    const summary = await prisma.$transaction((tx) =>
      collectUserDeletionData(tx, id, target),
    );

    res.json(summary);
  } catch (error) {
    next(error);
  }
};

const deleteUser = async (req, res, next) => {
  try {
    const requester = req.user;
    const { id } = req.params;

    const target = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        role: true,
        firstName: true,
        lastName: true,
        email: true,
        regionId: true,
        districtId: true,
        healthCenterId: true,
        agentLevel: true,
      },
    });

    if (!target) {
      return res.status(404).json({ message: "Utilisateur introuvable." });
    }

    if (!canDelete(requester, target)) {
      return res.status(403).json({ message: "Action non autorisée." });
    }

    await prisma.$transaction(async (tx) => {
      await collectUserDeletionData(tx, id, target);

      await tx.record.deleteMany({ where: { agentId: id } });
      await tx.childVaccineScheduled.updateMany({
        where: { plannerId: id },
        data: { plannerId: null },
      });
      await tx.childVaccineCompleted.updateMany({
        where: { administeredById: id },
        data: { administeredById: null },
      });
      await tx.childVaccineOverdue.updateMany({
        where: { escalatedToId: id },
        data: { escalatedToId: null },
      });
      await tx.children.updateMany({
        where: { nextAgentId: id },
        data: { nextAgentId: null },
      });
      await tx.vaccineRequest.updateMany({
        where: { scheduledById: id },
        data: { scheduledById: null },
      });
      await tx.pendingStockTransfer.updateMany({
        where: { confirmedById: id },
        data: { confirmedById: null },
      });

      await tx.user.delete({ where: { id } });
    });

    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

/**
 * Vérifie si le demandeur peut supprimer la cible.
 */
const canDelete = (requester, target) => {
  if (requester.role === "NATIONAL") return true;

  if (requester.role === "REGIONAL") {
    return (
      requester.regionId != null &&
      target.role === "DISTRICT" &&
      target.districtId != null &&
      target.regionId === requester.regionId
    );
  }

  if (requester.role === "DISTRICT") {
    return (
      requester.districtId != null &&
      target.role === "AGENT" &&
      target.districtId === requester.districtId
    );
  }

  if (
    requester.role === "AGENT" &&
    requester.agentLevel === "ADMIN" &&
    target.role === "AGENT" &&
    target.agentLevel === "STAFF" &&
    requester.healthCenterId != null &&
    target.healthCenterId === requester.healthCenterId
  ) {
    return true;
  }

  return false;
};

const updateRegional = async (req, res, next) => {

  if (req.user.role !== "NATIONAL") {
    return res.status(403).json({ message: "Accès refusé" });
  }

  try {
    const regionalId = req.params.id;
    const regional = await prisma.user.findUnique({
      where: { id: regionalId },
    });

    if (!regional) {
      return res.status(404).json({ message: "Utilisateur non trouvé" });
    }

    const updatedRegional = await prisma.user.update({
      where: { id: regionalId },
      data: { 
        regionId: req.body.regionId,
       },
    });

    res.json(updatedRegional);

  }
  catch (error) {
    next(error);
  }
};

const updateDistrict = async (req, res, next) => {
  try {
    if (req.user.role !== "REGIONAL") {
      return res.status(403).json({ message: "Accès refusé" });
    }

    const { id } = req.params;
    const { districtId } = req.body ?? {};

    if (!req.user.regionId) {
      return res.status(400).json({ message: "Votre compte n'est pas associé à une région." });
    }

    const districtUser = await prisma.user.findUnique({
      where: { id },
      include: {
        district: {
          include: { commune: { select: { regionId: true } } },
        },
      },
    });

    if (!districtUser || districtUser.role !== "DISTRICT") {
      return res.status(404).json({ message: "Utilisateur non trouvé" });
    }

    if (!districtUser.district || districtUser.district.commune?.regionId !== req.user.regionId) {
      return res.status(403).json({ message: "Vous ne pouvez pas modifier cet utilisateur" });
    }

    const data = {};

    if (districtId && districtId !== districtUser.districtId) {
      const district = await prisma.district.findUnique({
        where: { id: districtId },
        include: { commune: { select: { regionId: true } } },
      });
      if (!district || district.commune?.regionId !== req.user.regionId) {
        return res.status(403).json({ message: "District hors de votre région" });
      }
      data.districtId = districtId;
    }

    if (Object.keys(data).length === 0) {
      return res.json(districtUser);
    }

    const updatedDistrict = await prisma.user.update({
      where: { id },
      data,
      include: { district: { select: { name: true } } },
    });

    res.json(updatedDistrict);
  } catch (error) {
    next(error);
  }
};

const updateAgentAdmin = async (req, res, next) => {
  try {
    if (req.user.role !== "DISTRICT") {
      return res.status(403).json({ message: "Accès refusé" });
    }

    const { id } = req.params;
    const { healthCenterId } = req.body ?? {};

    const agentAdmin = await prisma.user.findUnique({
      where: { id },
      include: {
        healthCenter: { select: { districtId: true } },
      },
    });

    if (!agentAdmin || agentAdmin.role !== "AGENT" || agentAdmin.agentLevel !== "ADMIN") {
      return res.status(404).json({ message: "Utilisateur non trouvé" });
    }

    if (agentAdmin.healthCenter?.districtId !== req.user.districtId) {
      return res.status(403).json({ message: "Vous ne pouvez pas modifier cet utilisateur" });
    }

    if (!healthCenterId) {
      return res.json(agentAdmin);
    }

    const healthCenter = await prisma.healthCenter.findUnique({
      where: { id: healthCenterId },
      select: { districtId: true },
    });

    if (!healthCenter || healthCenter.districtId !== req.user.districtId) {
      return res.status(403).json({ message: "Centre de santé hors de votre district" });
    }

    const updatedAgentAdmin = await prisma.user.update({
      where: { id },
      data: { healthCenterId, districtId: req.user.districtId },
    });

    res.json(updatedAgentAdmin);
  } catch (error) {
    next(error);
  }
};

const updateAgentStaff = async (req, res, next) => {
  try {
    if (req.user.role !== "AGENT" || req.user.agentLevel !== "ADMIN") {
      return res.status(403).json({ message: "Accès refusé" });
    }

    const { id } = req.params;
    const { healthCenterId } = req.body ?? {};

    const agentStaff = await prisma.user.findUnique({
      where: { id },
    });
    if (!agentStaff || agentStaff.role !== "AGENT" || agentStaff.agentLevel !== "STAFF") {
      return res.status(404).json({ message: "Utilisateur non trouvé" });
    }

    if (!req.user.healthCenterId || req.user.healthCenterId !== agentStaff.healthCenterId) {
      return res.status(403).json({ message: "Vous ne pouvez pas modifier cet utilisateur" });
    }

    if (!healthCenterId || healthCenterId !== req.user.healthCenterId) {
      return res.json(agentStaff);
    }

    const updatedAgentStaff = await prisma.user.update({
      where: { id },
      data: { healthCenterId },
    });

    res.json(updatedAgentStaff);
  } catch (error) {
    next(error);
  }
};

const deleteRegional = async (req, res, next) => {

  if (req.user.role !== "NATIONAL") {
    return res.status(403).json({ message: "Accès refusé" });
  }

  try {
    const regionalId = req.params.id;
    const regional = await prisma.user.findUnique({
      where: { id: regionalId },
    });

    if (!regional) {
      return res.status(404).json({ message: "Utilisateur non trouvé" });
    }

    await prisma.user.delete({
      where: { id: regionalId },
    });

    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

const deleteDistrict = async (req, res, next) => {
  try {
    if (req.user.role !== "REGIONAL") {
      return res.status(403).json({ message: "Accès refusé" });
    }

    const { id } = req.params;

    const districtUser = await prisma.user.findUnique({
      where: { id },
      include: {
        district: {
          include: { commune: { select: { regionId: true } } },
        },
      },
    });

    if (!districtUser || districtUser.role !== "DISTRICT") {
      return res.status(404).json({ message: "Utilisateur non trouvé" });
    }

    if (!districtUser.district || districtUser.district.commune?.regionId !== req.user.regionId) {
      return res.status(403).json({ message: "Vous ne pouvez pas supprimer cet utilisateur" });
    }

    await prisma.user.delete({ where: { id } });

    res.status(204).send();
  } catch (error) {
    next(error);
  }
};


const deleteAgentAdmin = async (req, res, next) => {
  try {
    if (req.user.role !== "DISTRICT") {
      return res.status(403).json({ message: "Accès refusé" });
    }

    const { id } = req.params;

    const agentAdmin = await prisma.user.findUnique({
      where: { id },
      include: {
        healthCenter: { select: { districtId: true } },
      },
    });

    if (!agentAdmin || agentAdmin.role !== "AGENT" || agentAdmin.agentLevel !== "ADMIN") {
      return res.status(404).json({ message: "Utilisateur non trouvé" });
    }

    if (agentAdmin.healthCenter?.districtId !== req.user.districtId) {
      return res.status(403).json({ message: "Vous ne pouvez pas supprimer cet utilisateur" });
    }

    await prisma.user.delete({ where: { id } });

    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

const deleteAgentStaff = async (req, res, next) => {
  try {
    if (req.user.role !== "AGENT" || req.user.agentLevel !== "ADMIN") {
      return res.status(403).json({ message: "Accès refusé" });
    }

    const { id } = req.params;

    const agentStaff = await prisma.user.findUnique({
      where: { id },
    });

    if (!agentStaff || agentStaff.role !== "AGENT" || agentStaff.agentLevel !== "STAFF") {
      return res.status(404).json({ message: "Utilisateur non trouvé" });
    }

    if (!req.user.healthCenterId || req.user.healthCenterId !== agentStaff.healthCenterId) {
      return res.status(403).json({ message: "Vous ne pouvez pas supprimer cet utilisateur" });
    }

    await prisma.user.delete({ where: { id } });

    res.status(204).send();
  }
  catch (error) {
    next(error);
  }
};

const getSelf = async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
        agentLevel: true,
        regionId: true,
        districtId: true,
        healthCenterId: true,
        region: {
          select: {
            id: true,
            name: true,
          },
        },
        district: {
          select: {
            id: true,
            name: true,
            commune: {
              select: {
                id: true,
                name: true,
                region: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
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
                    region: {
                      select: {
                        id: true,
                        name: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!user) {
      return res.status(404).json({ message: "Utilisateur introuvable" });
    }

    const inferredRegion =
      user.region ??
      user.district?.commune?.region ??
      user.healthCenter?.district?.commune?.region ??
      null;

    const inferredDistrict =
      user.district ?? user.healthCenter?.district ?? null;

    res.json({
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
      agentLevel: user.agentLevel,
      regionId: inferredRegion?.id ?? user.regionId ?? null,
      regionName: inferredRegion?.name ?? null,
      districtId: inferredDistrict?.id ?? user.districtId ?? null,
      districtName: inferredDistrict?.name ?? null,
      healthCenterId: user.healthCenterId ?? null,
      healthCenterName: user.healthCenter?.name ?? null,
    });
  } catch (error) {
    next(error);
  }
};
module.exports = {
  //createUser,
  activateUser,
  listUsers,
  getHealthCenterAgents,
  updateSelf,
  verifyEmail,
  getUserDeletionSummary,
  deleteUser,
  createRegional,
  createDistricit,
  createAgentAdmin,
  createAgentStaff,
  updateRegional,
  updateDistrict,
  updateAgentAdmin,
  updateAgentStaff,
  deleteRegional,
  deleteDistrict,
  deleteAgentAdmin,
  deleteAgentStaff,
  getSelf,
};