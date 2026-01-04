const prisma = require("../config/prismaClient");
const bcrypt = require("bcryptjs");
const fs = require("fs").promises;
const path = require("path");
const {
  sendInvitationEmail,
  sendSuperAdminEntityNotification,
  sendSuperAdminUserNotification,
  sendSuperAdminStockAdjustmentNotification,
  sendSuperAdminSettingsNotification,
} = require("../services/emailService");
const { logEventAsync } = require("../services/eventLogService");

const SALT_ROUNDS = 10;

// Vérifier si l'utilisateur est superadmin
const requireSuperAdmin = (req, res, next) => {
  if (req.user?.role !== "SUPERADMIN") {
    return res.status(403).json({ message: "Accès refusé. Rôle superadmin requis." });
  }
  next();
};

// Fonction utilitaire pour récupérer les emails des utilisateurs d'une entité
const getEntityUserEmails = async (entityType, entityId) => {
  try {
    let where = {};
    
    switch (entityType) {
      case "region":
        where.regionId = entityId;
        break;
      case "district":
        where.districtId = entityId;
        break;
      case "healthcenter":
        where.healthCenterId = entityId;
        break;
      default:
        return [];
    }

    const users = await prisma.user.findMany({
      where: {
        ...where,
        isActive: true,
      },
      select: {
        email: true,
      },
    });

    // Filtrer les emails null après la requête
    return users.map(u => u.email).filter(email => email != null);
  } catch (error) {
    console.error("Erreur récupération emails utilisateurs:", error);
    return [];
  }
};

// Fonction utilitaire pour récupérer les emails et IDs des utilisateurs d'une entité
const getEntityUserIdsAndEmails = async (entityType, entityId) => {
  try {
    let where = {};
    
    switch (entityType) {
      case "region":
        where.regionId = entityId;
        break;
      case "district":
        where.districtId = entityId;
        break;
      case "healthcenter":
        where.healthCenterId = entityId;
        break;
      default:
        return { emails: [], userIds: [] };
    }

    const users = await prisma.user.findMany({
      where: {
        ...where,
        isActive: true,
      },
      select: {
        id: true,
        email: true,
      },
    });

    const emails = users.map(u => u.email).filter(email => email != null);
    const userIds = users.map(u => u.id).filter(Boolean);

    return { emails, userIds };
  } catch (error) {
    console.error("Erreur récupération emails et IDs utilisateurs:", error);
    return { emails: [], userIds: [] };
  }
};

// ==================== GESTION DES ENTITÉS ====================

// Obtenir toutes les entités avec filtres
const getAllEntities = async (req, res, next) => {
  try {
    const { regionId, districtId, healthCenterId } = req.query;

    let whereRegion = {};
    let whereDistrict = {};
    let whereHealthCenter = {};

    // Filtres hiérarchiques
    if (healthCenterId) {
      // Si un centre est sélectionné, on filtre pour ce centre spécifique
      const healthCenter = await prisma.healthCenter.findUnique({
        where: { id: healthCenterId },
        include: { district: { include: { commune: { include: { region: true } } } } },
      });

      if (!healthCenter) {
        return res.status(404).json({ message: "Centre de santé non trouvé" });
      }

      whereRegion = { id: healthCenter.district.commune.regionId };
      whereDistrict = { id: healthCenter.districtId };
      whereHealthCenter = { id: healthCenterId };
    } else if (districtId) {
      // Si un district est sélectionné
      const district = await prisma.district.findUnique({
        where: { id: districtId },
        include: { commune: { include: { region: true } } },
      });

      if (!district) {
        return res.status(404).json({ message: "District non trouvé" });
      }

      whereRegion = { id: district.commune.regionId };
      whereDistrict = { id: districtId };
      whereHealthCenter = { districtId };
    } else if (regionId) {
      // Si une région est sélectionnée
      whereRegion = { id: regionId };
      whereDistrict = { commune: { regionId } };
      whereHealthCenter = { district: { commune: { regionId } } };
    }

    let whereCommune = {};
    if (regionId) {
      whereCommune = { regionId };
    }

    const [regions, communes, districts, healthCenters] = await Promise.all([
      prisma.region.findMany({
        where: whereRegion,
        include: {
          _count: {
            select: {
              communes: true,
              users: true,
              stockREGIONAL: true,
            },
          },
        },
        orderBy: { name: "asc" },
      }),
      prisma.commune.findMany({
        where: whereCommune,
        include: {
          region: {
            select: { id: true, name: true },
          },
          _count: {
            select: {
              districts: true,
            },
          },
        },
        orderBy: { name: "asc" },
      }),
      prisma.district.findMany({
        where: whereDistrict,
        include: {
          commune: {
            include: {
              region: {
                select: { id: true, name: true },
              },
            },
          },
          _count: {
            select: {
              healthCenters: true,
              users: true,
              stockDISTRICT: true,
            },
          },
        },
        orderBy: { name: "asc" },
      }),
      prisma.healthCenter.findMany({
        where: whereHealthCenter,
        include: {
          district: {
            include: {
              commune: {
                include: {
                  region: {
                    select: { id: true, name: true },
                  },
                },
              },
            },
          },
          _count: {
            select: {
              users: true,
              childrens: true,
              stockHEALTHCENTER: true,
            },
          },
        },
        orderBy: { name: "asc" },
      }),
    ]);

    res.json({
      regions,
      communes,
      districts,
      healthCenters,
    });
  } catch (error) {
    next(error);
  }
};

// Obtenir les détails d'une entité
const getEntityDetails = async (req, res, next) => {
  try {
    const { type, id } = req.params;

    let entity = null;

    switch (type) {
      case "region":
        entity = await prisma.region.findUnique({
          where: { id },
          include: {
            communes: {
              include: {
                districts: {
                  include: {
                    healthCenters: true,
                  },
                },
              },
            },
            users: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                role: true,
                isActive: true,
              },
            },
            _count: {
              select: {
                communes: true,
                users: true,
                stockREGIONAL: true,
                campaigns: true,
              },
            },
          },
        });
        break;

      case "commune":
        entity = await prisma.commune.findUnique({
          where: { id },
          include: {
            region: {
              select: {
                id: true,
                name: true,
              },
            },
            districts: {
              select: {
                id: true,
                name: true,
              },
            },
            _count: {
              select: {
                districts: true,
              },
            },
          },
        });
        break;

      case "district":
        entity = await prisma.district.findUnique({
          where: { id },
          include: {
            commune: {
              include: {
                region: true,
              },
            },
            healthCenters: true,
            users: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                role: true,
                isActive: true,
              },
            },
            _count: {
              select: {
                healthCenters: true,
                users: true,
                stockDISTRICT: true,
              },
            },
          },
        });
        break;

      case "healthcenter":
        entity = await prisma.healthCenter.findUnique({
          where: { id },
          include: {
            district: {
              include: {
                commune: {
                  include: {
                    region: true,
                  },
                },
              },
            },
            users: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                role: true,
                agentLevel: true,
                isActive: true,
              },
            },
            _count: {
              select: {
                users: true,
                childrens: true,
                stockHEALTHCENTER: true,
              },
            },
          },
        });
        break;

      default:
        return res.status(400).json({ message: "Type d'entité invalide" });
    }

    if (!entity) {
      return res.status(404).json({ message: "Entité non trouvée" });
    }

    res.json(entity);
  } catch (error) {
    next(error);
  }
};

// ==================== GESTION DES UTILISATEURS ====================

// Obtenir les détails d'un utilisateur
const getUserDetails = async (req, res, next) => {
  try {
    const { id } = req.params;

    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        region: {
          select: { id: true, name: true },
        },
        district: {
          select: { id: true, name: true },
        },
        healthCenter: {
          select: { id: true, name: true },
        },
        _count: {
          select: {
            childrens: true, // Enfants assignés (si agent)
            records: true, // Dossiers créés (si agent)
            vaccinesCompleted: true, // Vaccinations administrées (si agent)
            vaccinesScheduled: true, // Rendez-vous planifiés (si agent)
            vaccinesEscalated: true, // Retards gérés (si agent)
          },
        },
      },
    });

    if (!user) {
      return res.status(404).json({ message: "Utilisateur non trouvé" });
    }

    res.json(user);
  } catch (error) {
    next(error);
  }
};

// Obtenir tous les utilisateurs avec filtres
const getAllUsers = async (req, res, next) => {
  try {
    const { role, regionId, districtId, healthCenterId } = req.query;

    let where = {};

    // Filtre par rôle
    if (role) {
      where.role = role;
    }

    // Filtres hiérarchiques (même logique que pour les entités)
    if (healthCenterId) {
      where.healthCenterId = healthCenterId;
    } else if (districtId) {
      where.districtId = districtId;
    } else if (regionId) {
      where.regionId = regionId;
    }

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
        agentLevel: true,
        isActive: true,
        region: {
          select: { id: true, name: true },
        },
        district: {
          select: { id: true, name: true },
        },
        healthCenter: {
          select: { id: true, name: true },
        },
        createdAt: true,
        updatedAt: true,
      },
      orderBy: [
        { role: "asc" },
        { lastName: "asc" },
        { firstName: "asc" },
      ],
    });

    res.json({ users });
  } catch (error) {
    next(error);
  }
};

// Créer un utilisateur (tous les rôles pour superadmin)
const createUser = async (req, res, next) => {
  try {
    const { firstName, lastName, email, role, code, regionId, districtId, healthCenterId, agentLevel } = req.body;

    if (!["SUPERADMIN", "NATIONAL", "REGIONAL", "DISTRICT", "AGENT"].includes(role)) {
      return res.status(400).json({ message: "Rôle invalide" });
    }

    // Vérifier que l'email n'existe pas
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return res.status(400).json({ message: "Cet email est déjà utilisé" });
    }

    // Validation des champs selon le rôle
    if (!firstName?.trim() || !lastName?.trim() || !email?.trim()) {
      return res.status(400).json({ message: "Les champs prénom, nom et email sont obligatoires" });
    }

    if (role === "REGIONAL" && !regionId) {
      return res.status(400).json({ message: "La région est obligatoire pour un utilisateur régional" });
    }

    if (role === "DISTRICT" && !districtId) {
      return res.status(400).json({ message: "Le district est obligatoire pour un utilisateur district" });
    }

    if (role === "AGENT" && !healthCenterId) {
      return res.status(400).json({ message: "Le centre de santé est obligatoire pour un agent" });
    }

    if (role === "AGENT" && !agentLevel) {
      return res.status(400).json({ message: "Le niveau d'agent (ADMIN ou STAFF) est obligatoire" });
    }

    // Générer un token d'activation pour TOUS les utilisateurs
    const tokenService = require("../services/tokenService");
    const { token, expiresAt } = tokenService.generateActivationToken();

    // Préparer les données de création (tous les utilisateurs sont créés inactifs avec token d'activation)
    const userData = {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim(),
      role,
      isActive: false,
      emailVerified: false,
      activationToken: token,
      activationExpires: expiresAt,
      password: "",
    };

    // Ajouter les champs spécifiques selon le rôle
    if (code) {
      userData.code = code.trim();
    }

    if (regionId) {
      userData.regionId = regionId;
    }

    if (districtId) {
      userData.districtId = districtId;
      // Si districtId est fourni, récupérer le regionId du district
      const district = await prisma.district.findUnique({
        where: { id: districtId },
        include: { commune: { select: { regionId: true } } },
      });
      if (district?.commune?.regionId) {
        userData.regionId = district.commune.regionId;
      }
    }

    if (healthCenterId) {
      userData.healthCenterId = healthCenterId;
      // Si healthCenterId est fourni, récupérer le districtId et regionId du centre
      const healthCenter = await prisma.healthCenter.findUnique({
        where: { id: healthCenterId },
        include: {
          district: {
            include: { commune: { select: { regionId: true } } },
          },
        },
      });
      if (healthCenter?.districtId) {
        userData.districtId = healthCenter.districtId;
      }
      if (healthCenter?.district?.commune?.regionId) {
        userData.regionId = healthCenter.district.commune.regionId;
      }
    }

    if (agentLevel) {
      userData.agentLevel = agentLevel;
    }

    // Créer l'utilisateur
    const user = await prisma.user.create({
      data: userData,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
        agentLevel: true,
        isActive: true,
        createdAt: true,
      },
    });

    // Envoyer un email d'invitation (pour tous les utilisateurs)
    try {
      const emailData = {
        email,
        token,
        role,
        user: { id: user.id },
      };

      // Ajouter les informations d'entité si nécessaire
      if (role === "REGIONAL" && regionId) {
        const region = await prisma.region.findUnique({
          where: { id: regionId },
          select: { name: true },
        });
        emailData.region = region?.name || null;
      } else if (role === "DISTRICT" && districtId) {
        const district = await prisma.district.findUnique({
          where: { id: districtId },
          include: { commune: { include: { region: { select: { name: true } } } } },
        });
        emailData.district = district?.name || null;
        emailData.region = district?.commune?.region?.name || null;
      } else if (role === "AGENT" && healthCenterId) {
        const healthCenter = await prisma.healthCenter.findUnique({
          where: { id: healthCenterId },
          select: { name: true },
        });
        emailData.healthCenter = healthCenter?.name || null;
      }

      await sendInvitationEmail(emailData);
    } catch (emailError) {
      console.error("Erreur envoi email:", emailError);
      // On continue même si l'email échoue
    }

    // Notifier les utilisateurs supérieurs hiérarchiquement
    try {
      let superiorUsers = [];

      if (role === "REGIONAL") {
        // Nationaux seulement
        superiorUsers = await prisma.user.findMany({
          where: {
            isActive: true,
            role: "NATIONAL",
            id: { not: user.id },
          },
          select: { id: true, email: true },
        });
      } else if (role === "DISTRICT" && districtId) {
        // Récupérer la région du district
        const district = await prisma.district.findUnique({
          where: { id: districtId },
          include: { commune: { select: { regionId: true } } },
        });

        if (district?.commune?.regionId) {
          // Nationaux + Régionaux de la même région
          superiorUsers = await prisma.user.findMany({
            where: {
              isActive: true,
              id: { not: user.id },
              OR: [
                { role: "NATIONAL" },
                { role: "REGIONAL", regionId: district.commune.regionId },
              ],
            },
            select: { id: true, email: true },
          });
        }
      } else if (role === "AGENT" && healthCenterId) {
        // Récupérer le district et la région du centre
        const healthCenter = await prisma.healthCenter.findUnique({
          where: { id: healthCenterId },
          include: {
            district: {
              include: { commune: { select: { regionId: true } } },
            },
          },
        });

        if (healthCenter?.districtId) {
          const whereConditions = [
            { role: "NATIONAL" },
            { role: "REGIONAL", regionId: healthCenter.district.commune?.regionId },
            { role: "DISTRICT", districtId: healthCenter.districtId },
          ];

          // Si c'est un agent STAFF, ajouter les agents ADMIN du même centre
          if (agentLevel === "STAFF") {
            whereConditions.push({
              role: "AGENT",
              agentLevel: "ADMIN",
              healthCenterId: healthCenterId,
            });
          }

          // Nationaux + Régionaux de sa région + Districts de son district + (si STAFF) Agents ADMIN du même centre
          superiorUsers = await prisma.user.findMany({
            where: {
              isActive: true,
              id: { not: user.id },
              OR: whereConditions,
            },
            select: { id: true, email: true },
          });
        }
      } else if (role === "NATIONAL" || role === "SUPERADMIN") {
        // Pour les nationaux et superadmins, personne n'est supérieur (ou seulement les superadmins pour les nationaux)
        if (role === "NATIONAL") {
          superiorUsers = await prisma.user.findMany({
            where: {
              isActive: true,
              role: "SUPERADMIN",
              id: { not: user.id },
            },
            select: { id: true, email: true },
          });
        }
        // Pour SUPERADMIN, personne n'est supérieur
      }

      const emails = superiorUsers.map(u => u.email).filter(email => email != null);
      const userIds = superiorUsers.map(u => u.id).filter(Boolean);
      if (emails.length > 0) {
        await sendSuperAdminUserNotification({
          emails,
          userIds,
          action: "created",
          userEmail: email,
          userName: `${firstName} ${lastName}`,
          role,
        });
      }
    } catch (emailError) {
      console.error("Erreur envoi notification utilisateur:", emailError);
      // On continue même si l'email échoue
    }

    // Enregistrer l'événement
    logEventAsync({
      type: "USER",
      subtype: role,
      action: "CREATE",
      user: {
        id: req.user.id,
        firstName: req.user.firstName,
        lastName: req.user.lastName,
        email: req.user.email,
        role: req.user.role,
      },
      entityType: "USER",
      entityId: user.id,
      entityName: `${user.firstName} ${user.lastName}`,
      details: {
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        agentLevel: user.agentLevel,
        regionId: regionId || null,
        districtId: districtId || null,
        healthCenterId: healthCenterId || null,
      },
    });

    res.status(201).json({ user });
  } catch (error) {
    if (error.code === "P2002") {
      return res.status(400).json({ message: "Cet email est déjà utilisé" });
    }
    if (error.code === "P2003") {
      return res.status(400).json({ message: "Une référence invalide a été fournie. Veuillez vérifier les informations saisies (région, district ou centre de santé)." });
    }
    console.error("Erreur création utilisateur:", error);
    next(error);
  }
};

// Modifier un utilisateur
const updateUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { firstName, lastName, email, role, isActive, code } = req.body;

    // Vérifier que l'utilisateur existe
    const existingUser = await prisma.user.findUnique({
      where: { id },
    });

    if (!existingUser) {
      return res.status(404).json({ message: "Utilisateur non trouvé" });
    }

    // Vérifier si l'email est déjà utilisé par un autre utilisateur
    if (email && email !== existingUser.email) {
      const emailUser = await prisma.user.findUnique({
        where: { email },
      });
      if (emailUser) {
        return res.status(400).json({ message: "Cet email est déjà utilisé" });
      }
    }

    // Mettre à jour l'utilisateur
    const updatedUser = await prisma.user.update({
      where: { id },
      data: {
        ...(firstName && { firstName }),
        ...(lastName && { lastName }),
        ...(email && { email }),
        ...(role && { role }),
        ...(isActive !== undefined && { isActive }),
        ...(code !== undefined && { code }),
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
        agentLevel: true,
        isActive: true,
        region: {
          select: { id: true, name: true },
        },
        district: {
          select: { id: true, name: true },
        },
        healthCenter: {
          select: { id: true, name: true },
        },
        updatedAt: true,
      },
    });

    // Envoyer des notifications aux utilisateurs concernés
    try {
      const allUsers = await prisma.user.findMany({
        where: {
          isActive: true,
          id: { not: id },
        },
        select: { id: true, email: true },
      });
      const emails = allUsers.map(u => u.email).filter(email => email != null);
      const userIds = allUsers.map(u => u.id).filter(Boolean);
      if (emails.length > 0) {
        const details = [];
        if (firstName && firstName !== existingUser.firstName) details.push(`Prénom: ${firstName}`);
        if (lastName && lastName !== existingUser.lastName) details.push(`Nom: ${lastName}`);
        if (email && email !== existingUser.email) details.push(`Email: ${email}`);
        if (role && role !== existingUser.role) details.push(`Rôle: ${role}`);
        
        await sendSuperAdminUserNotification({
          emails,
          userIds,
          action: "updated",
          userEmail: updatedUser.email || existingUser.email,
          userName: `${updatedUser.firstName || existingUser.firstName} ${updatedUser.lastName || existingUser.lastName}`,
          role: updatedUser.role || existingUser.role,
          details: details.length > 0 ? details.join(", ") : "Modifications effectuées",
        });
      }
    } catch (emailError) {
      console.error("Erreur envoi notification utilisateur:", emailError);
      // On continue même si l'email échoue
    }

    // Enregistrer l'événement
    const beforeData = {
      firstName: existingUser.firstName,
      lastName: existingUser.lastName,
      email: existingUser.email,
      role: existingUser.role,
      agentLevel: existingUser.agentLevel,
      isActive: existingUser.isActive,
      regionId: existingUser.regionId,
      districtId: existingUser.districtId,
      healthCenterId: existingUser.healthCenterId,
    };
    const afterData = {
      firstName: updatedUser.firstName,
      lastName: updatedUser.lastName,
      email: updatedUser.email,
      role: updatedUser.role,
      agentLevel: updatedUser.agentLevel,
      isActive: updatedUser.isActive,
      regionId: updatedUser.region?.id || null,
      districtId: updatedUser.district?.id || null,
      healthCenterId: updatedUser.healthCenter?.id || null,
    };
    logEventAsync({
      type: "USER",
      subtype: updatedUser.role,
      action: "UPDATE",
      user: {
        id: req.user.id,
        firstName: req.user.firstName,
        lastName: req.user.lastName,
        email: req.user.email,
        role: req.user.role,
      },
      entityType: "USER",
      entityId: updatedUser.id,
      entityName: `${updatedUser.firstName} ${updatedUser.lastName}`,
      details: {
        before: beforeData,
        after: afterData,
      },
    });

    res.json({ user: updatedUser });
  } catch (error) {
    if (error.code === "P2025") {
      return res.status(404).json({ message: "Utilisateur non trouvé" });
    }
    if (error.code === "P2002") {
      return res.status(400).json({ message: "Cet email est déjà utilisé" });
    }
    next(error);
  }
};

// Collecter les données en cascade pour un utilisateur
const collectUserCascadeData = async (tx, userId) => {
  const user = await tx.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      role: true,
    },
  });

  if (!user) {
    const error = new Error("Utilisateur non trouvé");
    error.status = 404;
    throw error;
  }

  // Éléments pertinents selon le rôle
  const isAgentRole = ["AGENT", "DISTRICT", "REGIONAL"].includes(user.role);
  const isAdminRole = ["SUPERADMIN", "NATIONAL"].includes(user.role);

  const promises = [];

  // Éléments pertinents uniquement pour les agents (AGENT, DISTRICT, REGIONAL)
  if (isAgentRole) {
    promises.push(
      tx.children.findMany({
        where: { nextAgentId: userId },
        select: { id: true, firstName: true, lastName: true },
      }),
      tx.record.findMany({
        where: { agentId: userId },
        select: { id: true },
      }),
      tx.childVaccineCompleted.findMany({
        where: { administeredById: userId },
        select: { id: true },
      }),
      tx.childVaccineScheduled.findMany({
        where: { plannerId: userId },
        select: { id: true },
      }),
      tx.childVaccineOverdue.findMany({
        where: { escalatedToId: userId },
        select: { id: true },
      })
    );
  } else {
    // Pour NATIONAL/SUPERADMIN, mettre des tableaux vides
    promises.push(
      Promise.resolve([]), // children
      Promise.resolve([]), // records
      Promise.resolve([]), // vaccinesCompleted
      Promise.resolve([]), // vaccinesScheduled
      Promise.resolve([])  // vaccinesEscalated
    );
  }

  // Éléments pertinents pour tous les rôles
  promises.push(
    tx.pendingStockTransfer.findMany({
      where: { confirmedById: userId },
      select: { id: true },
    }),
    tx.vaccineRequest.findMany({
      where: { scheduledById: userId },
      select: { id: true },
    }),
    tx.stockExpirationNotification.findMany({
      where: { userId },
      select: { id: true },
    })
  );

  // Éléments pertinents uniquement pour SUPERADMIN
  if (user.role === "SUPERADMIN") {
    promises.push(
      tx.appSettings.findMany({
        where: { updatedById: userId },
        select: { id: true },
      })
    );
  } else {
    promises.push(Promise.resolve([])); // appSettingsUpdates
  }

  const results = await Promise.all(promises);

  return {
    user,
    children: results[0],
    records: results[1],
    vaccinesCompleted: results[2],
    vaccinesScheduled: results[3],
    vaccinesEscalated: results[4],
    confirmedTransfers: results[5],
    scheduledVaccineRequests: results[6],
    stockExpirationNotifications: results[7],
    appSettingsUpdates: results[8] || [],
  };
};

// Formater le résumé de suppression d'un utilisateur
const formatUserDeletionSummary = (data) => {
  const totals = {};
  const details = {};

  // Ajouter uniquement les éléments pertinents selon le rôle
  const isAgentRole = ["AGENT", "DISTRICT", "REGIONAL"].includes(data.user.role);
  const isSuperAdmin = data.user.role === "SUPERADMIN";

  if (isAgentRole) {
    totals.children = data.children.length;
    totals.records = data.records.length;
    totals.vaccinesCompleted = data.vaccinesCompleted.length;
    totals.vaccinesScheduled = data.vaccinesScheduled.length;
    totals.vaccinesEscalated = data.vaccinesEscalated.length;
    details.children = data.children;
    details.records = data.records;
    details.vaccinesCompleted = data.vaccinesCompleted;
    details.vaccinesScheduled = data.vaccinesScheduled;
    details.vaccinesEscalated = data.vaccinesEscalated;
  }

  // Éléments pertinents pour tous les rôles
  totals.confirmedTransfers = data.confirmedTransfers.length;
  totals.scheduledVaccineRequests = data.scheduledVaccineRequests.length;
  totals.stockExpirationNotifications = data.stockExpirationNotifications.length;
  details.confirmedTransfers = data.confirmedTransfers;
  details.scheduledVaccineRequests = data.scheduledVaccineRequests;
  details.stockExpirationNotifications = data.stockExpirationNotifications;

  // Éléments pertinents uniquement pour SUPERADMIN
  if (isSuperAdmin) {
    totals.appSettingsUpdates = data.appSettingsUpdates.length;
    details.appSettingsUpdates = data.appSettingsUpdates;
  }

  return {
    success: true,
    user: {
      id: data.user.id,
      name: `${data.user.firstName} ${data.user.lastName}`,
      email: data.user.email,
      role: data.user.role,
    },
    totals,
    details,
  };
};

// Obtenir le résumé de suppression d'un utilisateur
const getUserDeletionSummary = async (req, res, next) => {
  try {
    const { id } = req.params;

    const summary = await prisma.$transaction((tx) => collectUserCascadeData(tx, id));

    return res.json(formatUserDeletionSummary(summary));
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ message: error.message });
    }
    next(error);
  }
};

// Supprimer un utilisateur
const deleteUser = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Vérifier que l'utilisateur existe et récupérer les infos nécessaires
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        regionId: true,
        districtId: true,
        healthCenterId: true,
        agentLevel: true,
      },
    });

    if (!user) {
      return res.status(404).json({ message: "Utilisateur non trouvé" });
    }

    // Ne pas permettre la suppression de soi-même
    if (user.id === req.user.id) {
      return res.status(400).json({ message: "Vous ne pouvez pas supprimer votre propre compte" });
    }

    // Récupérer les informations avant suppression pour la notification
    const userInfo = {
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      regionId: user.regionId,
      districtId: user.districtId,
      healthCenterId: user.healthCenterId,
      agentLevel: user.agentLevel,
    };

    // Supprimer l'utilisateur
    await prisma.user.delete({
      where: { id },
    });

    // Répondre immédiatement
    res.json({ message: "Utilisateur supprimé avec succès" });

    // Envoyer des notifications aux utilisateurs supérieurs hiérarchiquement en arrière-plan (non bloquant)
    setImmediate(async () => {
      try {
        let superiorUsers = [];

        if (userInfo.role === "REGIONAL") {
          // Nationaux seulement
          superiorUsers = await prisma.user.findMany({
            where: {
              isActive: true,
              role: "NATIONAL",
              id: { not: req.user.id }, // Exclure l'utilisateur qui effectue la suppression
            },
            select: { id: true, email: true },
          });
        } else if (userInfo.role === "DISTRICT" && userInfo.districtId) {
          // Récupérer la région du district
          const district = await prisma.district.findUnique({
            where: { id: userInfo.districtId },
            include: { commune: { select: { regionId: true } } },
          });

          if (district?.commune?.regionId) {
            // Nationaux + Régionaux de la même région
            superiorUsers = await prisma.user.findMany({
              where: {
                isActive: true,
                id: { not: req.user.id }, // Exclure l'utilisateur qui effectue la suppression
                OR: [
                  { role: "NATIONAL" },
                  { role: "REGIONAL", regionId: district.commune.regionId },
                ],
              },
              select: { id: true, email: true },
            });
          }
        } else if (userInfo.role === "AGENT" && userInfo.healthCenterId) {
          // Récupérer le district et la région du centre
          const healthCenter = await prisma.healthCenter.findUnique({
            where: { id: userInfo.healthCenterId },
            include: {
              district: {
                include: { commune: { select: { regionId: true } } },
              },
            },
          });

          if (healthCenter?.districtId) {
            const whereConditions = [
              { role: "NATIONAL" },
              { role: "REGIONAL", regionId: healthCenter.district.commune?.regionId },
              { role: "DISTRICT", districtId: healthCenter.districtId },
            ];

            // Si c'est un agent STAFF, ajouter les agents ADMIN du même centre
            if (userInfo.agentLevel === "STAFF") {
              whereConditions.push({
                role: "AGENT",
                agentLevel: "ADMIN",
                healthCenterId: userInfo.healthCenterId,
              });
            }

            // Nationaux + Régionaux de sa région + Districts de son district + (si STAFF) Agents ADMIN du même centre
            superiorUsers = await prisma.user.findMany({
              where: {
                isActive: true,
                id: { not: req.user.id }, // Exclure l'utilisateur qui effectue la suppression
                OR: whereConditions,
              },
              select: { id: true, email: true },
            });
          }
        } else if (userInfo.role === "NATIONAL" || userInfo.role === "SUPERADMIN") {
          // Pour les nationaux et superadmins, personne n'est supérieur (ou seulement les superadmins pour les nationaux)
          if (userInfo.role === "NATIONAL") {
            superiorUsers = await prisma.user.findMany({
              where: {
                isActive: true,
                role: "SUPERADMIN",
                id: { not: req.user.id }, // Exclure l'utilisateur qui effectue la suppression
              },
              select: { id: true, email: true },
            });
          }
          // Pour SUPERADMIN, personne n'est supérieur
        }

        const emails = superiorUsers.map(u => u.email).filter(email => email != null);
        const userIds = superiorUsers.map(u => u.id).filter(Boolean);
        if (emails.length > 0) {
          await sendSuperAdminUserNotification({
            emails,
            userIds,
            action: "deleted",
            userEmail: userInfo.email,
            userName: `${userInfo.firstName} ${userInfo.lastName}`,
            role: userInfo.role,
          });
        }
      } catch (emailError) {
        console.error("Erreur envoi notification utilisateur:", emailError);
        // Ne pas bloquer la réponse si l'email échoue
      }
    });

    // Enregistrer l'événement
    logEventAsync({
      type: "USER",
      subtype: userInfo.role,
      action: "DELETE",
      user: {
        id: req.user.id,
        firstName: req.user.firstName,
        lastName: req.user.lastName,
        email: req.user.email,
        role: req.user.role,
      },
      entityType: "USER",
      entityId: id,
      entityName: `${userInfo.firstName} ${userInfo.lastName}`,
      details: {
        email: userInfo.email,
        role: userInfo.role,
      },
    });
  } catch (error) {
    if (error.code === "P2025") {
      return res.status(404).json({ message: "Utilisateur non trouvé" });
    }
    next(error);
  }
};

// Modifier une entité
const updateEntity = async (req, res, next) => {
  try {
    const { type, id } = req.params;
    const { name, address } = req.body;

    // Récupérer l'entité avant modification
    let oldEntity = null;
    try {
      if (type === "region") {
        oldEntity = await prisma.region.findUnique({ where: { id } });
      } else if (type === "commune") {
        oldEntity = await prisma.commune.findUnique({ where: { id } });
      } else if (type === "district") {
        oldEntity = await prisma.district.findUnique({ where: { id } });
      } else if (type === "healthcenter") {
        oldEntity = await prisma.healthCenter.findUnique({ where: { id } });
      }
    } catch (err) {
      console.error("Erreur récupération entité avant modification:", err);
    }

    let entity = null;

    switch (type) {
      case "region":
        if (!name || name.trim() === "") {
          return res.status(400).json({ message: "Le nom de la région est requis" });
        }
        entity = await prisma.region.update({
          where: { id },
          data: { name: name.trim() },
        });
        break;

      case "commune":
        if (!name || name.trim() === "") {
          return res.status(400).json({ message: "Le nom de la commune est requis" });
        }
        entity = await prisma.commune.update({
          where: { id },
          data: { name: name.trim() },
        });
        break;

      case "district":
        if (!name || name.trim() === "") {
          return res.status(400).json({ message: "Le nom du district est requis" });
        }
        entity = await prisma.district.update({
          where: { id },
          data: { name: name.trim() },
        });
        break;

      case "healthcenter":
        if (!name || name.trim() === "") {
          return res.status(400).json({ message: "Le nom du centre de santé est requis" });
        }
        entity = await prisma.healthCenter.update({
          where: { id },
          data: {
            name: name.trim(),
            address: address ? address.trim() : undefined,
          },
        });
        break;

      default:
        return res.status(400).json({ message: "Type d'entité invalide" });
    }

    // Envoyer des notifications aux utilisateurs de l'entité
    try {
      const { emails, userIds } = await getEntityUserIdsAndEmails(type, id);
      if (emails.length > 0) {
        await sendSuperAdminEntityNotification({
          emails,
          userIds,
          action: "updated",
          entityType: type,
          entityName: entity.name,
          details: `Le nom a été modifié en "${entity.name}"`,
        });
      }
    } catch (emailError) {
      console.error("Erreur envoi notification entité:", emailError);
      // On continue même si l'email échoue
    }

    // Enregistrer l'événement
    const subtypeMap = {
      region: "REGION",
      district: "DISTRICT",
      healthcenter: "HEALTHCENTER",
    };
    logEventAsync({
      type: "ENTITY",
      subtype: subtypeMap[type],
      action: "UPDATE",
      user: {
        id: req.user.id,
        firstName: req.user.firstName,
        lastName: req.user.lastName,
        email: req.user.email,
        role: req.user.role,
      },
      entityType: subtypeMap[type],
      entityId: entity.id,
      entityName: entity.name,
      details: {
        before: oldEntity ? { name: oldEntity.name, ...(type === "healthcenter" && { address: oldEntity.address }) } : null,
        after: { name: entity.name, ...(type === "healthcenter" && { address: entity.address }) },
      },
    });

    res.json(entity);
  } catch (error) {
    if (error.code === "P2025") {
      return res.status(404).json({ message: "Entité non trouvée" });
    }
    if (error.code === "P2002") {
      return res.status(409).json({ message: "Ce nom est déjà utilisé" });
    }
    next(error);
  }
};

// Supprimer une entité (avec résumé de suppression)
const getEntityDeletionSummary = async (req, res, next) => {
  try {
    const { type, id } = req.params;

    // Utiliser les routes existantes qui gèrent déjà les résumés
    const regionController = require("./regionController");
    const districtController = require("./districtController");
    const healthCenterController = require("./healthCenterController");

    // Créer un faux req pour les fonctions existantes
    const fakeReq = {
      params: { id },
      user: req.user,
    };

    const fakeRes = {
      json: (data) => res.json(data),
      status: (code) => ({
        json: (data) => res.status(code).json(data),
      }),
    };

    const communeController = require("./communeController");

    switch (type) {
      case "region":
        await regionController.getRegionDeletionSummary(fakeReq, fakeRes, next);
        break;

      case "commune":
        await communeController.getCommuneDeletionSummary(fakeReq, fakeRes, next);
        break;

      case "district":
        await districtController.getDistrictDeletionSummary(fakeReq, fakeRes, next);
        break;

      case "healthcenter":
        await healthCenterController.getHealthCenterDeletionSummary(fakeReq, fakeRes, next);
        break;

      default:
        return res.status(400).json({ message: "Type d'entité invalide" });
    }
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ message: error.message });
    }
    next(error);
  }
};

// Supprimer une entité
const deleteEntity = async (req, res, next) => {
  try {
    const { type, id } = req.params;

    // Récupérer les informations de l'entité avant suppression pour la notification
    let entityName = "";
    let usersForNotification = [];
    try {
      switch (type) {
        case "region": {
          const region = await prisma.region.findUnique({ where: { id }, select: { name: true } });
          if (!region) {
            return res.status(404).json({ message: "Région non trouvée" });
          }
          entityName = region.name;
          // Récupérer les utilisateurs de la région avant suppression
          usersForNotification = await prisma.user.findMany({
            where: { regionId: id, isActive: true },
            select: { id: true, email: true },
          });
          break;
        }
        case "district": {
          const district = await prisma.district.findUnique({ where: { id }, select: { name: true } });
          if (!district) {
            return res.status(404).json({ message: "District non trouvé" });
          }
          entityName = district.name;
          // Récupérer les utilisateurs du district avant suppression
          usersForNotification = await prisma.user.findMany({
            where: { districtId: id, isActive: true },
            select: { id: true, email: true },
          });
          break;
        }
        case "healthcenter": {
          const center = await prisma.healthCenter.findUnique({ where: { id }, select: { name: true } });
          if (!center) {
            return res.status(404).json({ message: "Centre de santé non trouvé" });
          }
          entityName = center.name;
          // Récupérer les utilisateurs du centre avant suppression
          usersForNotification = await prisma.user.findMany({
            where: { healthCenterId: id, isActive: true },
            select: { id: true, email: true },
          });
          break;
        }
        case "commune": {
          const commune = await prisma.commune.findUnique({ where: { id }, select: { name: true } });
          if (!commune) {
            return res.status(404).json({ message: "Commune non trouvée" });
          }
          entityName = commune.name;
          // Pas d'utilisateurs directs pour les communes (ils sont au niveau district/healthcenter)
          usersForNotification = [];
          break;
        }
        default:
          return res.status(400).json({ message: "Type d'entité invalide" });
      }
    } catch (err) {
      console.error("Erreur récupération nom entité:", err);
      return res.status(500).json({ message: "Erreur lors de la récupération de l'entité" });
    }

    // Stocker les données pour l'email
    const emailData = {
      entityName,
      emails: usersForNotification.map(u => u.email).filter(email => email != null),
      userIds: usersForNotification.map(u => u.id).filter(Boolean),
      entityType: type,
    };

    // Récupérer le résumé de cascade AVANT la suppression
    const subtypeMap = {
      region: "REGION",
      commune: "COMMUNE",
      district: "DISTRICT",
      healthcenter: "HEALTHCENTER",
    };
    let cascadeSummary = {};
    try {
      if (type === "region") {
        const regionController = require("./regionController");
        const fakeReqForSummary = { params: { id }, user: req.user };
        const fakeResForSummary = { json: (data) => data };
        const summary = await regionController.getRegionDeletionSummary(fakeReqForSummary, fakeResForSummary, next);
        cascadeSummary = summary?.totals || {};
      } else if (type === "commune") {
        const communeController = require("./communeController");
        const fakeReqForSummary = { params: { id }, user: req.user };
        const fakeResForSummary = { json: (data) => data };
        const summary = await communeController.getCommuneDeletionSummary(fakeReqForSummary, fakeResForSummary, next);
        cascadeSummary = summary?.totals || {};
      } else if (type === "district") {
        const districtController = require("./districtController");
        const fakeReqForSummary = { params: { id }, user: req.user };
        const fakeResForSummary = { json: (data) => data };
        const summary = await districtController.getDistrictDeletionSummary(fakeReqForSummary, fakeResForSummary, next);
        cascadeSummary = summary?.totals || {};
      } else if (type === "healthcenter") {
        const healthCenterController = require("./healthCenterController");
        const fakeReqForSummary = { params: { id }, user: req.user };
        const fakeResForSummary = { json: (data) => data };
        const summary = await healthCenterController.getHealthCenterDeletionSummary(fakeReqForSummary, fakeResForSummary, next);
        cascadeSummary = summary?.totals || {};
      }
    } catch (err) {
      console.error("Erreur récupération résumé cascade:", err);
    }

    // Réutiliser les fonctions de suppression existantes
    const regionController = require("./regionController");
    const districtController = require("./districtController");
    const healthCenterController = require("./healthCenterController");

    // Créer un faux req/res pour les fonctions existantes
    const fakeReq = {
      params: { id },
      user: req.user,
      body: req.body,
    };

    const fakeRes = {
      json: (data) => res.json(data),
      status: (code) => ({
        json: (data) => res.status(code).json(data),
        end: () => res.status(code).end(),
        send: (data) => res.status(code).send(data),
      }),
      end: () => res.end(),
      send: (data) => res.send(data),
    };

    const communeController = require("./communeController");

    switch (type) {
      case "region":
        await regionController.deleteRegion(fakeReq, fakeRes, next);
        break;

      case "commune":
        await communeController.deleteCommune(fakeReq, fakeRes, next);
        break;

      case "district":
        await districtController.deleteDistrict(fakeReq, fakeRes, next);
        break;

      case "healthcenter":
        await healthCenterController.deleteHealthCenter(fakeReq, fakeRes, next);
        break;

      default:
        return res.status(400).json({ message: "Type d'entité invalide" });
    }

    // Envoyer des notifications aux utilisateurs de l'entité en arrière-plan (non bloquant)
    setImmediate(async () => {
      try {
        if (emailData.emails.length > 0 && emailData.entityName) {
          await sendSuperAdminEntityNotification({
            emails: emailData.emails,
            userIds: emailData.userIds,
            action: "deleted",
            entityType: emailData.entityType,
            entityName: emailData.entityName,
            details: "Cette entité a été supprimée. Vos données peuvent être affectées.",
          });
        }
      } catch (emailError) {
        console.error("Erreur envoi notification entité:", emailError);
        // Ne pas bloquer la réponse si l'email échoue
      }
    });

    // Enregistrer l'événement avec le résumé de cascade (utiliser les données récupérées avant suppression)

    logEventAsync({
      type: "ENTITY",
      subtype: subtypeMap[type],
      action: "DELETE",
      user: {
        id: req.user.id,
        firstName: req.user.firstName,
        lastName: req.user.lastName,
        email: req.user.email,
        role: req.user.role,
      },
      entityType: subtypeMap[type],
      entityId: id,
      entityName: emailData.entityName,
      metadata: {
        cascadeSummary,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ==================== GESTION DES PARAMÈTRES ====================

// Obtenir les paramètres de l'application
const getAppSettings = async (req, res, next) => {
  try {
    let settings = await prisma.appSettings.findFirst();

    // Si aucun paramètre n'existe, créer les paramètres par défaut
    if (!settings) {
      settings = await prisma.appSettings.create({
        data: {
          appName: null, // null = utiliser "Imunia" par défaut
          logoPath: null, // null = utiliser "/logo.png" par défaut
        },
      });
    }

    res.json({
      appName: (settings.appName && settings.appName.trim()) || "Imunia",
      logoPath: settings.logoPath || "/logo.png",
      hasCustomName: settings.appName !== null && settings.appName.trim() !== "",
      hasCustomLogo: settings.logoPath !== null,
    });
  } catch (error) {
    next(error);
  }
};

// Mettre à jour les paramètres de l'application
const updateAppSettings = async (req, res, next) => {
  try {
    const { appName, logoPath } = req.body;

    // Vérifier si un logo a été uploadé
    let finalLogoPath = null;
    if (req.file) {
      // Le logo est dans req.file (géré par multer)
      finalLogoPath = `/uploads/${req.file.filename}`;
    } else if (logoPath) {
      // Si logoPath est fourni directement (pour suppression)
      finalLogoPath = logoPath === "" ? null : logoPath;
    }

    // Obtenir ou créer les paramètres
    let settings = await prisma.appSettings.findFirst();

    if (!settings) {
      settings = await prisma.appSettings.create({
        data: {
          appName: appName || null,
          logoPath: finalLogoPath,
          updatedById: req.user.id,
        },
      });
    } else {
      // Supprimer l'ancien logo si on en upload un nouveau
      if (req.file && settings.logoPath && settings.logoPath.startsWith("/uploads/")) {
        try {
          const oldLogoPath = path.join(__dirname, "..", "..", "frontend", "public", settings.logoPath);
          await fs.unlink(oldLogoPath);
        } catch (unlinkError) {
          console.error("Erreur suppression ancien logo:", unlinkError);
          // On continue même si la suppression échoue
        }
      }

      // Si logoPath est vide string, on supprime le logo
      if (logoPath === "" && !req.file) {
        if (settings.logoPath && settings.logoPath.startsWith("/uploads/")) {
          try {
            const oldLogoPath = path.join(__dirname, "..", "..", "frontend", "public", settings.logoPath);
            await fs.unlink(oldLogoPath);
          } catch (unlinkError) {
            console.error("Erreur suppression logo:", unlinkError);
          }
        }
        finalLogoPath = null;
      } else if (!req.file && logoPath === undefined) {
        // Si aucun nouveau logo n'est fourni, garder l'ancien
        finalLogoPath = settings.logoPath;
      }

      settings = await prisma.appSettings.update({
        where: { id: settings.id },
        data: {
          appName: appName || null,
          logoPath: finalLogoPath,
          updatedById: req.user.id,
        },
      });
    }

    // Envoyer des notifications à tous les utilisateurs actifs
    try {
      const allUsers = await prisma.user.findMany({
        where: {
          isActive: true,
        },
        select: { id: true, email: true },
      });
      const emails = allUsers.map(u => u.email).filter(email => email != null);
      const userIds = allUsers.map(u => u.id).filter(Boolean);
      if (emails.length > 0) {
        const details = [];
        if (appName !== undefined) {
          details.push(`Nom de l'application: ${(settings.appName && settings.appName.trim()) || "Imunia"}`);
        }
        if (req.file || logoPath === "") {
          details.push(`Logo: ${settings.logoPath ? "modifié" : "supprimé"}`);
        }
        
        await sendSuperAdminSettingsNotification({
          emails,
          userIds,
          settingType: appName !== undefined ? "name" : "logo",
          details: details.length > 0 ? `<p>${details.join("</p><p>")}</p>` : undefined,
        });
      }
    } catch (emailError) {
      console.error("Erreur envoi notification paramètres:", emailError);
      // On continue même si l'email échoue
    }

    res.json({
      appName: (settings.appName && settings.appName.trim()) || "Imunia",
      logoPath: settings.logoPath || "/logo.png",
      hasCustomName: settings.appName !== null && settings.appName.trim() !== "",
      hasCustomLogo: settings.logoPath !== null,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  requireSuperAdmin,
  getAllEntities,
  getEntityDetails,
  updateEntity,
  getEntityDeletionSummary,
  deleteEntity,
  getAllUsers,
  getUserDetails,
  createUser,
  updateUser,
  getUserDeletionSummary,
  deleteUser,
  getAppSettings,
  updateAppSettings,
};

