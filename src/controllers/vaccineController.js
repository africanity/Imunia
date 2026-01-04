const PDFDocument = require("pdfkit");
const prisma = require("../config/prismaClient");
const {
  notifyVaccineScheduled,
  notifyVaccineMissed,
  notifyVaccineLate,
  notifyAppointmentUpdated,
  notifyAppointmentCancelled,
  notifyHealthCenterAgents,
} = require("../services/notificationService");
const { get } = require("../routes");
const {
  reserveDoseForHealthCenter,
  releaseDoseForHealthCenter,
  deleteLotCascade,
  OWNER_TYPES,
} = require("../services/stockLotService");
const {
  rebuildChildVaccinationBuckets,
} = require("../services/vaccineBucketService");
const { logEventAsync } = require("../services/eventLogService");

/**
 * Réassigne automatiquement les doses pour tous les rendez-vous d'un enfant pour un vaccin donné
 * Les doses sont assignées selon l'ordre chronologique : le rendez-vous le plus proche prend la dose la plus petite disponible
 * @param {Object} tx - Transaction Prisma
 * @param {string} childId - ID de l'enfant
 * @param {string} vaccineId - ID du vaccin
 */
const reassignDosesForVaccine = async (tx, childId, vaccineId) => {
  // Récupérer tous les rendez-vous programmés pour ce vaccin et cet enfant, triés par date
  const scheduledAppointments = await tx.childVaccineScheduled.findMany({
    where: {
      childId,
      vaccineId,
    },
    orderBy: {
      scheduledFor: "asc",
    },
    select: {
      id: true,
      scheduledFor: true,
      dose: true,
    },
  });

  if (scheduledAppointments.length === 0) {
    return;
  }

  // Récupérer les doses déjà complétées pour ce vaccin
  const completedDoses = await tx.childVaccineCompleted.findMany({
    where: {
      childId,
      vaccineId,
    },
    select: {
      dose: true,
    },
  });

  const completedDoseValues = completedDoses
    .map((c) => (typeof c.dose === "number" ? c.dose : null))
    .filter((dose) => dose != null);
  const scheduledDoseValues = scheduledAppointments
    .map((s) => (typeof s.dose === "number" ? s.dose : null))
    .filter((dose) => dose != null);

  const completedDoseNumbers = new Set(completedDoseValues);

  const maxCompletedDose =
    completedDoseValues.length > 0 ? Math.max(...completedDoseValues) : 0;
  const maxScheduledDose =
    scheduledDoseValues.length > 0 ? Math.max(...scheduledDoseValues) : 0;
  const tempBase = Math.max(maxCompletedDose, maxScheduledDose) + 1;

  // Première passe : attribuer des doses temporaires uniques au-delà des doses existantes
  for (let i = 0; i < scheduledAppointments.length; i += 1) {
    await tx.childVaccineScheduled.update({
      where: { id: scheduledAppointments[i].id },
      data: { dose: tempBase + i },
    });
  }

  // Deuxième passe : assigner les doses finales dans l'ordre chronologique en sautant les doses complétées
  let currentDose = 1;

  // Assigner les doses dans l'ordre chronologique
  for (const appointment of scheduledAppointments) {
    // Trouver la prochaine dose disponible (non complétée)
    while (completedDoseNumbers.has(currentDose)) {
      currentDose++;
    }

    // Mettre à jour le rendez-vous avec la dose assignée
    await tx.childVaccineScheduled.update({
      where: { id: appointment.id },
      data: { dose: currentDose },
    });

    // Passer à la dose suivante pour le prochain rendez-vous
    currentDose++;
  }
};

/**
 * Met à jour nextAppointment avec le prochain rendez-vous le plus proche pour un enfant
 * @param {Object} tx - Transaction Prisma
 * @param {string} childId - ID de l'enfant
 */
const updateNextAppointment = async (tx, childId) => {
  const nextScheduled = await tx.childVaccineScheduled.findFirst({
    where: { childId },
    orderBy: { scheduledFor: "asc" },
    select: { scheduledFor: true, vaccineId: true, plannerId: true },
  });

  await tx.children.update({
    where: { id: childId },
    data: {
      nextAppointment: nextScheduled?.scheduledFor || null,
      nextVaccineId: nextScheduled?.vaccineId || null,
      nextAgentId: nextScheduled?.plannerId || null,
    },
  });
};

const DAYS_PER_WEEK = 7;
const DAYS_PER_MONTH = 30.4375;
const DAYS_PER_YEAR = 365.25;

const normalizeAgeToDays = (value, unit) => {
  if (value == null || Number.isNaN(Number(value))) {
    return null;
  }
  const numeric = Number(value);
  switch (unit) {
    case "WEEKS":
      return numeric * DAYS_PER_WEEK;
    case "MONTHS":
      return numeric * DAYS_PER_MONTH;
    case "YEARS":
      return numeric * DAYS_PER_YEAR;
    default:
      return numeric;
  }
};

const formatDaysLabel = (days) => {
  if (days == null) {
    return null;
  }
  let remaining = Math.max(0, Math.round(days));
  const years = Math.floor(remaining / DAYS_PER_YEAR);
  remaining -= years * DAYS_PER_YEAR;
  const months = Math.floor(remaining / DAYS_PER_MONTH);
  remaining -= months * DAYS_PER_MONTH;
  const weeks = Math.floor(remaining / DAYS_PER_WEEK);
  const parts = [];
  if (years) {
    parts.push(`${years} an${years > 1 ? "s" : ""}`);
  }
  if (months) {
    parts.push(`${months} mois`);
  }
  if (weeks) {
    parts.push(`${weeks} semaine${weeks > 1 ? "s" : ""}`);
  }
  if (!parts.length) {
    return "0 semaine";
  }
  return parts.join(" ");
};

const buildCalendarTargetLabel = (calendar) => {
  const days = normalizeAgeToDays(calendar.specificAge, calendar.ageUnit);
  return formatDaysLabel(days);
};

const buildCalendarRangeLabel = (calendar) => {
  const minDays = normalizeAgeToDays(calendar.minAge, calendar.ageUnit);
  const maxDays = normalizeAgeToDays(calendar.maxAge, calendar.ageUnit);
  const minLabel = formatDaysLabel(minDays);
  const maxLabel = formatDaysLabel(maxDays);
  if (minLabel && maxLabel) {
    return `${minLabel} - ${maxLabel}`;
  }
  if (minLabel) {
    return `À partir de ${minLabel}`;
  }
  if (maxLabel) {
    return `Jusqu'à ${maxLabel}`;
  }
  return null;
};

const computeCalendarAgeWeight = (calendar) => {
  if (!calendar) {
    return 0;
  }
  const specific = normalizeAgeToDays(
    calendar.specificAge,
    calendar.ageUnit,
  );
  if (specific != null) {
    return specific;
  }
  const min = normalizeAgeToDays(calendar.minAge, calendar.ageUnit);
  if (min != null) {
    return min;
  }
  const max = normalizeAgeToDays(calendar.maxAge, calendar.ageUnit);
  if (max != null) {
    return max;
  }
  return 0;
};

const reassignVaccineDoseNumbers = async (vaccineIds = []) => {
  const uniqueIds = Array.from(new Set(vaccineIds.filter(Boolean)));
  if (!uniqueIds.length) {
    return;
  }

  const assignments = await prisma.vaccineCalendarDose.findMany({
    where: { vaccineId: { in: uniqueIds } },
    include: {
      calendar: {
        select: {
          id: true,
          specificAge: true,
          minAge: true,
          maxAge: true,
          ageUnit: true,
        },
      },
    },
  });

  const perVaccine = new Map();
  for (const assignment of assignments) {
    if (!perVaccine.has(assignment.vaccineId)) {
      perVaccine.set(assignment.vaccineId, []);
    }
    perVaccine.get(assignment.vaccineId).push(assignment);
  }

  const updates = [];

  for (const [vaccineId, list] of perVaccine.entries()) {
    list.sort((a, b) => {
      const weightDiff =
        computeCalendarAgeWeight(a.calendar) -
        computeCalendarAgeWeight(b.calendar);
      if (weightDiff !== 0) {
        return weightDiff;
      }
      const calendarIdA = a.calendar?.id ?? "";
      const calendarIdB = b.calendar?.id ?? "";
      const calendarDiff = calendarIdA.localeCompare(calendarIdB);
      if (calendarDiff !== 0) {
        return calendarDiff;
      }
      return a.id.localeCompare(b.id);
    });

    const tempBase = list.length + 10;

    list.forEach((assignment, index) => {
      const tempDose = tempBase + index;
      if (assignment.doseNumber !== tempDose) {
        updates.push(
          prisma.vaccineCalendarDose.update({
            where: { id: assignment.id },
            data: { doseNumber: tempDose },
          }),
        );
      }
    });

    list.forEach((assignment, index) => {
      const desiredDose = index + 1;
      updates.push(
        prisma.vaccineCalendarDose.update({
          where: { id: assignment.id },
          data: { doseNumber: desiredDose },
        }),
      );
    });
  }

  if (updates.length) {
    await prisma.$transaction(updates);
  }
};

const calendarAssignmentsInclude = {
  doseAssignments: {
    include: {
      vaccine: {
        select: {
          id: true,
          name: true,
          description: true,
          dosesRequired: true,
          gender: true,
        },
      },
    },
    orderBy: {
      doseNumber: "asc",
    },
  },
};

const formatCalendarForResponse = (calendar) => {
  if (!calendar) {
    return calendar;
  }

  const aggregates = new Map();
  for (const assignment of calendar.doseAssignments ?? []) {
    const vaccine = assignment?.vaccine;
    if (!vaccine?.id) {
      continue;
    }
    if (!aggregates.has(vaccine.id)) {
      aggregates.set(vaccine.id, {
        vaccine,
        count: 0,
        minDose: null,
        maxDose: null,
        doses: [],
      });
    }
    const bucket = aggregates.get(vaccine.id);
    bucket.count += 1;
    const doseNumber = assignment.doseNumber ?? null;
    if (doseNumber != null) {
      bucket.doses.push(doseNumber);
      if (bucket.minDose == null || doseNumber < bucket.minDose) {
        bucket.minDose = doseNumber;
      }
      if (bucket.maxDose == null || doseNumber > bucket.maxDose) {
        bucket.maxDose = doseNumber;
      }
    }
  }

  const vaccines = Array.from(aggregates.values()).map(
    ({ vaccine, count, minDose, maxDose, doses }) => ({
      id: vaccine.id,
      name: vaccine.name,
      description: vaccine.description,
      dosesRequired: vaccine.dosesRequired,
      gender: vaccine.gender,
      doseCount: count,
      firstDoseNumber: minDose,
      lastDoseNumber: maxDose,
      doseNumbers: doses.sort((a, b) => a - b),
    }),
  );

  return {
    ...calendar,
    targetAgeLabel: buildCalendarTargetLabel(calendar),
    ageRangeLabel: buildCalendarRangeLabel(calendar),
    ageSortWeight: computeCalendarAgeWeight(calendar),
    vaccines,
  };
};

const makeHttpError = (message, status = 400) => {
  const err = new Error(message);
  err.status = status;
  return err;
};

const normalizeCalendarAssignments = async (
  tx,
  rawAssignments = [],
  { excludeCalendarId } = {},
) => {
  const counts = new Map();

  for (const entry of rawAssignments ?? []) {
    if (!entry) continue;
    const vaccineId = entry.vaccineId ?? entry.id ?? entry.vaccine_id;
    const rawCount =
      entry.doseCount ??
      entry.count ??
      entry.doses ??
      entry.quantity ??
      entry.dose ??
      0;
    const parsedCount = Number(rawCount);
    if (
      typeof vaccineId === "string" &&
      vaccineId.trim() &&
      Number.isFinite(parsedCount) &&
      parsedCount > 0
    ) {
      const current = counts.get(vaccineId.trim()) ?? 0;
      counts.set(vaccineId.trim(), current + Math.floor(parsedCount));
    }
  }

  if (!counts.size) {
    return [];
  }

  const vaccineIds = Array.from(counts.keys());

  const vaccines = await tx.vaccine.findMany({
    where: { id: { in: vaccineIds } },
    select: { id: true, name: true, dosesRequired: true },
  });

  if (vaccines.length !== vaccineIds.length) {
    throw makeHttpError("Certains vaccins sélectionnés sont introuvables.");
  }

  const doseLimits = new Map(
    vaccines.map((record) => {
      const parsedValue = Number(record.dosesRequired);
      const normalized =
        Number.isFinite(parsedValue) && parsedValue > 0
          ? Math.floor(parsedValue)
          : 1;
      return [record.id, normalized];
    }),
  );

  const existingCountsRaw = await tx.vaccineCalendarDose.groupBy({
    by: ["vaccineId"],
    where: {
      vaccineId: { in: vaccineIds },
      ...(excludeCalendarId
        ? { calendarId: { not: excludeCalendarId } }
        : {}),
    },
    _count: { vaccineId: true },
  });

  const existingCounts = new Map(
    existingCountsRaw.map((record) => [
      record.vaccineId,
      record._count?.vaccineId ?? 0,
    ]),
  );

  const normalized = [];

  for (const vaccine of vaccines) {
    const count = counts.get(vaccine.id) ?? 0;
    if (count <= 0) {
      continue;
    }
    const limit = doseLimits.get(vaccine.id) ?? 1;
    const alreadyUsed = existingCounts.get(vaccine.id) ?? 0;
    if (alreadyUsed + count > limit) {
      const label = vaccine.name ?? vaccine.id;
      throw makeHttpError(
        `Impossible d'assigner ${count} dose(s) supplémentaires pour ${label} : ce vaccin ne dispose que de ${limit} dose(s) au total.`,
      );
    }
    normalized.push({
      vaccineId: vaccine.id,
      count,
    });
  }

  return normalized;
};

const createVaccine = async (req, res, next) => {

  if (!["SUPERADMIN", "NATIONAL"].includes(req.user.role)) {
    return res.status(403).json({ message: "Accès refusé" });
  }

  try {
    const newVaccine = await prisma.vaccine.create({
      data: {
        name: req.body.name,
        description: req.body.description,
        dosesRequired: req.body.dosesRequired,
        gender: req.body.gender || null, // null = pour tous, 'M' = garçons, 'F' = filles
      },
    });

    // Enregistrer l'événement
    logEventAsync({
      type: "VACCINE",
      action: "CREATE",
      user: {
        id: req.user.id,
        firstName: req.user.firstName,
        lastName: req.user.lastName,
        email: req.user.email,
        role: req.user.role,
      },
      entityType: "VACCINE",
      entityId: newVaccine.id,
      entityName: newVaccine.name,
      details: {
        name: newVaccine.name,
        description: newVaccine.description,
        dosesRequired: newVaccine.dosesRequired,
        gender: newVaccine.gender,
      },
    });

    res.status(201).json(newVaccine);
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ message: error.message });
    }
    next(error);
  }
};

const getVaccine = async (req, res, next) => {
  const isAgent =
    req.user.role === "AGENT" && (req.user.agentLevel === "ADMIN" || req.user.agentLevel === "STAFF");

  if (
    !["SUPERADMIN", "NATIONAL", "REGIONAL", "DISTRICT"].includes(req.user.role) &&
    !isAgent
  ) {
    return res.status(403).json({ message: "Accès refusé" });
  }

  try {
    const [items, total] = await Promise.all([
      prisma.vaccine.findMany({
        include: {
          StockNATIONAL: true,
          StockREGIONAL: true,
          StockDISTRICT: true,
          StockHEALTHCENTER: true,
        },
        orderBy: { name: "asc" },
      }),
      prisma.vaccine.count(),
    ]);

    const vaccines = items.map((vaccine) => {
      // Calculer la somme des stocks régionaux
      const regionalTotal = Array.isArray(vaccine.StockREGIONAL)
        ? vaccine.StockREGIONAL.reduce((sum, stock) => sum + (stock.quantity ?? 0), 0)
        : 0;

      // Calculer la somme des stocks districts
      const districtTotal = Array.isArray(vaccine.StockDISTRICT)
        ? vaccine.StockDISTRICT.reduce((sum, stock) => sum + (stock.quantity ?? 0), 0)
        : 0;

      // Calculer la somme des stocks centres de santé
      const healthCenterTotal = Array.isArray(vaccine.StockHEALTHCENTER)
        ? vaccine.StockHEALTHCENTER.reduce((sum, stock) => sum + (stock.quantity ?? 0), 0)
        : 0;

      return {
        id: vaccine.id,
        name: vaccine.name,
        description: vaccine.description,
        dosesRequired: vaccine.dosesRequired,
        createdAt: vaccine.createdAt,
        updatedAt: vaccine.updatedAt,
        stock: {
          national: vaccine.StockNATIONAL?.quantity ?? 0,
          regional: regionalTotal,
          district: districtTotal,
          healthCenter: healthCenterTotal,
        },
      };
    });

    res.json({ total, vaccines });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ message: error.message });
    }
    next(error);
  }
};

const createVaccineCalendar = async (req, res, next) => {

  if (!["SUPERADMIN", "NATIONAL"].includes(req.user.role)) {
    return res.status(403).json({ message: "Accès refusé" });
  }

    const {
      description,
      ageUnit,
      specificAge,
      minAge,
      maxAge,
      vaccine = [],
    } = req.body;

  try {
    const { calendarId, vaccineIds } = await prisma.$transaction(
      async (tx) => {
        const assignments = await normalizeCalendarAssignments(tx, vaccine);

        if (!assignments.length) {
          throw makeHttpError(
            "Veuillez sélectionner au moins un vaccin et une dose valide.",
          );
        }

        const created = await tx.vaccineCalendar.create({
          data: {
            description,
            ageUnit,
            specificAge,
            minAge,
            maxAge,
          },
        });

        const rows = [];
        if (assignments.length) {
          const vaccineIdList = assignments.map(
            (assignment) => assignment.vaccineId,
          );
          const existingCountsRaw = await tx.vaccineCalendarDose.groupBy({
            by: ["vaccineId"],
            where: { vaccineId: { in: vaccineIdList } },
            _count: { vaccineId: true },
          });
          const existingCounts = new Map(
            existingCountsRaw.map((record) => [
              record.vaccineId,
              record._count?.vaccineId ?? 0,
            ]),
          );


          const tempOffset = 1000;

          for (const assignment of assignments) {
            const currentCount = existingCounts.get(assignment.vaccineId) ?? 0;
            for (let i = 0; i < assignment.count; i += 1) {
              rows.push({
                vaccineId: assignment.vaccineId,
                calendarId: created.id,
                doseNumber: tempOffset + currentCount + i + 1,
              });
            }
            existingCounts.set(
              assignment.vaccineId,
              currentCount + assignment.count,
            );
          }

          if (rows.length) {
            await tx.vaccineCalendarDose.createMany({
              data: rows,
            });
          }
        }

        return {
          calendarId: created.id,
          vaccineIds: assignments.map((assignment) => assignment.vaccineId),
        };
      },
    );

    await reassignVaccineDoseNumbers(vaccineIds);

    const refreshed = await prisma.vaccineCalendar.findUnique({
      where: { id: calendarId },
      include: calendarAssignmentsInclude,
    });

    // Enregistrer l'événement
    logEventAsync({
      type: "VACCINE_CALENDAR",
      action: "CREATE",
      user: {
        id: req.user.id,
        firstName: req.user.firstName,
        lastName: req.user.lastName,
        email: req.user.email,
        role: req.user.role,
      },
      entityType: "VACCINE_CALENDAR",
      entityId: calendarId,
      entityName: refreshed?.description || "Calendrier vaccinal",
      details: {
        description: refreshed?.description,
        ageUnit: refreshed?.ageUnit,
        specificAge: refreshed?.specificAge,
        minAge: refreshed?.minAge,
        maxAge: refreshed?.maxAge,
        vaccineIds: vaccineIds,
      },
    });

    res.status(201).json(formatCalendarForResponse(refreshed));
  } catch (error) {
    next(error);
  }
};

const updateVaccineCalendar = async (req, res, next) => {
  if (!["SUPERADMIN", "NATIONAL"].includes(req.user.role)) {
    return res.status(403).json({ message: "Accès refusé" });
  }

  const { id } = req.params;

  if (!id) {
    return res.status(400).json({ message: "Identifiant requis." });
  }

  const {
    description,
    ageUnit,
    specificAge,
    minAge,
    maxAge,
    vaccine = [],
  } = req.body ?? {};

  if (!description?.trim()) {
    return res
      .status(400)
      .json({ message: "La description est obligatoire." });
  }

  if (!ageUnit || !["WEEKS", "MONTHS", "YEARS"].includes(ageUnit)) {
    return res
      .status(400)
      .json({ message: "L'unité d'âge fournie est invalide." });
  }

  if (!Array.isArray(vaccine)) {
    return res
      .status(400)
      .json({ message: "La liste des vaccins doit être un tableau." });
  }

  const specificAgeValue =
    specificAge !== null && specificAge !== undefined
      ? Number(specificAge)
      : null;
  const minAgeValue =
    minAge !== null && minAge !== undefined ? Number(minAge) : null;
  const maxAgeValue =
    maxAge !== null && maxAge !== undefined ? Number(maxAge) : null;

  if (
    specificAgeValue !== null &&
    Number.isNaN(specificAgeValue)
  ) {
    return res
      .status(400)
      .json({ message: "L'âge ciblé doit être un nombre valide." });
  }

  if (
    (minAgeValue !== null && Number.isNaN(minAgeValue)) ||
    (maxAgeValue !== null && Number.isNaN(maxAgeValue))
  ) {
    return res
      .status(400)
      .json({ message: "Les âges minimum et maximum doivent être des nombres valides." });
  }

  if (
    minAgeValue !== null &&
    maxAgeValue !== null &&
    minAgeValue > maxAgeValue
  ) {
    return res
      .status(400)
      .json({ message: "L'âge minimum doit être inférieur ou égal à l'âge maximum." });
  }

  try {
    const { calendarId, affectedVaccineIds } = await prisma.$transaction(
      async (tx) => {
        const existingAssignments = await tx.vaccineCalendarDose.findMany({
          where: { calendarId: id },
          select: { vaccineId: true },
        });
        const previousVaccineIds = existingAssignments.map(
          (assignment) => assignment.vaccineId,
        );

        const assignments = await normalizeCalendarAssignments(tx, vaccine, {
          excludeCalendarId: id,
        });

        if (!assignments.length) {
          throw makeHttpError(
            "Veuillez sélectionner au moins un vaccin et une dose valide.",
          );
        }

        await tx.vaccineCalendar.update({
          where: { id },
          data: {
            description: description.trim(),
            ageUnit,
            specificAge: specificAgeValue,
            minAge: minAgeValue,
            maxAge: maxAgeValue,
          },
        });

        await tx.vaccineCalendarDose.deleteMany({
          where: { calendarId: id },
        });

        const rows = [];
        if (assignments.length) {
          const vaccineIdList = assignments.map(
            (assignment) => assignment.vaccineId,
          );
          const existingCountsRaw = await tx.vaccineCalendarDose.groupBy({
            by: ["vaccineId"],
            where: {
              vaccineId: { in: vaccineIdList },
              calendarId: { not: id },
            },
            _count: { vaccineId: true },
          });
          const existingCounts = new Map(
            existingCountsRaw.map((record) => [
              record.vaccineId,
              record._count?.vaccineId ?? 0,
            ]),
          );


          const tempOffset = 1000;

          for (const assignment of assignments) {
            const currentCount = existingCounts.get(assignment.vaccineId) ?? 0;
            for (let i = 0; i < assignment.count; i += 1) {
              rows.push({
                vaccineId: assignment.vaccineId,
                calendarId: id,
                doseNumber: tempOffset + currentCount + i + 1,
              });
            }
            existingCounts.set(
              assignment.vaccineId,
              currentCount + assignment.count,
            );
          }

          if (rows.length) {
            await tx.vaccineCalendarDose.createMany({
              data: rows,
            });
          }
        }

        const affected = Array.from(
          new Set([
            ...previousVaccineIds,
            ...assignments.map((assignment) => assignment.vaccineId),
          ]),
        );

        return {
          calendarId: id,
          affectedVaccineIds: affected,
        };
      },
    );

    await reassignVaccineDoseNumbers(affectedVaccineIds);

    const refreshed = await prisma.vaccineCalendar.findUnique({
      where: { id: calendarId },
      include: calendarAssignmentsInclude,
    });

    res.json(formatCalendarForResponse(refreshed));
  } catch (error) {
    if (error.code === "P2025") {
      return res
        .status(404)
        .json({ message: "Calendrier vaccinal introuvable." });
    }
    if (error.status) {
      return res.status(error.status).json({ message: error.message });
    }
    next(error);
  }
};

const deleteVaccineCalendar = async (req, res, next) => {
  if (!["SUPERADMIN", "NATIONAL"].includes(req.user.role)) {
    return res.status(403).json({ message: "Accès refusé" });
  }

  const { id } = req.params;

  if (!id) {
    return res.status(400).json({ message: "Identifiant requis." });
  }

  try {
    // Récupérer le calendrier avant suppression pour l'événement
    const calendar = await prisma.vaccineCalendar.findUnique({
      where: { id },
    });

    if (!calendar) {
      return res.status(404).json({ message: "Calendrier vaccinal introuvable." });
    }

    const { affectedChildIds, affectedVaccineIds } =
      await prisma.$transaction(async (tx) => {
      const childIdSet = new Set();
      const collectChildIds = (rows = []) => {
        rows.forEach((row) => {
          if (row?.childId) {
            childIdSet.add(row.childId);
          }
        });
      };

      const calendarAssignments = await tx.vaccineCalendarDose.findMany({
        where: { calendarId: id },
        select: { vaccineId: true },
      });
      const vaccineIds = calendarAssignments.map(
        (assignment) => assignment.vaccineId,
      );

      const [dueChildren, lateChildren, overdueChildren, scheduledChildren, completedChildren] =
        await Promise.all([
          tx.childVaccineDue.findMany({
            where: { vaccineCalendarId: id },
            select: { childId: true },
          }),
          tx.childVaccineLate.findMany({
            where: { vaccineCalendarId: id },
            select: { childId: true },
          }),
          tx.childVaccineOverdue.findMany({
            where: { vaccineCalendarId: id },
            select: { childId: true },
          }),
          tx.childVaccineScheduled.findMany({
            where: { vaccineCalendarId: id },
            select: { childId: true },
          }),
          tx.childVaccineCompleted.findMany({
            where: { vaccineCalendarId: id },
            select: { childId: true },
          }),
        ]);

      collectChildIds(dueChildren);
      collectChildIds(lateChildren);
      collectChildIds(overdueChildren);
      collectChildIds(scheduledChildren);
      collectChildIds(completedChildren);

      await tx.childVaccineDue.deleteMany({
        where: { vaccineCalendarId: id },
      });

      await tx.childVaccineLate.deleteMany({
        where: { vaccineCalendarId: id },
      });

      await tx.childVaccineOverdue.deleteMany({
        where: { vaccineCalendarId: id },
      });

      await tx.childVaccineScheduled.updateMany({
        where: { vaccineCalendarId: id },
        data: { vaccineCalendarId: null },
      });

      await tx.childVaccineCompleted.updateMany({
        where: { vaccineCalendarId: id },
        data: { vaccineCalendarId: null },
      });

      await tx.vaccineRequest.updateMany({
        where: { vaccineCalendarId: id },
        data: { vaccineCalendarId: null },
      });

      await tx.vaccineCalendar.delete({
        where: { id },
      });

      return {
        affectedChildIds: Array.from(childIdSet),
        affectedVaccineIds: Array.from(new Set(vaccineIds)),
      };
    });

    // Enregistrer l'événement
    logEventAsync({
      type: "VACCINE_CALENDAR",
      action: "DELETE",
      user: {
        id: req.user.id,
        firstName: req.user.firstName,
        lastName: req.user.lastName,
        email: req.user.email,
        role: req.user.role,
      },
      entityType: "VACCINE_CALENDAR",
      entityId: id,
      entityName: calendar.description,
      metadata: {
        affectedChildIds: affectedChildIds.length,
        affectedVaccineIds: affectedVaccineIds.length,
      },
    });

    if (affectedChildIds.length > 0) {
      await Promise.all(
        affectedChildIds.map((childId) =>
          rebuildChildVaccinationBuckets(childId).catch((err) =>
            console.error(
              `Erreur lors du recalcul des vaccins pour l'enfant ${childId}:`,
              err,
            ),
          ),
        ),
      );
    }

    await reassignVaccineDoseNumbers(affectedVaccineIds);

    res.status(204).end();
  } catch (error) {
    if (error.code === "P2025") {
      return res
        .status(404)
        .json({ message: "Calendrier vaccinal introuvable." });
    }
    next(error);
  }
};

const listVaccines = async (req, res, next) => {
  const isAgentAdmin =
    req.user.role === "AGENT" && req.user.agentLevel === "ADMIN";

  if (
    !["NATIONAL", "REGIONAL", "DISTRICT"].includes(req.user.role) &&
    !isAgentAdmin
  ) {
    return res.status(403).json({ message: "Accès refusé" });
  }

  try {
    const vaccines = await prisma.vaccine.findMany({
    });
    res.json(vaccines);
  } catch (error) {
    next(error);
  }
};

const AGE_UNIT_ORDER = {
  WEEKS: 0,
  MONTHS: 1,
  YEARS: 2,
};

const AGE_UNIT_LABELS = {
  WEEKS: "Semaines",
  MONTHS: "Mois",
  YEARS: "Années",
};

const translateAgeUnit = (unit) => AGE_UNIT_LABELS[unit] || unit;

const sortCalendars = (calendars) =>
  calendars
    .slice()
    .sort((a, b) => {
      const unitDiff =
        (AGE_UNIT_ORDER[a.ageUnit] ?? 99) - (AGE_UNIT_ORDER[b.ageUnit] ?? 99);
      if (unitDiff !== 0) return unitDiff;

      const ageA = a.specificAge ?? a.minAge ?? 0;
      const ageB = b.specificAge ?? b.minAge ?? 0;
      return ageA - ageB;
    });

const fetchCalendarsWithVaccines = async () => {
  const calendars = await prisma.vaccineCalendar.findMany({
    include: calendarAssignmentsInclude,
  });

  const formatted = calendars.map(formatCalendarForResponse);
  return sortCalendars(formatted);
};

const listVaccineCalendars = async (req, res, next) => {
  const isAgent =
    req.user.role === "AGENT" && (req.user.agentLevel === "ADMIN" || req.user.agentLevel === "STAFF");

  if (
    !["SUPERADMIN", "NATIONAL", "REGIONAL", "DISTRICT"].includes(req.user.role) &&
    !isAgent
  ) {
    return res.status(403).json({ message: "Accès refusé" });
  }

  try {
    const calendars = await fetchCalendarsWithVaccines();
    res.json(calendars);
  } catch (error) {
    next(error);
  }
};

const listVaccineCalendarDoseWarnings = async (req, res, next) => {
  if (!["SUPERADMIN", "NATIONAL"].includes(req.user.role)) {
    return res.status(403).json({ message: "Accès réservé aux agents nationaux." });
  }

  try {
    const [vaccines, assignmentCounts] = await Promise.all([
      prisma.vaccine.findMany({
        select: {
          id: true,
          name: true,
          dosesRequired: true,
        },
      }),
      prisma.vaccineCalendarDose.groupBy({
        by: ["vaccineId"],
        _count: {
          vaccineId: true,
        },
      }),
    ]);

    const plannedMap = new Map();
    for (const entry of assignmentCounts) {
      plannedMap.set(entry.vaccineId, entry._count?.vaccineId ?? 0);
    }

    const warnings = [];

    for (const vaccine of vaccines) {
      const declared = Number(vaccine.dosesRequired);
      if (!Number.isFinite(declared) || declared <= 0) {
        continue;
      }
      const planned = plannedMap.get(vaccine.id) ?? 0;
      if (planned < declared) {
        warnings.push({
          vaccineId: vaccine.id,
          name: vaccine.name,
          requiredDoses: declared,
          plannedDoses: planned,
          missingDoses: declared - planned,
        });
      }
    }

    warnings.sort((a, b) => {
      if (b.missingDoses !== a.missingDoses) {
        return b.missingDoses - a.missingDoses;
      }
      return a.name.localeCompare(b.name, "fr", { sensitivity: "base" });
    });

    res.json({ warnings });
  } catch (error) {
    next(error);
  }
};

const downloadVaccineCalendarPdf = async (req, res, next) => {
  const isAgent =
    req.user.role === "AGENT" && (req.user.agentLevel === "ADMIN" || req.user.agentLevel === "STAFF");

  if (
    !["SUPERADMIN", "NATIONAL", "REGIONAL", "DISTRICT"].includes(req.user.role) &&
    !isAgent
  ) {
    return res.status(403).json({ message: "Accès refusé" });
  }

  try {
    const calendars = await fetchCalendarsWithVaccines();

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="calendrier-vaccinal.pdf"'
    );

    const doc = new PDFDocument({ margin: 50, size: "A4" });
    doc.pipe(res);

    doc.fontSize(20).text("Calendrier Vaccinal National", {
      align: "center",
    });
    doc.moveDown();

    if (calendars.length === 0) {
      doc.fontSize(12).text("Aucune entrée de calendrier n'est disponible.");
      doc.end();
      return;
    }

    let currentUnit = null;

    calendars.forEach((item, index) => {
      if (currentUnit !== item.ageUnit) {
        currentUnit = item.ageUnit;
        doc.moveDown(currentUnit ? 1 : 0.5);
        doc
          .fontSize(16)
          .fillColor("#2563eb")
          .text(translateAgeUnit(currentUnit), { underline: true });
        doc.moveDown(0.5);
      }

      const ageLabel =
        item.specificAge != null
          ? `${item.specificAge} ${translateAgeUnit(item.ageUnit)}`
          : `${item.minAge ?? "?"} - ${item.maxAge ?? "?"} ${translateAgeUnit(
              item.ageUnit
            )}`;

      doc
        .fontSize(13)
        .fillColor("#111827")
        .text(`• Intervalle : ${ageLabel}`, { continued: false });

      const vaccineNames = (item.vaccines ?? [])
        .map((v) => {
          const countLabel = `${v.doseCount ?? 0} dose(s)`;
          if (
            v.firstDoseNumber != null &&
            v.lastDoseNumber != null &&
            v.doseCount > 0
          ) {
            const range =
              v.firstDoseNumber === v.lastDoseNumber
                ? `Dose ${v.firstDoseNumber}`
                : `Doses ${v.firstDoseNumber}-${v.lastDoseNumber}`;
            return `${v.name} (${countLabel}, ${range})`;
          }
          return `${v.name} (${countLabel})`;
        })
        .join(", ");
      doc
        .fontSize(12)
        .fillColor("#1f2937")
        .text(`Vaccins : ${vaccineNames || "Non spécifié"}`);

      if (item.description) {
        doc
          .fontSize(11)
          .fillColor("#4b5563")
          .text(`Notes : ${item.description}`);
      }

      if (index !== calendars.length - 1) {
        doc.moveDown(0.75);
      }
    });

    doc.end();
  } catch (error) {
    next(error);
  }
};

const releaseReservationForSchedule = async (
  tx,
  scheduleId,
  { consume = false } = {},
) => {
  if (!scheduleId) {
    return null;
  }

  const reservation = await tx.stockReservation.findUnique({
    where: { scheduleId },
    include: {
      stockLot: {
        select: {
          id: true,
          vaccineId: true,
          ownerType: true,
          ownerId: true,
        },
      },
    },
  });

  if (!reservation) {
    return null;
  }

  if (!consume) {
    const lotOwnerType = reservation.stockLot.ownerType;
    const lotOwnerId = reservation.stockLot.ownerId;
    if (lotOwnerType === OWNER_TYPES.HEALTHCENTER && lotOwnerId) {
      await releaseDoseForHealthCenter(tx, {
        vaccineId: reservation.stockLot.vaccineId,
        healthCenterId: lotOwnerId,
        lotId: reservation.stockLot.id,
        quantity: reservation.quantity,
      });
    }
  }

  await tx.stockReservation.delete({
    where: { id: reservation.id },
  });

  return reservation;
};

const updateVaccine = async (req, res, next) => {
  if (!["SUPERADMIN", "NATIONAL"].includes(req.user.role)) {
    return res.status(403).json({ message: "Accès refusé" });
  }

  const vaccineId = req.params.id;
  const { name, description, dosesRequired, gender } = req.body ?? {};

  if (!name?.trim() || !description?.trim() || !dosesRequired?.trim()) {
    return res
      .status(400)
      .json({ message: "Nom, description et doses requises sont obligatoires." });
  }

  try {
    const updated = await prisma.vaccine.update({
      where: { id: vaccineId },
      data: {
        name: name.trim(),
        description: description.trim(),
        dosesRequired: dosesRequired.trim(),
        gender: gender || null, // null = pour tous, 'M' = garçons, 'F' = filles
      },
    });

    res.json(updated);
  } catch (error) {
    next(error);
  }
};

const deleteVaccine = async (req, res, next) => {
  if (!["SUPERADMIN", "NATIONAL"].includes(req.user.role)) {
    return res.status(403).json({ message: "Accès refusé" });
  }

  const vaccineId = req.params.id;

  try {
    // Vérifier que le vaccin existe
    const vaccine = await prisma.vaccine.findUnique({
      where: { id: vaccineId },
    });

    if (!vaccine) {
      return res.status(404).json({ message: "Vaccin non trouvé" });
    }

    // Récupérer les informations des rendez-vous avant suppression pour les notifications
    let appointmentsToNotify = [];

    // Supprimer toutes les relations dépendantes dans une transaction
    await prisma.$transaction(async (tx) => {
      // 1. Récupérer les informations des rendez-vous programmés avant suppression
      const scheduledVaccines = await tx.childVaccineScheduled.findMany({
        where: { vaccineId },
        select: {
          id: true,
          childId: true,
          scheduledFor: true,
          vaccine: { select: { name: true } },
        },
      });

      // Sauvegarder les informations pour les notifications
      appointmentsToNotify = scheduledVaccines.map((sv) => ({
        childId: sv.childId,
        vaccineName: sv.vaccine?.name ?? vaccine.name,
        scheduledDate: sv.scheduledFor,
      }));

      const scheduledIds = scheduledVaccines.map((sv) => sv.id);
      if (scheduledIds.length > 0) {
        await tx.stockReservation.deleteMany({
          where: { scheduleId: { in: scheduledIds } },
        });
      }

      // 2. Supprimer les enregistrements de vaccination des enfants
      await tx.childVaccineCompleted.deleteMany({
        where: { vaccineId },
      });

      await tx.childVaccineDue.deleteMany({
        where: { vaccineId },
      });

      await tx.childVaccineScheduled.deleteMany({
        where: { vaccineId },
      });

      await tx.childVaccineOverdue.deleteMany({
        where: { vaccineId },
      });

      await tx.childVaccineLate.deleteMany({
        where: { vaccineId },
      });

      // 3. Supprimer les lots de stock en cascade (cela gère aussi les réservations)
      const stockLots = await tx.stockLot.findMany({
        where: { vaccineId },
        select: { id: true },
      });

      // Utiliser deleteLotCascade pour chaque lot (gère les réservations et les transferts)
      for (const lot of stockLots) {
        await deleteLotCascade(tx, lot.id);
      }

      // 4. Supprimer les stocks
      await tx.stockNATIONAL.deleteMany({
        where: { vaccineId },
      });

      await tx.stockREGIONAL.deleteMany({
        where: { vaccineId },
      });

      await tx.stockDISTRICT.deleteMany({
        where: { vaccineId },
      });

      await tx.stockHEALTHCENTER.deleteMany({
        where: { vaccineId },
      });

      // 5. Supprimer les enregistrements (records)
      await tx.record.deleteMany({
        where: { vaccineId },
      });

      // 6. Supprimer les demandes de vaccin (VaccineRequest)
      // Note: VaccineRequest a une contrainte ON DELETE RESTRICT, donc on doit les supprimer avant
      await tx.vaccineRequest.deleteMany({
        where: { vaccineId },
      });

      // 7. Supprimer les transferts de stock (StockTransfer et StockTransferLot)
      // Note: StockTransfer a une contrainte ON DELETE RESTRICT sur vaccineId
      const stockTransfers = await tx.stockTransfer.findMany({
        where: { vaccineId },
        select: { id: true },
      });

      const transferIds = stockTransfers.map((st) => st.id);
      if (transferIds.length > 0) {
        // Supprimer d'abord les StockTransferLot (ils ont une FK vers StockTransfer)
        await tx.stockTransferLot.deleteMany({
          where: { transferId: { in: transferIds } },
        });

        // Puis supprimer les StockTransfer
        await tx.stockTransfer.deleteMany({
          where: { id: { in: transferIds } },
        });
      }

      // 8. Mettre à jour les enfants qui ont ce vaccin comme nextVaccineId
      await tx.children.updateMany({
        where: { nextVaccineId: vaccineId },
        data: { nextVaccineId: null },
      });

      // 9. Supprimer la relation many-to-many avec VaccineCalendar
      // (Prisma gère automatiquement la table de jointure _VaccineToVaccineCalendar)

      // 10. Supprimer le vaccin lui-même
      await tx.vaccine.delete({
        where: { id: vaccineId },
      });
    });

    // Envoyer des notifications aux parents pour tous les rendez-vous annulés
    if (appointmentsToNotify.length > 0) {
      setImmediate(async () => {
        try {
          await Promise.all(
            appointmentsToNotify.map((appointment) =>
              notifyAppointmentCancelled({
                childId: appointment.childId,
                vaccineName: appointment.vaccineName,
                scheduledDate: appointment.scheduledDate,
              }),
            ),
          );
        } catch (notifError) {
          console.error("Erreur création notifications d'annulation:", notifError);
        }
      });
    }

    // Enregistrer l'événement
    logEventAsync({
      type: "VACCINE",
      action: "DELETE",
      user: {
        id: req.user.id,
        firstName: req.user.firstName,
        lastName: req.user.lastName,
        email: req.user.email,
        role: req.user.role,
      },
      entityType: "VACCINE",
      entityId: vaccineId,
      entityName: vaccine.name,
      details: {
        name: vaccine.name,
        description: vaccine.description,
        dosesRequired: vaccine.dosesRequired,
        gender: vaccine.gender,
        cancelledAppointments: appointmentsToNotify.length,
      },
    });

    res.status(204).end();
  } catch (error) {
    console.error("Error deleting vaccine:", error);
    console.error("Error details:", {
      code: error.code,
      message: error.message,
      meta: error.meta,
    });
    
    if (error.code === "P2025") {
      return res.status(404).json({ message: "Vaccin non trouvé" });
    }
    
    // Erreur de contrainte de clé étrangère
    if (error.code === "P2003") {
      return res.status(400).json({ 
        message: "Impossible de supprimer ce vaccin car il est encore utilisé dans le système",
        details: error.meta?.field_name || "Relation inconnue"
      });
    }
    
    next(error);
  }
};


// Helper pour valider qu'un agent appartient au centre de santé
const validateAgentBelongsToHealthCenter = async (tx, agentId, healthCenterId) => {
  if (!agentId) return null; // Si pas d'agent spécifié, c'est OK (optionnel)
  
  const agent = await tx.user.findUnique({
    where: { id: agentId },
    select: { id: true, role: true, healthCenterId: true, isActive: true },
  });

  if (!agent) {
    throw Object.assign(new Error("Agent introuvable"), { status: 404 });
  }

  if (agent.role !== "AGENT") {
    throw Object.assign(new Error("L'utilisateur sélectionné n'est pas un agent"), {
      status: 400,
    });
  }

  if (!agent.isActive) {
    throw Object.assign(new Error("L'agent sélectionné n'est pas actif"), { status: 400 });
  }

  if (agent.healthCenterId !== healthCenterId) {
    throw Object.assign(
      new Error("L'agent sélectionné n'appartient pas au centre de santé de l'enfant"),
      { status: 403 }
    );
  }

  return agent;
};

const ScheduleVaccine = async (req, res, next) => {
  if (req.user.role !== "AGENT" || !req.user.healthCenterId) {
    return res.status(403).json({ message: "Accès refusé" });
  }

  try {
    const {
      childId,
      vaccineId,
      vaccineCalendarId = null,
      scheduledFor,
      administeredById = null,
    } = req.body ?? {};

    if (!childId || !vaccineId || !scheduledFor) {
      return res
        .status(400)
        .json({ message: "childId, vaccineId et scheduledFor sont requis." });
    }

    const scheduleDate = new Date(scheduledFor);
    if (Number.isNaN(scheduleDate.getTime())) {
      return res
        .status(400)
        .json({ message: "La date de rendez-vous est invalide." });
    }

    const result = await prisma.$transaction(async (tx) => {
      const child = await tx.children.findUnique({
        where: { id: childId },
        select: { healthCenterId: true, gender: true },
      });

      if (!child) {
        throw Object.assign(new Error("Enfant introuvable"), { status: 404 });
      }

      if (child.healthCenterId !== req.user.healthCenterId) {
        throw Object.assign(new Error("Accès refusé"), { status: 403 });
      }

      // Valider que l'agent sélectionné appartient au centre de santé
      let validatedAdministeredById = null;
      if (administeredById) {
        await validateAgentBelongsToHealthCenter(tx, administeredById, child.healthCenterId);
        validatedAdministeredById = administeredById;
      }

      const vaccine = await tx.vaccine.findUnique({
        where: { id: vaccineId },
        select: { dosesRequired: true, gender: true },
      });

      if (!vaccine) {
        throw Object.assign(new Error("Vaccin introuvable"), { status: 404 });
      }

      // Vérifier si le vaccin correspond au genre de l'enfant
      // Si le vaccin n'est pas dans le calendrier vaccinal (vaccineCalendarId est null),
      // on ne bloque pas mais on retourne un warning
      const isSuitable = !vaccine.gender || vaccine.gender === child.gender;
      let genderWarning = null;
      if (!isSuitable && !vaccineCalendarId) {
        // Si c'est un vaccin "autre" (pas dans le calendrier), on ne bloque pas mais on avertit
        genderWarning = "Ce vaccin n'est pas adapté au genre de l'enfant selon le calendrier vaccinal, mais vous pouvez continuer.";
      } else if (!isSuitable) {
        // Si c'est un vaccin du calendrier, on bloque
        throw Object.assign(
          new Error("Ce vaccin n'est pas adapté au genre de l'enfant"),
          { status: 400 }
        );
      }

      const dosesRequired = Number.parseInt(vaccine.dosesRequired, 10);
      const totalDoses =
        Number.isFinite(dosesRequired) && dosesRequired > 0 ? dosesRequired : 1;

      // Compter les doses complétées et programmées pour calculer le numéro de dose
      const completedCount = await tx.childVaccineCompleted.count({
        where: { childId, vaccineId },
      });

      const scheduledCount = await tx.childVaccineScheduled.count({
        where: { childId, vaccineId },
      });

      // Calculer une dose initiale (sera réassignée après)
      // Permet de programmer des doses supplémentaires même si dosesRequired est atteint
      const initialDose = completedCount + scheduledCount + 1;

      const reservation = await reserveDoseForHealthCenter(tx, {
        vaccineId,
        healthCenterId: child.healthCenterId,
        quantity: 1,
        appointmentDate: scheduleDate,
      });

      const created = await tx.childVaccineScheduled.create({
        data: {
          childId,
          vaccineId,
          vaccineCalendarId,
          scheduledFor: scheduleDate,
          plannerId: req.user.id,
          administeredById: validatedAdministeredById,
          dose: initialDose, // Dose temporaire, sera réassignée
        },
        include: {
          vaccine: { select: { id: true, name: true, dosesRequired: true } },
          child: { select: { id: true, phoneParent: true } },
        },
      });

      await tx.stockReservation.create({
        data: {
          scheduleId: created.id,
          stockLotId: reservation.lotId,
          quantity: reservation.quantity,
        },
      });

      // Réassigner toutes les doses selon l'ordre chronologique
      await reassignDosesForVaccine(tx, childId, vaccineId);

      // Récupérer le rendez-vous avec la dose correcte
      const createdWithCorrectDose = await tx.childVaccineScheduled.findUnique({
        where: { id: created.id },
        include: {
          vaccine: { select: { id: true, name: true, dosesRequired: true } },
          child: { select: { id: true, phoneParent: true } },
        },
      });

      // Créer une notification pour le parent (après la transaction)
      // On le fait après la transaction pour éviter les problèmes de rollback
      const finalSchedule = createdWithCorrectDose || created;
      if (finalSchedule && finalSchedule.child) {
        setImmediate(async () => {
          try {
            await notifyVaccineScheduled({
              childId: finalSchedule.child.id,
              vaccineName: finalSchedule.vaccine.name,
              scheduledDate: finalSchedule.scheduledFor,
            });
          } catch (notifError) {
            console.error("Erreur création notification:", notifError);
          }
        });
      }

      // NE PAS supprimer les entrées de due, late, overdue lors de la programmation
      // On attend que le vaccin soit complété (dans completeVaccine) pour les supprimer
      // Cela garantit que les vaccins restent visibles comme "à faire" ou "en retard"
      // jusqu'à ce qu'ils soient réellement administrés

      // Mettre à jour nextAppointment avec le prochain rendez-vous le plus proche
      await updateNextAppointment(tx, childId);

      return { 
        appointment: createdWithCorrectDose || created,
        genderWarning 
      };
    });

    const appointment = result.appointment || result;

    // Enregistrer l'événement
    logEventAsync({
      type: "APPOINTMENT",
      action: "CREATE",
      user: {
        id: req.user.id,
        firstName: req.user.firstName,
        lastName: req.user.lastName,
        email: req.user.email,
        role: req.user.role,
      },
      entityType: "APPOINTMENT",
      entityId: appointment.id,
      entityName: appointment.vaccine?.name || "Vaccin",
      details: {
        childId: appointment.childId,
        vaccineId: appointment.vaccineId,
        scheduledFor: appointment.scheduledFor,
        dose: appointment.dose,
        vaccineCalendarId: appointment.vaccineCalendarId,
      },
    });

    // Si on a un warning mais que le rendez-vous a été créé, retourner le résultat avec le warning
    if (result.genderWarning) {
      return res.status(201).json({
        ...appointment,
        warning: result.genderWarning,
      });
    }

    res.status(201).json(appointment);
  } catch (error) {
    // Gérer les erreurs Prisma spécifiques
    if (error.code === "P2002") {
      // Contrainte unique violée
      return res.status(409).json({
        message: "Un rendez-vous existe déjà pour cet enfant avec ce vaccin et cette dose. Veuillez modifier la date ou choisir un autre vaccin.",
      });
    }
    
    if (error.status) {
      return res.status(error.status).json({ message: error.message });
    }
    
    next(error);
  }
};

const listScheduledVaccines = async (req, res, next) => {
  try {
    let whereClause = {};

    if (req.user.role === "AGENT") {
      if (!req.user.healthCenterId) {
        return res.json({ items: [] });
      }
      whereClause = {
        child: {
          healthCenterId: req.user.healthCenterId,
        },
      };
    } else if (req.user.role === "DISTRICT") {
      if (!req.user.districtId) {
        return res.json({ items: [] });
      }
      whereClause = {
        child: {
          healthCenter: {
            districtId: req.user.districtId,
          },
        },
      };
    } else if (req.user.role === "REGIONAL") {
      if (!req.user.regionId) {
        return res.json({ items: [] });
      }
      whereClause = {
        child: {
          healthCenter: {
            district: {
              commune: {
                regionId: req.user.regionId,
              },
            },
          },
        },
      };
    } else if (req.user.role === "NATIONAL" || req.user.role === "SUPERADMIN") {
      // Pour NATIONAL et SUPERADMIN, on récupère tous les rendez-vous
      whereClause = {};
    }

    const scheduledList = await prisma.childVaccineScheduled.findMany({
      where: whereClause,
      include: {
        child: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            gender: true,
            birthDate: true,
            healthCenterId: true,
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
        },
        vaccine: {
          select: {
            id: true,
            name: true,
            dosesRequired: true,
          },
        },
        vaccineCalendar: {
          select: {
            id: true,
            description: true,
            ageUnit: true,
            minAge: true,
            maxAge: true,
            specificAge: true,
          },
        },
        planner: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        administeredBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: [
        { scheduledFor: "asc" },
      ],
    });

    let regionsList = [];
    if (req.user.role === "NATIONAL" || req.user.role === "SUPERADMIN") {
      regionsList = await prisma.region.findMany({
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      });
    }

    const items = scheduledList.map((entry) => {
      const regionName =
        entry.child.healthCenter?.district?.commune?.region?.name ?? null;
      const districtName = entry.child.healthCenter?.district?.name ?? null;
      const healthCenterName = entry.child.healthCenter?.name ?? null;

      return {
        id: entry.id,
        scheduledFor: entry.scheduledFor,
        region: regionName,
        district: districtName,
        healthCenter: healthCenterName,
        child: {
          id: entry.child.id,
          firstName: entry.child.firstName,
          lastName: entry.child.lastName,
          gender: entry.child.gender,
          birthDate: entry.child.birthDate,
          healthCenter: entry.child.healthCenter
            ? {
                id: entry.child.healthCenter.id,
                name: entry.child.healthCenter.name,
              }
            : null,
        },
        vaccine: entry.vaccine
          ? {
              id: entry.vaccine.id,
              name: entry.vaccine.name,
              dosesRequired: entry.vaccine.dosesRequired,
            }
          : null,
        vaccineCalendar: entry.vaccineCalendar
          ? {
              id: entry.vaccineCalendar.id,
              description: entry.vaccineCalendar.description,
              ageUnit: entry.vaccineCalendar.ageUnit,
              minAge: entry.vaccineCalendar.minAge,
              maxAge: entry.vaccineCalendar.maxAge,
              specificAge: entry.vaccineCalendar.specificAge,
            }
          : null,
        dose: entry.dose ?? 1,
        administeredBy: entry.administeredBy
          ? {
              id: entry.administeredBy.id,
              firstName: entry.administeredBy.firstName,
              lastName: entry.administeredBy.lastName,
            }
          : null,
      };
    });

    res.json({
      items,
      regions: regionsList,
    });
  } catch (error) {
    next(error);
  }
};

const completeVaccine = async (req, res, next) => {
  if (req.user.role !== "AGENT" || !req.user.healthCenterId) {
    return res.status(403).json({ message: "Accès refusé" });
  }

  try {
    const completed = await prisma.$transaction(async (tx) => {
      const scheduled = await tx.childVaccineScheduled.findUnique({
        where: { id: req.params.id },
        select: {
          childId: true,
          vaccineCalendarId: true,
          vaccineId: true,
          plannerId: true,
          administeredById: true,
          dose: true,
          scheduledFor: true,
          child: { select: { healthCenterId: true } },
        },
      });

      if (!scheduled) {
        throw Object.assign(new Error("Rendez-vous introuvable"), {
          status: 404,
        });
      }

      if (scheduled.child?.healthCenterId !== req.user.healthCenterId) {
        throw Object.assign(new Error("Accès refusé"), { status: 403 });
      }

      // Vérifier que la date et l'heure du rendez-vous sont passées
      const now = new Date();
      const appointmentDate = new Date(scheduled.scheduledFor);
      if (appointmentDate > now) {
        throw Object.assign(
          new Error("Vous ne pouvez marquer ce rendez-vous comme effectué qu'à partir de la date et heure prévues"),
          { status: 400 }
        );
      }

      const dose = scheduled.dose ?? 1;

      const newVaccineCompleted = await tx.childVaccineCompleted.create({
        data: {
          childId: scheduled.childId,
          vaccineCalendarId: scheduled.vaccineCalendarId,
          vaccineId: scheduled.vaccineId,
          notes: req.body.notes,
          administeredById: scheduled.administeredById ?? scheduled.plannerId, // Utiliser administeredById si défini, sinon plannerId
          dose,
        },
      });

      await releaseReservationForSchedule(tx, req.params.id, { consume: true });

      await tx.childVaccineScheduled.delete({ where: { id: req.params.id } });

      await reassignDosesForVaccine(tx, scheduled.childId, scheduled.vaccineId);

      // Mettre à jour nextAppointment avec le prochain rendez-vous le plus proche
      await updateNextAppointment(tx, scheduled.childId);

      // Supprimer l'entrée due correspondant à ce calendrier vaccinal
      if (scheduled.vaccineCalendarId) {
        await tx.childVaccineDue.deleteMany({
          where: {
            childId: scheduled.childId,
            vaccineId: scheduled.vaccineId,
            vaccineCalendarId: scheduled.vaccineCalendarId,
            dose,
          },
        });

        // Supprimer l'entrée late pour ce calendrier vaccinal
        await tx.childVaccineLate.deleteMany({
          where: {
            childId: scheduled.childId,
            vaccineId: scheduled.vaccineId,
            vaccineCalendarId: scheduled.vaccineCalendarId,
            dose,
          },
        });
      } else {
        // Si vaccineCalendarId est null, supprimer toutes les entrées late pour cette dose
        await tx.childVaccineLate.deleteMany({
          where: {
            childId: scheduled.childId,
            vaccineId: scheduled.vaccineId,
            dose,
          },
        });
      }

      // Supprimer l'entrée overdue pour cette dose spécifique
      await tx.childVaccineOverdue.deleteMany({
        where: {
          childId: scheduled.childId,
          vaccineId: scheduled.vaccineId,
          dose,
          ...(scheduled.vaccineCalendarId
            ? { vaccineCalendarId: scheduled.vaccineCalendarId }
            : {}),
        },
      });

      // Vérifier si toutes les doses requises du vaccin sont complétées
      const vaccine = await tx.vaccine.findUnique({
        where: { id: scheduled.vaccineId },
        select: { dosesRequired: true },
      });

      const dosesRequired = vaccine?.dosesRequired 
        ? parseInt(vaccine.dosesRequired, 10) 
        : 1;
      const totalDoses = isFinite(dosesRequired) && dosesRequired > 0 ? dosesRequired : 1;

      // Compter les doses complétées pour ce vaccin
      const completedCount = await tx.childVaccineCompleted.count({
        where: {
          childId: scheduled.childId,
          vaccineId: scheduled.vaccineId,
        },
      });

      // Si toutes les doses sont complétées, supprimer toutes les entrées restantes
      // (au cas où il y aurait des entrées pour d'autres doses qui n'ont pas été supprimées)
      if (completedCount >= totalDoses) {
        await tx.childVaccineDue.deleteMany({
          where: {
            childId: scheduled.childId,
            vaccineId: scheduled.vaccineId,
          },
        });

        await tx.childVaccineLate.deleteMany({
          where: {
            childId: scheduled.childId,
            vaccineId: scheduled.vaccineId,
          },
        });

        await tx.childVaccineOverdue.deleteMany({
          where: {
            childId: scheduled.childId,
            vaccineId: scheduled.vaccineId,
          },
        });
      }

      // Mettre à jour le statut de l'enfant en fonction des vaccins restants
      const hasLateOrOverdue =
        (await tx.childVaccineLate.count({ where: { childId: scheduled.childId } })) > 0 ||
        (await tx.childVaccineOverdue.count({ where: { childId: scheduled.childId } })) > 0;

      await tx.children.update({
        where: { id: scheduled.childId },
        data: {
          status: hasLateOrOverdue ? "PAS_A_JOUR" : "A_JOUR",
        },
      });

      return newVaccineCompleted;
    });

    // Notifier les agents du centre (après la réponse pour ne pas bloquer)
    setImmediate(async () => {
      try {
        const completedWithDetails = await prisma.childVaccineCompleted.findUnique({
          where: { id: completed.id },
          include: {
            child: {
              select: { healthCenterId: true, firstName: true, lastName: true },
            },
            vaccine: {
              select: { name: true },
            },
          },
        });
        if (completedWithDetails?.child?.healthCenterId) {
          await notifyHealthCenterAgents({
            healthCenterId: completedWithDetails.child.healthCenterId,
            title: "Vaccin administré",
            message: `${req.user.firstName} ${req.user.lastName} a administré le vaccin ${completedWithDetails.vaccine?.name || "Vaccin"} (Dose ${completed.dose}) à ${completedWithDetails.child.firstName} ${completedWithDetails.child.lastName}`,
            type: "APPOINTMENT_COMPLETED",
            excludeUserId: req.user.id,
          });
        }
      } catch (notifError) {
        console.error("Erreur notification agents:", notifError);
      }
    });

    return res.status(201).json(completed);
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ message: error.message });
    }
    next(error);
  }
};

const moveScheduledToOverdue = async (tx, scheduled) => {
  const dose = scheduled.dose ?? 1;
  const overdue = await tx.childVaccineOverdue.upsert({
    where: {
      childId_vaccineCalendarId_vaccineId_dose: {
        childId: scheduled.childId,
        vaccineCalendarId: scheduled.vaccineCalendarId,
        vaccineId: scheduled.vaccineId,
        dose,
      },
    },
    update: {
      vaccineCalendarId: scheduled.vaccineCalendarId,
      escalatedToId: scheduled.plannerId,
      dueDate: scheduled.scheduledFor,
      dose,
    },
    create: {
      childId: scheduled.childId,
      vaccineCalendarId: scheduled.vaccineCalendarId,
      vaccineId: scheduled.vaccineId,
      escalatedToId: scheduled.plannerId,
      dueDate: scheduled.scheduledFor,
      dose,
    },
  });

  // NE PAS supprimer les entrées dans late et due lors du passage en overdue
  // On attend que le vaccin soit complété pour les supprimer
  // Cela garantit que les vaccins restent visibles comme "à faire" ou "en retard"
  // jusqu'à ce qu'ils soient réellement administrés

  await releaseReservationForSchedule(tx, scheduled.id, { consume: false });

  await tx.childVaccineScheduled.delete({
    where: { id: scheduled.id },
  });

  await reassignDosesForVaccine(tx, scheduled.childId, scheduled.vaccineId);

  // Mettre à jour nextAppointment avec le prochain rendez-vous le plus proche
  await updateNextAppointment(tx, scheduled.childId);

  return overdue;
};

const markScheduledAsMissed = async (scheduledId) => {
  return prisma.$transaction(async (tx) => {
    const scheduled = await tx.childVaccineScheduled.findUnique({
      where: { id: scheduledId },
    });

    if (!scheduled) {
      const error = new Error("Rendez-vous introuvable");
      error.status = 404;
      throw error;
    }

    return moveScheduledToOverdue(tx, scheduled);
  });
};

const missVaccineForPlanner = async (plannerId) => {
  if (!plannerId) return [];

  return prisma.$transaction(async (tx) => {
    const now = new Date();
    // Attendre un jour après la date prévue avant de marquer comme manqué
    // On soustrait 24 heures (86400000 ms) pour obtenir la date limite
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    const scheduledList = await tx.childVaccineScheduled.findMany({
      where: {
        plannerId,
        scheduledFor: { lt: oneDayAgo }, // Date prévue passée d'au moins 1 jour
      },
    });

    if (!scheduledList.length) {
      return [];
    }

    const results = [];
    for (const scheduled of scheduledList) {
      results.push(await moveScheduledToOverdue(tx, scheduled));
    }
    return results;
  });
};

const missVaccineForHealthCenter = async (healthCenterId) => {
  if (!healthCenterId) return [];

  return prisma.$transaction(async (tx) => {
    const now = new Date();
    // Attendre un jour après la date prévue avant de marquer comme manqué
    // On soustrait 24 heures (86400000 ms) pour obtenir la date limite
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    const scheduledList = await tx.childVaccineScheduled.findMany({
      where: {
        child: { healthCenterId },
        scheduledFor: { lt: oneDayAgo }, // Date prévue passée d'au moins 1 jour
      },
    });

    if (!scheduledList.length) {
      return [];
    }

    const results = [];
    for (const scheduled of scheduledList) {
      results.push(await moveScheduledToOverdue(tx, scheduled));
    }
    return results;
  });
};

const missVaccine = async (req, res, next) => {
  if (req.user.role !== "AGENT") {
    return res.status(403).json({ message: "Accès refusé" });
  }

  try {
    const overdue = await markScheduledAsMissed(req.params.id);
    return res.status(201).json(overdue);
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ message: error.message });
    }
    next(error);
  }
};

missVaccine.forPlanner = missVaccineForPlanner;
missVaccine.forHealthCenter = missVaccineForHealthCenter;

const updateScheduledVaccine = async (req, res, next) => {
  if (req.user.role !== "AGENT" || !req.user.healthCenterId) {
    return res.status(403).json({ message: "Accès refusé" });
  }

  try {
    const { id } = req.params;
    const { scheduledFor, vaccineId, vaccineCalendarId, administeredById = null } = req.body ?? {};
    if (!scheduledFor || !vaccineId) {
      return res.status(400).json({
        message: "scheduledFor et vaccineId sont requis",
      });
    }

    const scheduleDate = new Date(scheduledFor);
    if (Number.isNaN(scheduleDate.getTime())) {
      return res.status(400).json({ message: "Date invalide" });
    }

    let originalSnapshot = null;

    const updated = await prisma.$transaction(async (tx) => {
      const scheduled = await tx.childVaccineScheduled.findUnique({
        where: { id },
        select: {
          childId: true,
          scheduledFor: true,
          vaccineId: true,
          vaccineCalendarId: true,
          dose: true,
          administeredById: true,
          child: {
            select: {
              healthCenterId: true,
            },
          },
          vaccine: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      if (!scheduled) {
        throw Object.assign(new Error("Rendez-vous introuvable"), {
          code: "NOT_FOUND",
        });
      }

      if (scheduled.child?.healthCenterId !== req.user.healthCenterId) {
        throw Object.assign(new Error("Accès refusé"), {
          code: "FORBIDDEN",
        });
      }

      // Valider que l'agent sélectionné appartient au centre de santé
      let validatedAdministeredById = null;
      if (administeredById) {
        await validateAgentBelongsToHealthCenter(tx, administeredById, scheduled.child.healthCenterId);
        validatedAdministeredById = administeredById;
      } else if (scheduled.administeredById) {
        // Si on ne fournit pas d'administeredById mais qu'il y en a un existant, le conserver
        validatedAdministeredById = scheduled.administeredById;
      }

      originalSnapshot = {
        childId: scheduled.childId,
        scheduledFor: scheduled.scheduledFor,
        vaccineId: scheduled.vaccineId,
        vaccineName: scheduled.vaccine?.name ?? null,
        vaccineCalendarId: scheduled.vaccineCalendarId,
        dose: scheduled.dose ?? 1,
        administeredById: scheduled.administeredById,
      };

      if (scheduled.vaccineId !== vaccineId) {
        const vaccine = await tx.vaccine.findUnique({
          where: { id: vaccineId },
          select: { dosesRequired: true, name: true },
        });
        if (!vaccine) {
          throw Object.assign(new Error("Vaccin introuvable"), {
            code: "NOT_FOUND",
          });
        }
        const dosesRequired = Number.parseInt(vaccine.dosesRequired, 10);
        const totalDoses =
          Number.isFinite(dosesRequired) && dosesRequired > 0
            ? dosesRequired
            : 1;

        const completedCount = await tx.childVaccineCompleted.count({
          where: {
            childId: scheduled.childId,
            vaccineId,
          },
        });
        const scheduledCount = await tx.childVaccineScheduled.count({
          where: {
            childId: scheduled.childId,
            vaccineId,
          },
        });
        // Calculer le numéro de dose initial (sera réassigné après)
        // Permet de programmer des doses supplémentaires même si dosesRequired est atteint
        const initialDose = completedCount + scheduledCount + 1;

        const targetCalendarId =
          vaccineCalendarId !== undefined
            ? vaccineCalendarId
            : scheduled.vaccineCalendarId;
        await releaseReservationForSchedule(tx, id, { consume: false });
        await tx.childVaccineScheduled.delete({ where: { id } });

        const reservation = await reserveDoseForHealthCenter(tx, {
          vaccineId,
          healthCenterId: scheduled.child.healthCenterId,
          quantity: 1,
          appointmentDate: scheduleDate,
        });

        const recreated = await tx.childVaccineScheduled.create({
          data: {
            childId: scheduled.childId,
            vaccineId,
            vaccineCalendarId: targetCalendarId,
            scheduledFor: scheduleDate,
            plannerId: req.user.id,
            administeredById: validatedAdministeredById,
            dose: initialDose,
          },
          include: {
            vaccine: { select: { id: true, name: true, dosesRequired: true } },
          },
        });

        await tx.stockReservation.create({
          data: {
            scheduleId: recreated.id,
            stockLotId: reservation.lotId,
            quantity: reservation.quantity,
          },
        });

        // Réassigner toutes les doses selon l'ordre chronologique pour le nouveau vaccin
        await reassignDosesForVaccine(tx, scheduled.childId, vaccineId);

        // Récupérer le rendez-vous avec la dose correcte
        const recreatedWithCorrectDose = await tx.childVaccineScheduled.findUnique({
          where: { id: recreated.id },
          include: {
            vaccine: { select: { id: true, name: true, dosesRequired: true } },
          },
        });

        // NE PAS supprimer les entrées de due, late, overdue lors de la reprogrammation
        // On attend que le vaccin soit complété pour les supprimer

        // Mettre à jour nextAppointment avec le prochain rendez-vous le plus proche
        await updateNextAppointment(tx, scheduled.childId);

        return recreatedWithCorrectDose || recreated;
      }

      // Si administeredById est fourni, le valider et l'inclure dans la mise à jour
      let updateData = {
        scheduledFor: scheduleDate,
        ...(vaccineCalendarId !== undefined ? { vaccineCalendarId } : {}),
      };

      if (administeredById !== undefined) {
        if (administeredById) {
          await validateAgentBelongsToHealthCenter(tx, administeredById, scheduled.child.healthCenterId);
          updateData.administeredById = administeredById;
        } else {
          // Si null est fourni explicitement, on peut le mettre à null
          updateData.administeredById = null;
        }
      }

      const updatedSchedule = await tx.childVaccineScheduled.update({
        where: { id },
        data: updateData,
        include: {
          vaccine: { select: { id: true, name: true, dosesRequired: true } },
          administeredBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      });

      // Réassigner toutes les doses selon l'ordre chronologique (la date a changé)
      await reassignDosesForVaccine(tx, scheduled.childId, scheduled.vaccineId);

      // Récupérer le rendez-vous avec la dose correcte
      const updatedWithCorrectDose = await tx.childVaccineScheduled.findUnique({
        where: { id },
        include: {
          vaccine: { select: { id: true, name: true, dosesRequired: true } },
          administeredBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      });

      // Mettre à jour nextAppointment avec le prochain rendez-vous le plus proche
      await updateNextAppointment(tx, scheduled.childId);

      return updatedWithCorrectDose || updatedSchedule;
    });

    if (originalSnapshot && updated) {
      const updates = [];
      const formatDateTime = (dateValue) => {
        const dateObj = new Date(dateValue);
        if (Number.isNaN(dateObj.getTime())) {
          return null;
        }
        return dateObj.toLocaleString("fr-FR", {
          dateStyle: "full",
          timeStyle: "short",
        });
      };

      const originalDateLabel = formatDateTime(originalSnapshot.scheduledFor);
      const newDateLabel = formatDateTime(updated.scheduledFor);

      if (
        originalSnapshot.scheduledFor &&
        updated.scheduledFor &&
        new Date(originalSnapshot.scheduledFor).getTime() !==
          new Date(updated.scheduledFor).getTime()
      ) {
        const vaccineName = updated.vaccine?.name || "vaccin";
        updates.push({
          title: "Date du rendez-vous modifiée",
          message: originalDateLabel
            ? `Le rendez-vous pour le vaccin ${vaccineName} est désormais prévu le ${newDateLabel ?? ""} (au lieu du ${originalDateLabel}).`
            : `Le rendez-vous pour le vaccin ${vaccineName} est désormais prévu le ${newDateLabel ?? ""}.`,
        });
      }

      if (originalSnapshot.vaccineId !== updated.vaccineId) {
        const oldName = originalSnapshot.vaccineName ?? "le vaccin précédent";
        const newName = updated.vaccine?.name ?? "un nouveau vaccin";
        updates.push({
          title: "Vaccin modifié",
          message: `Le rendez-vous concerne désormais ${newName} (au lieu de ${oldName}).`,
        });
      }

      if ((originalSnapshot.dose ?? 1) !== (updated.dose ?? 1)) {
        const vaccineName = updated.vaccine?.name || "vaccin";
        updates.push({
          title: "Dose mise à jour",
          message: `La dose prévue pour le rendez-vous du vaccin ${vaccineName} est désormais la dose ${updated.dose ?? 1}.`,
        });
      }

      // Vérifier si l'agent a changé
      const originalAdministeredById = originalSnapshot.administeredById ?? null;
      const newAdministeredById = updated.administeredBy?.id ?? null;
      if (originalAdministeredById !== newAdministeredById) {
        if (newAdministeredById && updated.administeredBy) {
          const agentName = `${updated.administeredBy.firstName} ${updated.administeredBy.lastName}`.trim();
          const vaccineName = updated.vaccine?.name || "vaccin";
          updates.push({
            title: "Agent modifié",
            message: `L'agent qui va administrer le vaccin ${vaccineName} est désormais ${agentName}.`,
          });
        } else if (originalAdministeredById && !newAdministeredById) {
          const vaccineName = updated.vaccine?.name || "vaccin";
          updates.push({
            title: "Agent retiré",
            message: `L'agent assigné au rendez-vous du vaccin ${vaccineName} a été retiré.`,
          });
        }
      }

      if (updates.length > 0) {
        try {
          await notifyAppointmentUpdated({
            childId: originalSnapshot.childId,
            updates,
          });
        } catch (notifyError) {
          console.error("Erreur notification modification rendez-vous:", notifyError);
        }
      }
    }

    // Notifier les agents du centre (après la réponse pour ne pas bloquer)
    setImmediate(async () => {
      try {
        const child = await prisma.children.findUnique({
          where: { id: originalSnapshot?.childId || updated?.childId },
          select: { healthCenterId: true, firstName: true, lastName: true },
        });
        if (child && child.healthCenterId) {
          const formattedDate = new Date(updated.scheduledFor).toLocaleDateString("fr-FR", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          });
          await notifyHealthCenterAgents({
            healthCenterId: child.healthCenterId,
            title: "Rendez-vous modifié",
            message: `${req.user.firstName} ${req.user.lastName} a modifié un rendez-vous pour ${child.firstName} ${child.lastName} - ${updated.vaccine?.name || "Vaccin"} (Dose ${updated.dose}) le ${formattedDate}`,
            type: "APPOINTMENT_UPDATED",
            excludeUserId: req.user.id,
          });
        }
      } catch (notifError) {
        console.error("Erreur notification agents:", notifError);
      }
    });

    res.json(updated);
  } catch (error) {
      // Gérer les erreurs Prisma spécifiques
      if (error.code === "P2002") {
        // Contrainte unique violée
        return res.status(409).json({
          message: "Un rendez-vous existe déjà pour cet enfant avec ce vaccin et cette dose. Veuillez modifier la date ou choisir un autre vaccin.",
        });
      }
      
      if (error.code === "P2025" || error.code === "NOT_FOUND" || error.status === 404) {
        return res.status(404).json({ message: error.message || "Rendez-vous introuvable" });
      }
      
      if (error.code === "DOSE_LIMIT") {
      return res.status(400).json({
        message:
          error.message ||
          "Toutes les doses de ce vaccin ont déjà été administrées ou programmées.",
      });
      }
      
      if (error.code === "FORBIDDEN" || error.status === 403) {
        return res.status(403).json({ message: error.message || "Accès refusé" });
      }
      
      if (error.status) {
        return res.status(error.status).json({ message: error.message });
      }
      
      next(error);
    }
};

const cancelScheduledVaccine = async (req, res, next) => {
  if (req.user.role !== "AGENT" || !req.user.healthCenterId) {
    return res.status(403).json({ message: "Accès refusé" });
  }

  try {
    const { id } = req.params;
    let appointmentInfo = null;

    await prisma.$transaction(async (tx) => {
      const scheduled = await tx.childVaccineScheduled.findUnique({
        where: { id },
        select: {
          id: true,
          childId: true,
          scheduledFor: true,
          child: { select: { healthCenterId: true, id: true } },
          vaccine: { select: { id: true, name: true } },
        },
      });

      if (!scheduled) {
        throw Object.assign(new Error("Rendez-vous introuvable"), {
          status: 404,
        });
      }

      if (scheduled.child?.healthCenterId !== req.user.healthCenterId) {
        throw Object.assign(new Error("Accès refusé"), { status: 403 });
      }

      // Sauvegarder les informations pour la notification
      appointmentInfo = {
        childId: scheduled.childId,
        vaccineName: scheduled.vaccine?.name ?? "vaccin",
        scheduledDate: scheduled.scheduledFor,
      };

      await releaseReservationForSchedule(tx, scheduled.id, { consume: false });

      await tx.childVaccineScheduled.delete({ where: { id } });

      if (scheduled.vaccine?.id) {
        await reassignDosesForVaccine(tx, scheduled.childId, scheduled.vaccine.id);
      }

      // Mettre à jour nextAppointment avec le prochain rendez-vous le plus proche
      await updateNextAppointment(tx, scheduled.childId);
    });

    // Envoyer une notification au parent après la transaction
    if (appointmentInfo) {
      setImmediate(async () => {
        try {
          await notifyAppointmentCancelled({
            childId: appointmentInfo.childId,
            vaccineName: appointmentInfo.vaccineName,
            scheduledDate: appointmentInfo.scheduledDate,
          });
        } catch (notifError) {
          console.error("Erreur création notification d'annulation:", notifError);
        }
      });
    }

    // Notifier les agents du centre (après la réponse pour ne pas bloquer)
    setImmediate(async () => {
      try {
        const child = await prisma.children.findUnique({
          where: { id: appointmentInfo?.childId },
          select: { healthCenterId: true, firstName: true, lastName: true },
        });
        if (child && child.healthCenterId && appointmentInfo) {
          const formattedDate = new Date(appointmentInfo.scheduledDate).toLocaleDateString("fr-FR", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          });
          await notifyHealthCenterAgents({
            healthCenterId: child.healthCenterId,
            title: "Rendez-vous annulé",
            message: `${req.user.firstName} ${req.user.lastName} a annulé un rendez-vous pour ${child.firstName} ${child.lastName} - ${appointmentInfo.vaccineName} prévu le ${formattedDate}`,
            type: "APPOINTMENT_DELETED",
            excludeUserId: req.user.id,
          });
        }
      } catch (notifError) {
        console.error("Erreur notification agents:", notifError);
      }
    });

    // Enregistrer l'événement
    if (appointmentInfo) {
      logEventAsync({
        type: "APPOINTMENT",
        action: "DELETE",
        user: {
          id: req.user.id,
          firstName: req.user.firstName,
          lastName: req.user.lastName,
          email: req.user.email,
          role: req.user.role,
        },
        entityType: "APPOINTMENT",
        entityId: id,
        entityName: appointmentInfo.vaccineName,
        details: {
          childId: appointmentInfo.childId,
          scheduledDate: appointmentInfo.scheduledDate,
        },
      });
    }

    res.status(204).send();
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ message: error.message });
    }
    next(error);
  }
};

module.exports = {
    createVaccine,
    createVaccineCalendar,
    updateVaccineCalendar,
    deleteVaccineCalendar,
    downloadVaccineCalendarPdf,
    getVaccine,
    listVaccineCalendars,
    listVaccineCalendarDoseWarnings,
    listVaccines,
    ScheduleVaccine,
    listScheduledVaccines,
    updateScheduledVaccine,
    cancelScheduledVaccine,
    updateVaccine,
    deleteVaccine,
    completeVaccine,
    missVaccine,
};