/*
  Warnings:

  - Changed the type of `ageUnit` on the `VaccineCalendar` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('M', 'F');

-- CreateEnum
CREATE TYPE "Status" AS ENUM ('A_JOUR', 'PAS_A_JOUR');

-- AlterTable
ALTER TABLE "VaccineCalendar" DROP COLUMN "ageUnit",
ADD COLUMN     "ageUnit" "AgeUnit" NOT NULL;

-- CreateTable
CREATE TABLE "Children" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "birthDate" TIMESTAMP(3) NOT NULL,
    "birthPlace" TEXT NOT NULL,
    "gender" "Gender" NOT NULL,
    "address" TEXT NOT NULL,
    "healthCenterId" TEXT NOT NULL,
    "status" "Status" NOT NULL,
    "emailParent" TEXT NOT NULL,
    "passwordParent" TEXT NOT NULL DEFAULT '0000',
    "code" TEXT,
    "phoneParent" TEXT NOT NULL,
    "fatherName" TEXT NOT NULL,
    "MotherName" TEXT NOT NULL,
    "nextVaccineId" TEXT,
    "nextAgentId" TEXT,
    "nextAppointment" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Children_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Record" (
    "id" TEXT NOT NULL,
    "healthCenterId" TEXT NOT NULL,
    "vaccineId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "childrenId" TEXT NOT NULL,

    CONSTRAINT "Record_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Children_healthCenterId_key" ON "Children"("healthCenterId");

-- AddForeignKey
ALTER TABLE "Children" ADD CONSTRAINT "Children_healthCenterId_fkey" FOREIGN KEY ("healthCenterId") REFERENCES "HealthCenter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Children" ADD CONSTRAINT "Children_nextVaccineId_fkey" FOREIGN KEY ("nextVaccineId") REFERENCES "Vaccine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Children" ADD CONSTRAINT "Children_nextAgentId_fkey" FOREIGN KEY ("nextAgentId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Record" ADD CONSTRAINT "Record_healthCenterId_fkey" FOREIGN KEY ("healthCenterId") REFERENCES "HealthCenter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Record" ADD CONSTRAINT "Record_vaccineId_fkey" FOREIGN KEY ("vaccineId") REFERENCES "Vaccine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Record" ADD CONSTRAINT "Record_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Record" ADD CONSTRAINT "Record_childrenId_fkey" FOREIGN KEY ("childrenId") REFERENCES "Children"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
