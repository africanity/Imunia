-- CreateEnum (si n'existe pas déjà)
DO $$ BEGIN
  CREATE TYPE "ResponsibleType" AS ENUM ('PERE', 'MERE', 'TUTEUR');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AlterTable: Ajouter tuteur (si n'existe pas déjà)
DO $$ BEGIN
  ALTER TABLE "Children" ADD COLUMN "tuteur" TEXT;
EXCEPTION
  WHEN duplicate_column THEN null;
END $$;

-- AlterTable: Ajouter responsable avec valeur par défaut pour les données existantes
DO $$ BEGIN
  ALTER TABLE "Children" ADD COLUMN "responsable" "ResponsibleType" NOT NULL DEFAULT 'PERE';
EXCEPTION
  WHEN duplicate_column THEN null;
END $$;

-- Mettre à jour les données existantes : si fatherName existe, responsable = PERE, sinon si motherName existe, responsable = MERE, sinon PERE
UPDATE "Children" 
SET "responsable" = CASE 
  WHEN "fatherName" IS NOT NULL AND "fatherName" != '' THEN 'PERE'::"ResponsibleType"
  WHEN "motherName" IS NOT NULL AND "motherName" != '' THEN 'MERE'::"ResponsibleType"
  ELSE 'PERE'::"ResponsibleType"
END
WHERE "responsable" IS NULL OR "responsable" = 'PERE'::"ResponsibleType";

-- Supprimer la valeur par défaut maintenant que toutes les données sont mises à jour
ALTER TABLE "Children" ALTER COLUMN "responsable" DROP DEFAULT;

-- AlterTable: Supprimer emailParent (si existe)
ALTER TABLE "Children" DROP COLUMN IF EXISTS "emailParent";
