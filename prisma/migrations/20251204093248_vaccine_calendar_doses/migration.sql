DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'VaccineCalendarDose'
      AND column_name = 'updatedAt'
      AND column_default IS NOT NULL
  ) THEN
    ALTER TABLE "VaccineCalendarDose"
      ALTER COLUMN "updatedAt" DROP DEFAULT;
  END IF;
END $$;
