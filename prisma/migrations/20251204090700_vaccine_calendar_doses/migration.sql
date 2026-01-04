DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'VaccineRequest'
      AND constraint_name = 'VaccineRequest_childId_fkey'
  ) THEN
    ALTER TABLE "VaccineRequest"
      DROP CONSTRAINT "VaccineRequest_childId_fkey";
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'VaccineCalendarDose'
      AND column_name = 'updatedAt'
  ) THEN
    ALTER TABLE "VaccineCalendarDose"
      ALTER COLUMN "updatedAt" DROP DEFAULT;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'VaccineRequest'
  ) THEN
    ALTER TABLE "VaccineRequest"
      ADD CONSTRAINT "VaccineRequest_childId_fkey"
      FOREIGN KEY ("childId") REFERENCES "Children"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
