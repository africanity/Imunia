-- Allow many children to reference the same health center
ALTER TABLE "Children"
DROP CONSTRAINT IF EXISTS "Children_healthCenterId_key";

DROP INDEX IF EXISTS "Children_healthCenterId_key";

