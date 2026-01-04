const prisma = require("../config/prismaClient");
const { sendParentAccessCode } = require("../services/notification");
const { generateAccessCode } = require("../utils/accessCode");
const {
  rebuildChildVaccinationBuckets,
} = require("../services/vaccineBucketService");
const { buildVaccineDoseMap } = require("../utils/vaccineDose");
const { logEventAsync } = require("../services/eventLogService");
const { notifyHealthCenterAgents } = require("../services/notificationService");

const makeHttpError = (message, status = 400) => {
  const err = new Error(message);
  err.status = status;
  return err;
};

const childAccessSelect = {
  id: true,
  healthCenterId: true,
  healthCenter: {
    select: {
      district: {
        select: {
          id: true,
          commune: {
            select: {
              region: {
                select: {
                  id: true,
                },
              },
            },
          },
        },
      },
    },
  },
};

const deriveChildLocation = (child) => {
  const healthCenterId = child?.healthCenterId ?? null;
  const districtId = child?.healthCenter?.district?.id ?? null;
  const regionId =
    child?.healthCenter?.district?.commune?.region?.id ?? null;
  return { healthCenterId, districtId, regionId };
};

const hasChildAccess = (user, child) => {
  if (!child) {
    return false;
  }
  const { healthCenterId, districtId, regionId } = deriveChildLocation(child);

  switch (user.role) {
    case "SUPERADMIN":
    case "NATIONAL":
      return true;
    case "REGIONAL":
      return Boolean(
        user.regionId && regionId && user.regionId === regionId,
      );
    case "DISTRICT":
      return Boolean(
        user.districtId && districtId && user.districtId === districtId,
      );
    case "AGENT":
      return Boolean(
        user.healthCenterId &&
          healthCenterId &&
          user.healthCenterId === healthCenterId,
      );
    default:
      return false;
  }
};

const hasManualVaccinationAccess = (user, child) => {
  if (!hasChildAccess(user, child)) {
    return false;
  }

  if (["SUPERADMIN", "NATIONAL", "REGIONAL", "DISTRICT"].includes(user.role)) {
    return true;
  }

  return user.role === "AGENT" && user.agentLevel === "ADMIN";
};

const normalizeId = (value, label) => {
  if (typeof value !== "string" || !value.trim()) {
    throw makeHttpError(`${label} est requis.`);
  }
  return value.trim();
};

const optionalId = (value) => {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

const parseDoseValue = (value, { optional = false } = {}) => {
  if (value === undefined || value === null || value === "") {
    if (optional) {
      return undefined;
    }
    throw makeHttpError("La dose est requise.");
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw makeHttpError("La dose doit être un entier positif.");
  }
  return Math.floor(parsed);
};

const parseDateValue = (value, label, { optional = false } = {}) => {
  if (value === undefined || value === null || value === "") {
    if (optional) {
      return undefined;
    }
    throw makeHttpError(`${label} est requis(e).`);
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw makeHttpError(`${label} est invalide.`);
  }
  return date;
};

const ensureVaccineExists = async (vaccineId) => {
  const record = await prisma.vaccine.findUnique({
    where: { id: vaccineId },
    select: { id: true },
  });
  if (!record) {
    throw makeHttpError("Vaccin introuvable.", 404);
  }
  return record.id;
};

const ensureCalendarExists = async (calendarId) => {
  const record = await prisma.vaccineCalendar.findUnique({
    where: { id: calendarId },
    select: { id: true },
  });
  if (!record) {
    throw makeHttpError("Entrée de calendrier vaccinal introuvable.", 404);
  }
  return record.id;
};

const buildDueCreateData = async (body, { childId }) => {
  const vaccineId = normalizeId(body.vaccineId, "Le vaccin");
  await ensureVaccineExists(vaccineId);

  const calendarId = normalizeId(
    body.vaccineCalendarId,
    "Le calendrier vaccinal",
  );
  await ensureCalendarExists(calendarId);

  const scheduledFor = parseDateValue(
    body.scheduledFor,
    "La date prévue",
  );
  const dose = parseDoseValue(body.dose);

  return {
    childId,
    vaccineId,
    vaccineCalendarId: calendarId,
    scheduledFor,
    dose,
  };
};

const buildDueUpdateData = async (body) => {
  const data = {};

  if (body.vaccineId !== undefined) {
    const vaccineId = normalizeId(body.vaccineId, "Le vaccin");
    await ensureVaccineExists(vaccineId);
    data.vaccineId = vaccineId;
  }

  if (body.vaccineCalendarId !== undefined) {
    const calendarId = normalizeId(
      body.vaccineCalendarId,
      "Le calendrier vaccinal",
    );
    await ensureCalendarExists(calendarId);
    data.vaccineCalendarId = calendarId;
  }

  if (body.scheduledFor !== undefined) {
    data.scheduledFor = parseDateValue(
      body.scheduledFor,
      "La date prévue",
    );
  }

  if (body.dose !== undefined) {
    data.dose = parseDoseValue(body.dose);
  }

  if (!Object.keys(data).length) {
    throw makeHttpError("Aucune donnée à mettre à jour.");
  }

  return data;
};

const buildLateCreateData = async (body, { childId }) => {
  const vaccineId = normalizeId(body.vaccineId, "Le vaccin");
  await ensureVaccineExists(vaccineId);

  const calendarId = normalizeId(
    body.vaccineCalendarId,
    "Le calendrier vaccinal",
  );
  await ensureCalendarExists(calendarId);

  const dueDate = parseDateValue(body.dueDate, "La date limite");
  const dose = parseDoseValue(body.dose);

  return {
    childId,
    vaccineId,
    vaccineCalendarId: calendarId,
    dueDate,
    dose,
  };
};

const buildLateUpdateData = async (body) => {
  const data = {};

  if (body.vaccineId !== undefined) {
    const vaccineId = normalizeId(body.vaccineId, "Le vaccin");
    await ensureVaccineExists(vaccineId);
    data.vaccineId = vaccineId;
  }

  if (body.vaccineCalendarId !== undefined) {
    const calendarId = normalizeId(
      body.vaccineCalendarId,
      "Le calendrier vaccinal",
    );
    await ensureCalendarExists(calendarId);
    data.vaccineCalendarId = calendarId;
  }

  if (body.dueDate !== undefined) {
    data.dueDate = parseDateValue(body.dueDate, "La date limite");
  }

  if (body.dose !== undefined) {
    data.dose = parseDoseValue(body.dose);
  }

  if (!Object.keys(data).length) {
    throw makeHttpError("Aucune donnée à mettre à jour.");
  }

  return data;
};

const buildCompletedCreateData = async (body, { childId, user }) => {
  const vaccineId = normalizeId(body.vaccineId, "Le vaccin");
  await ensureVaccineExists(vaccineId);

  const calendarId = optionalId(body.vaccineCalendarId);
  if (calendarId) {
    await ensureCalendarExists(calendarId);
  }

  const administeredAt = parseDateValue(
    body.administeredAt,
    "La date d'administration",
  );
  const dose = parseDoseValue(body.dose);
  const administeredById =
    optionalId(body.administeredById) ?? user.id;

  return {
    childId,
    vaccineId,
    vaccineCalendarId: calendarId,
    administeredAt,
    administeredById,
    dose,
  };
};

const buildCompletedUpdateData = async (body) => {
  const data = {};

  if (body.vaccineId !== undefined) {
    const vaccineId = normalizeId(body.vaccineId, "Le vaccin");
    await ensureVaccineExists(vaccineId);
    data.vaccineId = vaccineId;
  }

  if (body.vaccineCalendarId !== undefined) {
    const calendarId = optionalId(body.vaccineCalendarId);
    if (calendarId) {
      await ensureCalendarExists(calendarId);
    }
    data.vaccineCalendarId = calendarId;
  }

  if (body.administeredAt !== undefined) {
    data.administeredAt = parseDateValue(
      body.administeredAt,
      "La date d'administration",
    );
  }

  if (body.dose !== undefined) {
    data.dose = parseDoseValue(body.dose);
  }

  if (body.administeredById !== undefined) {
    const adminId = optionalId(body.administeredById);
    if (!adminId) {
      throw makeHttpError("L'agent ayant administré le vaccin est requis.");
    }
    data.administeredById = adminId;
  }

  if (!Object.keys(data).length) {
    throw makeHttpError("Aucune donnée à mettre à jour.");
  }

  return data;
};

const MANUAL_BUCKETS = {
  due: {
    model: prisma.childVaccineDue,
    prepareCreate: (body, ctx) => buildDueCreateData(body, ctx),
    prepareUpdate: (body) => buildDueUpdateData(body),
  },
  late: {
    model: prisma.childVaccineLate,
    prepareCreate: (body, ctx) => buildLateCreateData(body, ctx),
    prepareUpdate: (body) => buildLateUpdateData(body),
  },
  overdue: {
    model: prisma.childVaccineOverdue,
    prepareCreate: (body, ctx) => buildLateCreateData(body, ctx),
    prepareUpdate: (body) => buildLateUpdateData(body),
  },
  completed: {
    model: prisma.childVaccineCompleted,
    prepareCreate: (body, ctx) => buildCompletedCreateData(body, ctx),
    prepareUpdate: (body) => buildCompletedUpdateData(body),
  },
};

const handleManualMutationError = (error, res, next) => {
  if (error?.status) {
    return res.status(error.status).json({ message: error.message });
  }
  if (error?.code === "P2002") {
    return res
      .status(409)
      .json({ message: "Une entrée existe déjà pour cette dose." });
  }
  if (error?.code === "P2003") {
    return res
      .status(400)
      .json({ message: "La référence fournie est invalide." });
  }
  return next(error);
};

/**
 * Vérifie si un vaccin correspond au genre d'un enfant
 * @param {Object} vaccine - Le vaccin avec son champ gender (peut être null, 'M', ou 'F')
 * @param {string} childGender - Le genre de l'enfant ('M' ou 'F')
 * @returns {boolean} - true si le vaccin peut être administré à cet enfant
 */
const isVaccineSuitableForGender = (vaccine, childGender) => {
  // Si le vaccin n'a pas de genre spécifié (null), il est pour tous
  if (!vaccine.gender) {
    return true;
  }
  // Si le vaccin a un genre, il doit correspondre au genre de l'enfant
  return vaccine.gender === childGender;
};

const mapChildrenForResponse = (child) => {
  const dueVaccines =
    child.dueVaccines?.map((entry) => ({
      name: entry.vaccine.name,
      scheduledFor: entry.scheduledFor,
      dose: entry.dose ?? 1,
      ageWindow: {
        unit: entry.vaccineCalendar?.ageUnit ?? null,
        specificAge: entry.vaccineCalendar?.specificAge ?? null,
        min: entry.vaccineCalendar?.minAge ?? null,
        max: entry.vaccineCalendar?.maxAge ?? null,
      },
    })) ?? [];

  const scheduledVaccines =
    child.scheduledVaccines?.map((entry) => ({
      name: entry.vaccine.name,
      scheduledFor: entry.scheduledFor,
      plannerId: entry.plannerId,
      plannerName: entry.planner
        ? `${entry.planner.firstName ?? ""} ${entry.planner.lastName ?? ""}`.trim()
        : null,
      dose: entry.dose ?? 1,
    })) ?? [];

  const lateVaccines =
    child.lateVaccines?.map((entry) => ({
      name: entry.vaccine.name,
      dueDate: entry.dueDate,
      dose: entry.dose ?? 1,
    })) ?? [];

  const overdueVaccines =
    child.overdueVaccines?.map((entry) => ({
      name: entry.vaccine.name,
      dueDate: entry.dueDate,
      dose: entry.dose ?? 1,
    })) ?? [];

  const completedVaccines =
    child.completedVaccines?.map((entry) => ({
      name: entry.vaccine.name,
      administeredAt: entry.administeredAt,
      administeredById: entry.administeredById,
      administeredByName: entry.administeredBy
        ? `${entry.administeredBy.firstName ?? ""} ${entry.administeredBy.lastName ?? ""}`.trim()
        : null,
      dose: entry.dose ?? 1,
    })) ?? [];

  return {
    id: child.id,
    firstName: child.firstName,
    lastName: child.lastName,
    name: `${child.firstName} ${child.lastName}`.trim(),
    gender: child.gender,
    birthDate: child.birthDate,
    region: child.healthCenter?.district?.commune?.region?.name ?? "",
    district: child.healthCenter?.district?.name ?? "",
    healthCenter: child.healthCenter?.name ?? "",
    parentName: child.fatherName || child.motherName || "",
    parentPhone: child.phoneParent,
    address: child.address ?? "",
    status: child.status,
    nextAppointment: child.nextAppointment,
    vaccinesDue: dueVaccines,
    vaccinesScheduled: scheduledVaccines,
    vaccinesLate: lateVaccines,
    vaccinesOverdue: overdueVaccines,
    vaccinesCompleted: completedVaccines,
    isActive: child.isActive ?? false,
    photosRequested: child.photosRequested ?? false,
    createdAt: child.birthDate,
    updatedAt: child.birthDate,
  };
};

const createChildren = async (req, res, next) => {
  if (req.user.role !== "AGENT") {
    return res.status(403).json({ message: "Accès refusé. Seuls les agents peuvent créer des enfants." });
  }

  if (!req.user.healthCenterId) {
    return res.status(400).json({ message: "Votre compte n'est pas associé à un centre de santé." });
  }

  const {
    firstName,
    lastName,
    birthDate,
    birthPlace,
    address,
    gender,
    healthCenterId,
    phoneParent,
    fatherName,
    motherName,
  } = req.body;

  const finalHealthCenterId = req.user.healthCenterId;

  const now = new Date();
  const birth = new Date(birthDate);

  const ageInDays = Math.floor((now.getTime() - birth.getTime()) / 86400000);
  const ageInWeeks = Math.floor(ageInDays / 7);
  const ageInMonths = Math.floor(ageInDays / 30.4375);
  const ageInYears = Math.floor(ageInDays / 365.25);

  const getAgeByUnit = (unit) => {
    switch (unit) {
      case "WEEKS":
        return ageInWeeks;
      case "MONTHS":
        return ageInMonths;
      case "YEARS":
        return ageInYears;
      default:
        return ageInWeeks;
    }
  };

  const computeDueDate = (unit, value) => {
    const result = new Date(birth);
    if (value == null) return result;
    if (unit === "WEEKS") {
      result.setDate(result.getDate() + value * 7);
    } else if (unit === "MONTHS") {
      result.setMonth(result.getMonth() + value);
    } else if (unit === "YEARS") {
      result.setFullYear(result.getFullYear() + value);
    } else {
      result.setDate(result.getDate() + value);
    }
    return result;
  };

  try {
    const calendarEntries = await prisma.vaccineCalendar.findMany({
      include: {
        doseAssignments: {
          include: {
            vaccine: {
              select: {
                id: true,
                name: true,
                gender: true,
                dosesRequired: true,
              },
            },
          },
        },
      },
    });

    const doseMap = buildVaccineDoseMap(calendarEntries);

    let createdChild;

    await prisma.$transaction(async (tx) => {
      createdChild = await tx.children.create({
        data: {
          firstName,
          lastName,
          birthDate: birth,
          birthPlace,
          address,
          gender,
          healthCenterId: finalHealthCenterId,
          status: "A_JOUR",
          phoneParent,
          fatherName,
          motherName,
          code: generateAccessCode(),
          isActive: false, // Par défaut non activé, sera activé selon le flux mobile
          photosRequested: false,
        },
      });

      const duePayload = [];
      const latePayload = [];
      let hasLate = false;

      for (const entry of calendarEntries) {
        const age = getAgeByUnit(entry.ageUnit);
        const dueDate =
          entry.specificAge != null
            ? computeDueDate(entry.ageUnit, entry.specificAge)
            : computeDueDate(entry.ageUnit, entry.maxAge);

        // Vérifier si l'enfant est dans la plage d'âge (minAge à maxAge)
        // Le specificAge est utilisé uniquement pour calculer la date cible, pas pour l'éligibilité
        const isWithinRange = age >= entry.minAge && age <= entry.maxAge;

        // Vérifier si l'enfant a dépassé la plage d'âge
        const isPastRange = age > entry.maxAge;

        if (isWithinRange) {
          for (const assignment of entry.doseAssignments ?? []) {
            const vaccine = assignment?.vaccine;
            if (!vaccine?.id) {
              continue;
            }
            if (!isVaccineSuitableForGender(vaccine, gender)) {
              continue;
            }
            const dose =
              typeof assignment.doseNumber === "number"
                ? assignment.doseNumber
                : null;
            if (dose == null) {
              continue;
            }
            duePayload.push({
              childId: createdChild.id,
              vaccineCalendarId: entry.id,
              vaccineId: vaccine.id,
              scheduledFor: dueDate,
              dose,
            });
          }
        } else if (isPastRange) {
          for (const assignment of entry.doseAssignments ?? []) {
            const vaccine = assignment?.vaccine;
            if (!vaccine?.id) {
              continue;
            }
            if (!isVaccineSuitableForGender(vaccine, gender)) {
              continue;
            }
            const dose =
              typeof assignment.doseNumber === "number"
                ? assignment.doseNumber
                : null;
            if (dose == null) {
              continue;
            }
            latePayload.push({
              childId: createdChild.id,
              vaccineCalendarId: entry.id,
              vaccineId: vaccine.id,
              dueDate,
              dose,
            });
            hasLate = true;
          }
        }
      }

      if (duePayload.length > 0) {
        await tx.childVaccineDue.createMany({
          data: duePayload,
          skipDuplicates: true,
        });
      }

      if (latePayload.length > 0) {
        await tx.childVaccineLate.createMany({
          data: latePayload,
          skipDuplicates: true,
        });
      }

      if (hasLate) {
        await tx.children.update({
          where: { id: createdChild.id },
          data: { status: "PAS_A_JOUR" },
        });
      }
    });

    try {
      await rebuildChildVaccinationBuckets(createdChild.id);
    } catch (rebuildError) {
      console.error("Erreur rebuildChildVaccinationBuckets:", rebuildError);
      // Ne pas bloquer la création si le rebuild échoue
    }

    const fullChild = await prisma.children.findUnique({
      where: { id: createdChild.id },
      include: {
        healthCenter: {
          select: {
            name: true,
            district: {
              select: {
                name: true,
                commune: {
                  select: {
                    region: { select: { name: true } },
                  },
                },
              },
            },
          },
        },
        completedVaccines: {
          include: {
            vaccine: { select: { name: true } },
            administeredBy: { select: { firstName: true, lastName: true } },
          },
        },
        dueVaccines: {
          include: {
            vaccine: { select: { name: true } },
            vaccineCalendar: {
              select: {
                ageUnit: true,
                specificAge: true,
                minAge: true,
                maxAge: true,
              },
            },
          },
        },
        scheduledVaccines: {
          include: { vaccine: { select: { name: true } } },
        },
        lateVaccines: {
          include: { vaccine: { select: { name: true } } },
        },
        overdueVaccines: {
          include: { vaccine: { select: { name: true } } },
        },
      },
    });

    res.status(201).json(mapChildrenForResponse(fullChild));

    // Enregistrer l'événement
    logEventAsync({
      type: "CHILD",
      action: "CREATE",
      user: {
        id: req.user.id,
        firstName: req.user.firstName,
        lastName: req.user.lastName,
        email: req.user.email,
        role: req.user.role,
      },
      entityType: "CHILD",
      entityId: fullChild.id,
      entityName: `${fullChild.firstName} ${fullChild.lastName}`,
      details: {
        firstName: fullChild.firstName,
        lastName: fullChild.lastName,
        birthDate: fullChild.birthDate,
        gender: fullChild.gender,
        healthCenterId: fullChild.healthCenterId,
      },
    });

    // Notifier les agents du centre (après la réponse pour ne pas bloquer)
    setImmediate(async () => {
      try {
        await notifyHealthCenterAgents({
          healthCenterId: fullChild.healthCenterId,
          title: "Nouvel enfant enregistré",
          message: `${req.user.firstName} ${req.user.lastName} a enregistré un nouvel enfant : ${fullChild.firstName} ${fullChild.lastName}`,
          type: "CHILD_CREATED",
          excludeUserId: req.user.id,
        });
      } catch (notifError) {
        console.error("Erreur notification agents:", notifError);
      }
    });

    try {
      await sendParentAccessCode({
        to: fullChild.phoneParent,
        parentName: fatherName || motherName || "Parent",
        childName: `${fullChild.firstName} ${fullChild.lastName}`,
        accessCode: fullChild.code,
      });
    } catch (emailError) {
      console.error("Erreur envoi email access code:", emailError);
      // Ne pas bloquer la création si l'email échoue
    }
  } catch (error) {
    next(error);
  }
};

const updateChildren = async (req, res, next) => {
  if (req.user.role !== "AGENT" && req.user.role !== "DISTRICT") {
    return res.status(403).json({ message: "Accès refusé" });
  }

  try {
    const { nextVaccineId, nextAgentId, nextAppointment } = req.body;
    const childrenId = req.params.id;

    const existingChild = await prisma.children.findUnique({
      where: { id: childrenId },
    });

    if (!existingChild) {
      return res.status(404).json({ message: "Enfant non trouvé" });
    }

    const updatedChild = await prisma.children.update({
      where: { id: childrenId },
      data: {
        nextVaccineId,
        nextAgentId,
        nextAppointment,
      },
    });

    // Enregistrer l'événement
    logEventAsync({
      type: "CHILD",
      action: "UPDATE",
      user: {
        id: req.user.id,
        firstName: req.user.firstName,
        lastName: req.user.lastName,
        email: req.user.email,
        role: req.user.role,
      },
      entityType: "CHILD",
      entityId: childrenId,
      entityName: `${existingChild.firstName} ${existingChild.lastName}`,
      details: {
        before: {
          nextVaccineId: existingChild.nextVaccineId,
          nextAgentId: existingChild.nextAgentId,
          nextAppointment: existingChild.nextAppointment,
        },
        after: {
          nextVaccineId: updatedChild.nextVaccineId,
          nextAgentId: updatedChild.nextAgentId,
          nextAppointment: updatedChild.nextAppointment,
        },
      },
    });

    // Notifier les agents du centre (après la réponse pour ne pas bloquer)
    setImmediate(async () => {
      try {
        await notifyHealthCenterAgents({
          healthCenterId: existingChild.healthCenterId,
          title: "Enfant modifié",
          message: `${req.user.firstName} ${req.user.lastName} a modifié les informations de ${existingChild.firstName} ${existingChild.lastName}`,
          type: "CHILD_UPDATED",
          excludeUserId: req.user.id,
        });
      } catch (notifError) {
        console.error("Erreur notification agents:", notifError);
      }
    });

    res.json(updatedChild);
  } catch (error) {
    next(error);
  }
};

const getChildren = async (req, res, next) => {
  if (!["SUPERADMIN", "NATIONAL", "REGIONAL", "DISTRICT", "AGENT"].includes(req.user.role)) {
    return res.status(403).json({ message: "Accès refusé" });
  }

  try {
    let whereClause = {};
    
    // Filtre par statut d'activation (active, inactive, all)
    const statusFilter = req.query.status;
    if (statusFilter === "active") {
      whereClause.isActive = true;
    } else if (statusFilter === "inactive") {
      whereClause.isActive = false;
    }
    // Si "all" ou non spécifié, on ne filtre pas

    // Pour SUPERADMIN, appliquer les filtres optionnels depuis les query params
    if (req.user.role === "SUPERADMIN") {
      const { regionId, districtId, healthCenterId } = req.query;
      
      if (healthCenterId) {
        whereClause.healthCenterId = healthCenterId;
      } else if (districtId) {
        whereClause.healthCenter = {
          districtId: districtId,
        };
      } else if (regionId) {
        whereClause.healthCenter = {
          district: {
            commune: {
              regionId: regionId,
            },
          },
        };
      }
      // Si aucun filtre, on voit tout (comme NATIONAL)
    }

    if (req.user.role === "REGIONAL") {
      const regional = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: { regionId: true },
      });

      if (!regional?.regionId) {
        return res.json({ total: 0, items: [] });
      }

      whereClause = {
        ...whereClause,
        healthCenter: {
          district: {
            commune: {
              regionId: regional.regionId,
            },
          },
        },
      };
    }

    if (req.user.role === "DISTRICT") {
      const districtUser = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: { districtId: true },
      });

      if (!districtUser?.districtId) {
        return res.json({ total: 0, items: [] });
      }

      whereClause = {
        ...whereClause,
        healthCenter: {
          districtId: districtUser.districtId,
        },
      };
    }

    if (req.user.role === "AGENT") {
      const agent = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: { healthCenterId: true },
      });

      if (!agent?.healthCenterId) {
        return res.json({ total: 0, items: [] });
      }

      whereClause = {
        ...whereClause,
        healthCenterId: agent.healthCenterId,
      };
    }

    const children = await prisma.children.findMany({
      where: whereClause,
      include: {
        healthCenter: {
          select: {
            name: true,
            district: {
              select: {
                name: true,
                commune: {
                  select: {
                    region: { select: { name: true } },
                  },
                },
              },
            },
          },
        },
        completedVaccines: {
          include: { vaccine: { select: { name: true } } },
        },
        dueVaccines: {
          include: {
            vaccine: { select: { name: true } },
            vaccineCalendar: {
              select: {
                ageUnit: true,
                specificAge: true,
                minAge: true,
                maxAge: true,
              },
            },
          },
        },
        scheduledVaccines: {
          include: {
            vaccine: { select: { name: true } },
            planner: { select: { id: true, firstName: true, lastName: true } },
          },
        },
        lateVaccines: {
          include: { vaccine: { select: { name: true } } },
        },
        overdueVaccines: {
          include: { vaccine: { select: { name: true } } },
        },
      },
    });

    res.json({
      total: children.length,
      items: children.map(mapChildrenForResponse),
    });
  } catch (error) {
    console.error("getChildren error:", error);
    next(error);
  }
};

const getChildVaccinations = async (req, res, next) => {
  const { id } = req.params;

  try {
    const child = await prisma.children.findUnique({
      where: { id },
      include: {
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
                    region: { select: { id: true, name: true } },
                  },
                },
              },
            },
          },
        },
        dueVaccines: {
          include: {
            vaccine: { select: { id: true, name: true } },
            vaccineCalendar: {
              select: {
                id: true,
                description: true,
                ageUnit: true,
                specificAge: true,
                minAge: true,
                maxAge: true,
              },
            },
          },
        },
        scheduledVaccines: {
          include: {
            vaccine: { select: { id: true, name: true } },
            planner: {
              select: { id: true, firstName: true, lastName: true },
            },
          },
        },
        lateVaccines: {
          include: {
            vaccine: { select: { id: true, name: true } },
            vaccineCalendar: { select: { id: true, description: true } },
          },
        },
        overdueVaccines: {
          include: {
            vaccine: { select: { id: true, name: true } },
            vaccineCalendar: { select: { id: true, description: true } },
          },
        },
        completedVaccines: {
          include: {
            vaccine: { select: { id: true, name: true } },
            administeredBy: {
              select: { id: true, firstName: true, lastName: true },
            },
          },
        },
      },
    });

    if (!child) {
      return res.status(404).json({ message: "Enfant non trouvé" });
    }

    if (!hasChildAccess(req.user, child)) {
      return res.status(403).json({ message: "Accès refusé" });
    }

    res.json({
      child: {
        id: child.id,
        firstName: child.firstName,
        lastName: child.lastName,
        name: `${child.firstName} ${child.lastName}`.trim(),
        gender: child.gender,
        birthDate: child.birthDate,
        status: child.status,
        parentName: child.fatherName || child.motherName || "",
        parentPhone: child.phoneParent,
        address: child.address,
        region: child.healthCenter?.district?.commune?.region?.name ?? "",
        district: child.healthCenter?.district?.name ?? "",
        healthCenter: child.healthCenter?.name ?? "",
      },
      vaccinations: {
        due: child.dueVaccines.map((entry) => ({
          id: entry.id,
          vaccineId: entry.vaccineId,
          vaccineName: entry.vaccine.name,
          scheduledFor: entry.scheduledFor,
          calendarId: entry.vaccineCalendarId,
          calendarDescription: entry.vaccineCalendar?.description ?? null,
          ageUnit: entry.vaccineCalendar?.ageUnit ?? null,
          specificAge: entry.vaccineCalendar?.specificAge ?? null,
          minAge: entry.vaccineCalendar?.minAge ?? null,
          maxAge: entry.vaccineCalendar?.maxAge ?? null,
          dose: entry.dose ?? 1,
        })),
        scheduled: child.scheduledVaccines.map((entry) => ({
          id: entry.id,
          vaccineId: entry.vaccineId,
          vaccineName: entry.vaccine.name,
          scheduledFor: entry.scheduledFor,
          plannerId: entry.plannerId,
          plannerName: entry.planner
            ? `${entry.planner.firstName ?? ""} ${entry.planner.lastName ?? ""}`.trim()
            : null,
          calendarId: entry.vaccineCalendarId,
          dose: entry.dose ?? 1,
        })),
        late: child.lateVaccines.map((entry) => ({
          id: entry.id,
          vaccineId: entry.vaccineId,
          vaccineName: entry.vaccine.name,
          dueDate: entry.dueDate,
          calendarId: entry.vaccineCalendarId,
          calendarDescription: entry.vaccineCalendar?.description,
          dose: entry.dose ?? 1,
        })),
        overdue: child.overdueVaccines.map((entry) => ({
          id: entry.id,
          vaccineId: entry.vaccineId,
          vaccineName: entry.vaccine.name,
          dueDate: entry.dueDate,
          calendarId: entry.vaccineCalendarId,
          calendarDescription: entry.vaccineCalendar?.description,
          dose: entry.dose ?? 1,
        })),
        completed: child.completedVaccines.map((entry) => ({
          id: entry.id,
          vaccineId: entry.vaccineId,
          vaccineName: entry.vaccine.name,
          administeredAt: entry.administeredAt,
          administeredById: entry.administeredById,
          administeredByName: entry.administeredBy
            ? `${entry.administeredBy.firstName ?? ""} ${entry.administeredBy.lastName ?? ""}`.trim()
            : null,
          calendarId: entry.vaccineCalendarId,
          dose: entry.dose ?? 1,
        })),
      },
    });
  } catch (error) {
    next(error);
  }
};

const createManualVaccinationEntry = async (req, res, next) => {
  const { id: childId, bucket } = req.params;
  const config = MANUAL_BUCKETS[bucket];

  if (!config) {
    return res.status(400).json({ message: "Type d'entrée invalide." });
  }

  try {
    const child = await prisma.children.findUnique({
      where: { id: childId },
      select: childAccessSelect,
    });

    if (!child) {
      return res.status(404).json({ message: "Enfant non trouvé." });
    }

    if (!hasManualVaccinationAccess(req.user, child)) {
      return res.status(403).json({ message: "Accès refusé" });
    }

    const data = await config.prepareCreate(req.body ?? {}, {
      childId,
      user: req.user,
    });

    const record = await config.model.create({ data });

    return res.status(201).json({ success: true, id: record.id });
  } catch (error) {
    return handleManualMutationError(error, res, next);
  }
};

const updateManualVaccinationEntry = async (req, res, next) => {
  const { id: childId, bucket, entryId } = req.params;
  const config = MANUAL_BUCKETS[bucket];

  if (!config) {
    return res.status(400).json({ message: "Type d'entrée invalide." });
  }

  try {
    const entry = await config.model.findUnique({
      where: { id: entryId },
      include: {
        child: {
          select: childAccessSelect,
        },
      },
    });

    if (!entry || entry.childId !== childId) {
      return res.status(404).json({ message: "Entrée introuvable." });
    }

    if (!hasManualVaccinationAccess(req.user, entry.child)) {
      return res.status(403).json({ message: "Accès refusé" });
    }

    const data = await config.prepareUpdate(req.body ?? {});

    if (!data || Object.keys(data).length === 0) {
      return res
        .status(400)
        .json({ message: "Aucune donnée à mettre à jour." });
    }

    await config.model.update({
      where: { id: entryId },
      data,
    });

    return res.json({ success: true });
  } catch (error) {
    return handleManualMutationError(error, res, next);
  }
};

const deleteManualVaccinationEntry = async (req, res, next) => {
  const { id: childId, bucket, entryId } = req.params;
  const config = MANUAL_BUCKETS[bucket];

  if (!config) {
    return res.status(400).json({ message: "Type d'entrée invalide." });
  }

  try {
    const entry = await config.model.findUnique({
      where: { id: entryId },
      include: {
        child: {
          select: childAccessSelect,
        },
      },
    });

    if (!entry || entry.childId !== childId) {
      return res.status(404).json({ message: "Entrée introuvable." });
    }

    if (!hasManualVaccinationAccess(req.user, entry.child)) {
      return res.status(403).json({ message: "Accès refusé" });
    }

    await config.model.delete({
      where: { id: entryId },
    });

    return res.json({ success: true });
  } catch (error) {
    return handleManualMutationError(error, res, next);
  }
};

const getParentsOverview = async (req, res, next) => {
  if (
    !["NATIONAL", "REGIONAL", "DISTRICT", "AGENT"].includes(req.user.role)
  ) {
    return res.status(403).json({ message: "Accès refusé" });
  }

  // Pour les agents, vérifier qu'ils sont admin ou staff
  if (req.user.role === "AGENT") {
    if (!["ADMIN", "STAFF"].includes(req.user.agentLevel)) {
      return res.status(403).json({ message: "Accès refusé" });
    }
  }

  try {
    let whereClause = {};

    if (req.user.role === "REGIONAL") {
      const regionUser = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: { regionId: true },
      });

      if (!regionUser?.regionId) {
        return res.json({ success: true, data: [] });
      }

      whereClause = {
        healthCenter: {
          district: {
            commune: {
              regionId: regionUser.regionId,
            },
          },
        },
      };
    } else if (req.user.role === "DISTRICT") {
      // Pour les districts, filtrer par leur district
      if (!req.user.districtId) {
        return res.json({ success: true, data: [] });
      }

      whereClause = {
        healthCenter: {
          districtId: req.user.districtId,
        },
      };
    } else if (req.user.role === "AGENT") {
      // Pour les agents, filtrer par leur centre de santé
      if (!req.user.healthCenterId) {
        return res.json({ success: true, data: [] });
      }

      whereClause = {
        healthCenterId: req.user.healthCenterId,
      };
    }

    const children = await prisma.children.findMany({
      where: whereClause,
      include: {
        healthCenter: {
          select: {
            name: true,
            district: {
              select: {
                name: true,
                commune: {
                  select: {
                    region: { select: { name: true } },
                  },
                },
              },
            },
          },
        },
      },
    });

    const parentsMap = new Map();

    children.forEach((child) => {
      const key =
        child.phoneParent ||
        `${child.fatherName ?? ""}-${child.motherName ?? ""}`.trim();
      if (!key) return;

      if (!parentsMap.has(key)) {
        parentsMap.set(key, {
          parentPhone: child.phoneParent ?? "",
          parentName: child.fatherName || child.motherName || "Parent",
          children: [],
          regions: new Set(),
          healthCenters: new Set(),
        });
      }

      const parentEntry = parentsMap.get(key);
      parentEntry.children.push({
        id: child.id,
        firstName: child.firstName,
        lastName: child.lastName,
        gender: child.gender,
        status: child.status,
        region: child.healthCenter?.district?.commune?.region?.name ?? child.healthCenter?.district?.name ?? "",
        healthCenter: child.healthCenter?.name ?? "",
        nextAppointment: child.nextAppointment,
        birthDate: child.birthDate,
      });

      if (child.healthCenter?.district?.commune?.region?.name) {
        parentEntry.regions.add(child.healthCenter.district.commune.region.name);
      }
      if (child.healthCenter?.name) {
        parentEntry.healthCenters.add(child.healthCenter.name);
      }
    });

    const data = Array.from(parentsMap.values()).map((entry) => ({
      parentPhone: entry.parentPhone,
      parentName: entry.parentName,
      childrenCount: entry.children.length,
      children: entry.children,
      regions: Array.from(entry.regions),
      healthCenters: Array.from(entry.healthCenters),
    }));

    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

const deleteChild = async (req, res, next) => {
  if (req.user.role !== "AGENT" || !req.user.healthCenterId) {
    return res.status(403).json({ message: "Accès refusé" });
  }

  try {
    const { id } = req.params;

    const child = await prisma.children.findUnique({
      where: { id },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        healthCenterId: true,
      },
    });

    if (!child) {
      return res.status(404).json({ message: "Enfant introuvable" });
    }

    // Vérifier que l'enfant appartient au centre de santé de l'agent
    if (child.healthCenterId !== req.user.healthCenterId) {
      return res.status(403).json({ message: "Accès refusé pour cet enfant" });
    }

    // Supprimer toutes les données liées en cascade
    await prisma.$transaction(async (tx) => {
      // Supprimer les réservations de stock liées aux rendez-vous
      const scheduledVaccines = await tx.childVaccineScheduled.findMany({
        where: { childId: id },
        select: { id: true },
      });

      const scheduleIds = scheduledVaccines.map((s) => s.id);
      if (scheduleIds.length > 0) {
        await tx.stockReservation.deleteMany({
          where: { scheduleId: { in: scheduleIds } },
        });
      }

      // Supprimer les vaccinations
      await tx.childVaccineScheduled.deleteMany({ where: { childId: id } });
      await tx.childVaccineCompleted.deleteMany({ where: { childId: id } });
      await tx.childVaccineDue.deleteMany({ where: { childId: id } });
      await tx.childVaccineLate.deleteMany({ where: { childId: id } });
      await tx.childVaccineOverdue.deleteMany({ where: { childId: id } });

      // Supprimer les demandes de vaccin
      await tx.vaccineRequest.deleteMany({ where: { childId: id } });

      // Supprimer les enregistrements (Record utilise childrenId)
      await tx.record.deleteMany({ where: { childrenId: id } });

      // Supprimer l'enfant
      await tx.children.delete({ where: { id } });
    });

    // Enregistrer l'événement
    logEventAsync({
      type: "CHILD",
      action: "DELETE",
      user: {
        id: req.user.id,
        firstName: req.user.firstName,
        lastName: req.user.lastName,
        email: req.user.email,
        role: req.user.role,
      },
      entityType: "CHILD",
      entityId: id,
      entityName: `${child.firstName} ${child.lastName}`,
      details: {
        firstName: child.firstName,
        lastName: child.lastName,
        healthCenterId: child.healthCenterId,
      },
    });

    // Notifier les agents du centre (après la réponse pour ne pas bloquer)
    setImmediate(async () => {
      try {
        await notifyHealthCenterAgents({
          healthCenterId: child.healthCenterId,
          title: "Enfant supprimé",
          message: `${req.user.firstName} ${req.user.lastName} a supprimé l'enfant ${child.firstName} ${child.lastName}`,
          type: "CHILD_DELETED",
          excludeUserId: req.user.id,
        });
      } catch (notifError) {
        console.error("Erreur notification agents:", notifError);
      }
    });

    res.json({ message: "Enfant supprimé avec succès" });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/children/:id/activate
 * Active le compte d'un enfant
 */
const activateChild = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Vérifier les permissions (seuls les agents peuvent activer)
    if (req.user.role !== "AGENT" && req.user.role !== "NATIONAL") {
      return res.status(403).json({ message: "Accès refusé" });
    }

    const child = await prisma.children.findUnique({
      where: { id },
      include: {
        healthCenter: {
          select: {
            district: {
              select: {
                commune: {
                  select: {
                    region: {
                      select: { id: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!child) {
      return res.status(404).json({ message: "Enfant non trouvé" });
    }

    // Vérifier l'accès géographique
    let hasAccess = false;
    if (req.user.role === "NATIONAL") {
      hasAccess = true;
    } else if (req.user.role === "REGIONAL") {
      const regionId = child.healthCenter?.district?.commune?.region?.id;
      hasAccess = req.user.regionId && regionId && req.user.regionId === regionId;
    } else if (req.user.role === "DISTRICT") {
      const districtId = child.healthCenter?.districtId;
      hasAccess = req.user.districtId && districtId && req.user.districtId === districtId;
    } else if (req.user.role === "AGENT") {
      hasAccess = req.user.healthCenterId && child.healthCenterId && 
                  req.user.healthCenterId === child.healthCenterId;
    }

    if (!hasAccess) {
      return res.status(403).json({ message: "Accès refusé" });
    }

    // Activer le compte
    const updatedChild = await prisma.children.update({
      where: { id },
      data: {
        isActive: true,
        photosRequested: false, // Réinitialiser la demande de photos
      },
    });

    // Envoyer un message WhatsApp au parent
    const { sendAccountActivationWhatsApp } = require("../services/whatsapp");
    const { notifyAccountActivated } = require("../services/notificationService");
    try {
      const parentName = child.fatherName || child.motherName || "Parent";
      const childName = `${child.firstName} ${child.lastName}`;
      await sendAccountActivationWhatsApp(child.phoneParent, parentName, childName);
      
      // Créer une notification dans l'application mobile
      try {
        await notifyAccountActivated({
          childId: child.id,
          childName,
        });
      } catch (notificationError) {
        console.error("Erreur création notification activation:", notificationError);
        // Ne pas bloquer l'activation si la notification échoue
      }
    } catch (whatsappError) {
      console.error("Erreur envoi WhatsApp:", whatsappError);
      // Ne pas bloquer l'activation si WhatsApp échoue
    }

    res.json({
      success: true,
      message: "Compte activé avec succès",
      child: updatedChild,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/children/:id/request-photos
 * Demande de nouvelles photos au parent
 */
const requestPhotos = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Vérifier les permissions (seuls les agents peuvent demander des photos)
    if (req.user.role !== "AGENT" && req.user.role !== "NATIONAL") {
      return res.status(403).json({ message: "Accès refusé" });
    }

    const child = await prisma.children.findUnique({
      where: { id },
      include: {
        healthCenter: {
          select: {
            district: {
              select: {
                commune: {
                  select: {
                    region: {
                      select: { id: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!child) {
      return res.status(404).json({ message: "Enfant non trouvé" });
    }

    // Vérifier l'accès géographique
    let hasAccess = false;
    if (req.user.role === "NATIONAL") {
      hasAccess = true;
    } else if (req.user.role === "REGIONAL") {
      const regionId = child.healthCenter?.district?.commune?.region?.id;
      hasAccess = req.user.regionId && regionId && req.user.regionId === regionId;
    } else if (req.user.role === "DISTRICT") {
      const districtId = child.healthCenter?.districtId;
      hasAccess = req.user.districtId && districtId && req.user.districtId === districtId;
    } else if (req.user.role === "AGENT") {
      hasAccess = req.user.healthCenterId && child.healthCenterId && 
                  req.user.healthCenterId === child.healthCenterId;
    }

    if (!hasAccess) {
      return res.status(403).json({ message: "Accès refusé" });
    }

    // Marquer que des photos sont demandées
    const updatedChild = await prisma.children.update({
      where: { id },
      data: {
        photosRequested: true,
        isActive: false, // S'assurer que le compte reste non activé
      },
    });

    // Envoyer un message WhatsApp au parent
    const { sendPhotoRequestWhatsApp } = require("../services/whatsapp");
    try {
      const parentName = child.fatherName || child.motherName || "Parent";
      const childName = `${child.firstName} ${child.lastName}`;
      await sendPhotoRequestWhatsApp(child.phoneParent, parentName, childName);
    } catch (whatsappError) {
      console.error("Erreur envoi WhatsApp:", whatsappError);
      // Ne pas bloquer la demande si WhatsApp échoue
    }

    res.json({
      success: true,
      message: "Demande de nouvelles photos envoyée",
      child: updatedChild,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createChildren,
  updateChildren,
  getChildren,
  getChildVaccinations,
  createManualVaccinationEntry,
  updateManualVaccinationEntry,
  deleteManualVaccinationEntry,
  getParentsOverview,
  deleteChild,
  activateChild,
  requestPhotos,
};