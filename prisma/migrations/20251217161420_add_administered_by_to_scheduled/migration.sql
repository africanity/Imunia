-- AlterTable
ALTER TABLE "ChildVaccineScheduled" ADD COLUMN "administeredById" TEXT;

-- AddForeignKey
ALTER TABLE "ChildVaccineScheduled" ADD CONSTRAINT "ChildVaccineScheduled_administeredById_fkey" FOREIGN KEY ("administeredById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;



