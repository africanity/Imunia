/*
  Warnings:

  - You are about to drop the `ChildVaccinePlanned` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "ChildVaccinePlanned" DROP CONSTRAINT "ChildVaccinePlanned_childId_fkey";

-- DropForeignKey
ALTER TABLE "ChildVaccinePlanned" DROP CONSTRAINT "ChildVaccinePlanned_plannerId_fkey";

-- DropForeignKey
ALTER TABLE "ChildVaccinePlanned" DROP CONSTRAINT "ChildVaccinePlanned_vaccineCalendarId_fkey";

-- DropForeignKey
ALTER TABLE "ChildVaccinePlanned" DROP CONSTRAINT "ChildVaccinePlanned_vaccineId_fkey";

-- DropTable
DROP TABLE "ChildVaccinePlanned";

-- CreateTable
CREATE TABLE "ChildVaccineDue" (
    "id" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "vaccineCalendarId" TEXT NOT NULL,
    "vaccineId" TEXT NOT NULL,
    "scheduledFor" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChildVaccineDue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChildVaccineScheduled" (
    "id" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "vaccineCalendarId" TEXT NOT NULL,
    "vaccineId" TEXT NOT NULL,
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "plannerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChildVaccineScheduled_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ChildVaccineDue_childId_vaccineCalendarId_vaccineId_key" ON "ChildVaccineDue"("childId", "vaccineCalendarId", "vaccineId");

-- CreateIndex
CREATE UNIQUE INDEX "ChildVaccineScheduled_childId_vaccineCalendarId_vaccineId_key" ON "ChildVaccineScheduled"("childId", "vaccineCalendarId", "vaccineId");

-- AddForeignKey
ALTER TABLE "ChildVaccineDue" ADD CONSTRAINT "ChildVaccineDue_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Children"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChildVaccineDue" ADD CONSTRAINT "ChildVaccineDue_vaccineCalendarId_fkey" FOREIGN KEY ("vaccineCalendarId") REFERENCES "VaccineCalendar"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChildVaccineDue" ADD CONSTRAINT "ChildVaccineDue_vaccineId_fkey" FOREIGN KEY ("vaccineId") REFERENCES "Vaccine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChildVaccineScheduled" ADD CONSTRAINT "ChildVaccineScheduled_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Children"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChildVaccineScheduled" ADD CONSTRAINT "ChildVaccineScheduled_vaccineCalendarId_fkey" FOREIGN KEY ("vaccineCalendarId") REFERENCES "VaccineCalendar"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChildVaccineScheduled" ADD CONSTRAINT "ChildVaccineScheduled_vaccineId_fkey" FOREIGN KEY ("vaccineId") REFERENCES "Vaccine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChildVaccineScheduled" ADD CONSTRAINT "ChildVaccineScheduled_plannerId_fkey" FOREIGN KEY ("plannerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
