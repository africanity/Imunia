-- AlterTable
-- Add gender column to Vaccine table
ALTER TABLE "Vaccine" ADD COLUMN IF NOT EXISTS "gender" "Gender";
