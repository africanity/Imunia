-- Migration de résolution du drift pour VaccineCalendarDose.updatedAt
-- Cette migration aligne l'état de la base avec le schéma Prisma
-- Le drift indique que updatedAt a un DEFAULT alors qu'il ne devrait pas en avoir avec @updatedAt

DO $$
BEGIN
  -- Supprimer le DEFAULT de updatedAt si il existe
  -- car @updatedAt dans Prisma gère automatiquement la mise à jour sans DEFAULT
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


