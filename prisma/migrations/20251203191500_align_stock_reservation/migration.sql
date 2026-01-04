-- Align StockReservation schema with Prisma model
ALTER TABLE "StockReservation"
  DROP CONSTRAINT IF EXISTS "StockReservation_scheduleId_fkey";

ALTER TABLE "StockReservation"
  ALTER COLUMN "updatedAt" DROP DEFAULT;

ALTER TABLE "StockReservation"
  ADD CONSTRAINT "StockReservation_scheduleId_fkey"
    FOREIGN KEY ("scheduleId") REFERENCES "ChildVaccineScheduled"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;




