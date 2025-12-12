const AGE_UNIT_TO_DAYS = {
  WEEKS: 7,
  MONTHS: 30.4375,
  YEARS: 365.25,
};

const computeAgeWeight = (calendarEntry) => {
  if (!calendarEntry) {
    return 0;
  }
  const base =
    calendarEntry.specificAge ??
    calendarEntry.maxAge ??
    calendarEntry.minAge ??
    0;
  const multiplier = AGE_UNIT_TO_DAYS[calendarEntry.ageUnit] ?? 7;
  return base * multiplier;
};

const buildVaccineDoseMap = (calendarEntries = []) => {
  const doseDefinitionMap = new Map();
  const fallbackCounters = new Map();

  for (const entry of calendarEntries) {
    const assignments = entry?.doseAssignments ?? entry?.vaccines ?? [];

    for (const assignment of assignments) {
      const vaccine = assignment?.vaccine ?? assignment;
      const vaccineId = vaccine?.id ?? assignment?.vaccineId;
      const rawDoseNumber =
        assignment?.doseNumber ??
        assignment?.dose ??
        assignment?.dose_index ??
        null;

      let doseNumber;
      const parsedDoseNumber = Number(rawDoseNumber);
      if (Number.isFinite(parsedDoseNumber)) {
        doseNumber = Math.max(1, Math.floor(parsedDoseNumber));
      } else {
        const currentCount = fallbackCounters.get(vaccineId) ?? 0;
        doseNumber = currentCount + 1;
        fallbackCounters.set(vaccineId, doseNumber);
      }

      if (!vaccineId) {
        continue;
      }

      if (!doseDefinitionMap.has(vaccineId)) {
        doseDefinitionMap.set(vaccineId, new Map());
      }

      doseDefinitionMap.get(vaccineId).set(doseNumber, {
        calendarId: entry.id,
        ageUnit: entry.ageUnit,
        specificAge: entry.specificAge,
        minAge: entry.minAge,
        maxAge: entry.maxAge,
        description: entry.description ?? null,
      });
    }
  }

  return {
    doseDefinitionMap,
  };
};

const getDoseDescriptor = (doseMap, vaccineId, doseNumber) => {
  if (!doseMap || !vaccineId || !doseNumber) {
    return null;
  }

  const descriptors = doseMap.doseDefinitionMap?.get(vaccineId);
  if (!descriptors || descriptors.size === 0) {
    return null;
  }

  if (descriptors.has(doseNumber)) {
    return descriptors.get(doseNumber);
  }

  let fallbackDescriptor = null;
  let fallbackDose = -Infinity;

  for (const [definedDose, descriptor] of descriptors.entries()) {
    if (definedDose > fallbackDose) {
      fallbackDose = definedDose;
      fallbackDescriptor = descriptor;
    }
  }

  return fallbackDescriptor;
};

module.exports = {
  buildVaccineDoseMap,
  getDoseDescriptor,
};

