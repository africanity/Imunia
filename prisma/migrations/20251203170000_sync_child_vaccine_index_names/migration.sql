DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'ChildVaccineOverdue_childId_vaccineCalendarId_vaccineId_dose_ke'
  ) THEN
    ALTER INDEX "ChildVaccineOverdue_childId_vaccineCalendarId_vaccineId_dose_ke"
      RENAME TO "ChildVaccineOverdue_childId_vaccineCalendarId_vaccineId_dos_key";
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'ChildVaccineScheduled_childId_vaccineCalendarId_vaccineId_dose_'
  ) THEN
    ALTER INDEX "ChildVaccineScheduled_childId_vaccineCalendarId_vaccineId_dose_"
      RENAME TO "ChildVaccineScheduled_childId_vaccineCalendarId_vaccineId_d_key";
  END IF;
END $$;




