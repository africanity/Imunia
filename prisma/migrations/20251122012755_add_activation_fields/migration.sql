-- CreateEnum
CREATE TYPE "AgeUnit" AS ENUM ('WEEKS', 'MONTHS', 'YEARS');

-- CreateTable
CREATE TABLE "VaccineCalendar" (
    "id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "ageUnit" TEXT NOT NULL,
    "specificAge" INTEGER NOT NULL,
    "minAge" INTEGER NOT NULL,
    "maxAge" INTEGER NOT NULL,

    CONSTRAINT "VaccineCalendar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vaccine" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vaccine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_VaccineToVaccineCalendar" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_VaccineToVaccineCalendar_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_VaccineToVaccineCalendar_B_index" ON "_VaccineToVaccineCalendar"("B");

-- AddForeignKey
ALTER TABLE "_VaccineToVaccineCalendar" ADD CONSTRAINT "_VaccineToVaccineCalendar_A_fkey" FOREIGN KEY ("A") REFERENCES "Vaccine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_VaccineToVaccineCalendar" ADD CONSTRAINT "_VaccineToVaccineCalendar_B_fkey" FOREIGN KEY ("B") REFERENCES "VaccineCalendar"("id") ON DELETE CASCADE ON UPDATE CASCADE;
