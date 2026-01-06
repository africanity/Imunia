-- AlterTable
ALTER TABLE "ChildVaccinationProof" ADD COLUMN IF NOT EXISTS "title" TEXT NOT NULL DEFAULT '';
ALTER TABLE "ChildVaccinationProof" ADD COLUMN IF NOT EXISTS "uploadedBy" TEXT;

-- Mettre à jour les titres existants avec le nom de fichier (sans extension)
-- Gérer les cas où fileName est vide ou ne contient qu'une extension
UPDATE "ChildVaccinationProof" 
SET "title" = CASE 
  WHEN "fileName" IS NULL OR "fileName" = '' THEN 'Document sans nom'
  WHEN "fileName" ~ '^\.' THEN "fileName" -- Fichier commençant par un point (ex: .htaccess)
  ELSE COALESCE(
    NULLIF(REGEXP_REPLACE("fileName", '\.[^.]*$', ''), ''),
    "fileName"
  )
END
WHERE "title" = '' OR "title" IS NULL;

-- Supprimer la valeur par défaut après la mise à jour
ALTER TABLE "ChildVaccinationProof" ALTER COLUMN "title" DROP DEFAULT;

