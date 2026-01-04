/*
  Warnings:

  - A unique constraint covering the columns `[childId,vaccineId,dose]` on the table `ChildVaccineCompleted` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[childId,vaccineCalendarId,vaccineId,dose]` on the table `ChildVaccineDue` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[childId,vaccineCalendarId,vaccineId,dose]` on the table `ChildVaccineLate` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[childId,vaccineId,dose]` on the table `ChildVaccineOverdue` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[childId,vaccineId,dose]` on the table `ChildVaccineScheduled` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "ChildVaccineCompleted_childId_vaccineCalendarId_key";

-- DropIndex
DROP INDEX "ChildVaccineDue_childId_vaccineCalendarId_vaccineId_key";

-- DropIndex
DROP INDEX "ChildVaccineScheduled_childId_vaccineCalendarId_vaccineId_key";

-- AlterTable
ALTER TABLE "ChildVaccineCompleted" ADD COLUMN     "dose" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "ChildVaccineDue" ADD COLUMN     "dose" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "ChildVaccineLate" ADD COLUMN     "dose" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "ChildVaccineOverdue" ADD COLUMN     "dose" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "ChildVaccineScheduled" ADD COLUMN     "dose" INTEGER NOT NULL DEFAULT 1;

-- CreateIndex
CREATE UNIQUE INDEX "ChildVaccineCompleted_childId_vaccineId_dose_key" ON "ChildVaccineCompleted"("childId", "vaccineId", "dose");

-- CreateIndex
CREATE UNIQUE INDEX "ChildVaccineDue_childId_vaccineCalendarId_vaccineId_dose_key" ON "ChildVaccineDue"("childId", "vaccineCalendarId", "vaccineId", "dose");

-- CreateIndex
CREATE UNIQUE INDEX "ChildVaccineLate_childId_vaccineCalendarId_vaccineId_dose_key" ON "ChildVaccineLate"("childId", "vaccineCalendarId", "vaccineId", "dose");

-- CreateIndex
CREATE UNIQUE INDEX "ChildVaccineOverdue_childId_vaccineId_dose_key" ON "ChildVaccineOverdue"("childId", "vaccineId", "dose");

-- CreateIndex
CREATE UNIQUE INDEX "ChildVaccineScheduled_childId_vaccineId_dose_key" ON "ChildVaccineScheduled"("childId", "vaccineId", "dose");
