const prisma = require("../config/prismaClient");
const { buildVaccineDoseMap } = require("../utils/vaccineDose");

const DAYS_PER_WEEK = 7;
const DAYS_PER_MONTH = 30.4375;
const DAYS_PER_YEAR = 365.25;

const AGE_UNIT_IN_DAYS = {
  WEEKS: DAYS_PER_WEEK,
  MONTHS: DAYS_PER_MONTH,
  YEARS: DAYS_PER_YEAR,
};

const isVaccineSuitableForGender = (vaccine, childGender) => {
  if (!vaccine.gender) {
    return true;
  }
  return vaccine.gender === childGender;
};

const computeAgeInDays = (birthDate) => {
  const now = new Date();
  const birth = new Date(birthDate);
  return Math.floor((now.getTime() - birth.getTime()) / 86400000);
};

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

const computeAgeByUnit = (birthDate, unit) => {
  const diffDays = computeAgeInDays(birthDate);

  switch (unit) {
    case "WEEKS":
      return Math.floor(diffDays / DAYS_PER_WEEK);
    case "MONTHS":
      return Math.floor(diffDays / DAYS_PER_MONTH);
    case "YEARS":
      return Math.floor(diffDays / DAYS_PER_YEAR);
    default:
      return diffDays;
  }
};

const computeScheduledDate = (birthDate, specificAge, maxAge, unit) => {
  const base = new Date(birthDate);
  const value = specificAge != null ? specificAge : maxAge;
  if (value == null) {
    return base;
  }

  if (unit === "WEEKS") {
    base.setDate(base.getDate() + value * DAYS_PER_WEEK);
  } else if (unit === "MONTHS") {
    base.setMonth(base.getMonth() + value);
  } else if (unit === "YEARS") {
    base.setFullYear(base.getFullYear() + value);
  } else {
    base.setDate(base.getDate() + value);
  }

  return base;
};

const getDoseKey = (vaccineId, calendarId, dose) =>
  `${vaccineId}::${calendarId ?? "none"}::${dose ?? 1}`;

const buildKeySet = (entries = []) =>
  new Set(
    entries.map((entry) =>
      getDoseKey(entry.vaccineId, entry.vaccineCalendarId, entry.dose ?? 1),
    ),
  );

const buildVaccineMetadata = (calendars) => {
  const map = new Map();
  for (const calendar of calendars) {
    const assignments = calendar.doseAssignments ?? [];
    for (const assignment of assignments) {
      const vaccine = assignment?.vaccine;
      if (!vaccine?.id) {
        continue;
      }
      if (!map.has(vaccine.id)) {
        map.set(vaccine.id, {
          gender: vaccine.gender ?? null,
        });
      }
    }
  }
  return map;
};

const rebuildChildVaccinationBuckets = async (
  childId,
  tx = prisma,
  sharedContext = {},
) => {
  const {
    calendars: sharedCalendars,
    doseMap: sharedDoseMap,
    vaccineMeta: sharedVaccineMeta,
  } = sharedContext;
  const [calendars, child] = await Promise.all([
    sharedCalendars ??
      tx.vaccineCalendar.findMany({
        include: {
          doseAssignments: {
            include: {
              vaccine: {
                select: {
                  id: true,
                  gender: true,
                  dosesRequired: true,
                },
              },
            },
          },
        },
      }),
    tx.children.findUnique({
      where: { id: childId },
      include: {
        completedVaccines: true,
        scheduledVaccines: true,
        overdueVaccines: true,
        lateVaccines: true,
      },
    }),
  ]);

  if (!child) {
    return;
  }

  if (!calendars.length) {
    await Promise.all([
      tx.childVaccineDue.deleteMany({ where: { childId } }),
      tx.childVaccineLate.deleteMany({ where: { childId } }),
    ]);
    await tx.children.update({
      where: { id: childId },
      data: { status: "A_JOUR" },
    });
    return;
  }

  const doseMap = sharedDoseMap ?? buildVaccineDoseMap(calendars);
  const vaccineMeta = sharedVaccineMeta ?? buildVaccineMetadata(calendars);

  await Promise.all([
    tx.childVaccineDue.deleteMany({ where: { childId } }),
    tx.childVaccineLate.deleteMany({ where: { childId } }),
  ]);

  const completedSet = buildKeySet(child.completedVaccines);
  const scheduledSet = buildKeySet(child.scheduledVaccines);
  const overdueSet = buildKeySet(child.overdueVaccines);

  const dueCreate = [];
  const lateCreate = [];

  const today = new Date();

  for (const [vaccineId, meta] of vaccineMeta.entries()) {
    if (meta.gender && meta.gender !== child.gender) {
      continue;
    }

    const descriptors = doseMap.doseDefinitionMap?.get(vaccineId);
    if (!descriptors || descriptors.size === 0) {
      continue;
    }

    const sortedDescriptors = Array.from(descriptors.entries()).sort(
      ([doseA], [doseB]) => doseA - doseB,
    );

    for (const [doseNumber, descriptor] of sortedDescriptors) {
      if (!descriptor) {
        continue;
      }

      const key = getDoseKey(vaccineId, descriptor.calendarId, doseNumber);
      if (
        completedSet.has(key) ||
        scheduledSet.has(key) ||
        overdueSet.has(key)
      ) {
        continue;
      }

      const ageValue = computeAgeByUnit(child.birthDate, descriptor.ageUnit);
      const minAge = descriptor.minAge ?? 0;
      const maxAge = descriptor.maxAge ?? null;
      const withinRange =
        ageValue >= minAge && (maxAge == null || ageValue <= maxAge);
      const pastRange = maxAge != null && ageValue > maxAge;
      const scheduledDate = computeScheduledDate(
        child.birthDate,
        descriptor.specificAge,
        descriptor.maxAge,
        descriptor.ageUnit,
      );

      if (withinRange) {
        dueCreate.push({
          childId,
          vaccineId,
          vaccineCalendarId: descriptor.calendarId,
          scheduledFor: scheduledDate,
          dose: doseNumber,
        });
      } else if (pastRange && scheduledDate < today) {
        lateCreate.push({
          childId,
          vaccineId,
          vaccineCalendarId: descriptor.calendarId,
          dueDate: scheduledDate,
          dose: doseNumber,
        });
      }
    }
  }

  if (dueCreate.length > 0) {
    await tx.childVaccineDue.createMany({
      data: dueCreate,
      skipDuplicates: true,
    });
  }

  if (lateCreate.length > 0) {
    await tx.childVaccineLate.createMany({
      data: lateCreate,
      skipDuplicates: true,
    });
  }

  const hasLateOrOverdue =
    lateCreate.length > 0 ||
    (await tx.childVaccineLate.count({ where: { childId } })) > 0 ||
    (await tx.childVaccineOverdue.count({ where: { childId } })) > 0;

  await tx.children.update({
    where: { id: childId },
    data: {
      status: hasLateOrOverdue ? "PAS_A_JOUR" : "A_JOUR",
    },
  });
};

const rebuildAllVaccinationBuckets = async () => {
  const calendars = await prisma.vaccineCalendar.findMany({
    include: {
      doseAssignments: {
        include: {
          vaccine: {
            select: {
              id: true,
              gender: true,
              dosesRequired: true,
            },
          },
        },
      },
    },
  });
  const doseMap = buildVaccineDoseMap(calendars);
  const vaccineMeta = buildVaccineMetadata(calendars);
  const children = await prisma.children.findMany({ select: { id: true } });

  for (const child of children) {
    await rebuildChildVaccinationBuckets(child.id, prisma, {
      calendars,
      doseMap,
      vaccineMeta,
    });
  }
};

module.exports = {
  rebuildChildVaccinationBuckets,
  rebuildAllVaccinationBuckets,
};

