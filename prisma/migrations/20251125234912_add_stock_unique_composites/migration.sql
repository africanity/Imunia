-- DropForeignKey
ALTER TABLE "ChildVaccineCompleted" DROP CONSTRAINT "ChildVaccineCompleted_vaccineCalendarId_fkey";

-- DropForeignKey
ALTER TABLE "ChildVaccineOverdue" DROP CONSTRAINT "ChildVaccineOverdue_vaccineCalendarId_fkey";

-- DropForeignKey
ALTER TABLE "ChildVaccineScheduled" DROP CONSTRAINT "ChildVaccineScheduled_vaccineCalendarId_fkey";

-- AlterTable
ALTER TABLE "ChildVaccineCompleted" ALTER COLUMN "vaccineCalendarId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "ChildVaccineOverdue" ALTER COLUMN "vaccineCalendarId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "ChildVaccineScheduled" ALTER COLUMN "vaccineCalendarId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "ChildVaccineCompleted" ADD CONSTRAINT "ChildVaccineCompleted_vaccineCalendarId_fkey" FOREIGN KEY ("vaccineCalendarId") REFERENCES "VaccineCalendar"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChildVaccineScheduled" ADD CONSTRAINT "ChildVaccineScheduled_vaccineCalendarId_fkey" FOREIGN KEY ("vaccineCalendarId") REFERENCES "VaccineCalendar"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChildVaccineOverdue" ADD CONSTRAINT "ChildVaccineOverdue_vaccineCalendarId_fkey" FOREIGN KEY ("vaccineCalendarId") REFERENCES "VaccineCalendar"("id") ON DELETE SET NULL ON UPDATE CASCADE;
