/*
  Warnings:

  - You are about to drop the column `commune` on the `HealthCenter` table. All the data in the column will be lost.
  - You are about to drop the column `regionId` on the `HealthCenter` table. All the data in the column will be lost.
  - Added the required column `districtId` to the `HealthCenter` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "HealthCenter" DROP CONSTRAINT "HealthCenter_regionId_fkey";

-- AlterTable
ALTER TABLE "HealthCenter" DROP COLUMN "commune",
DROP COLUMN "regionId",
ADD COLUMN     "districtId" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "Commune" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "regionId" TEXT NOT NULL,

    CONSTRAINT "Commune_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "District" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "communeId" TEXT NOT NULL,

    CONSTRAINT "District_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "District_communeId_key" ON "District"("communeId");

-- AddForeignKey
ALTER TABLE "HealthCenter" ADD CONSTRAINT "HealthCenter_districtId_fkey" FOREIGN KEY ("districtId") REFERENCES "District"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Commune" ADD CONSTRAINT "Commune_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "Region"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "District" ADD CONSTRAINT "District_communeId_fkey" FOREIGN KEY ("communeId") REFERENCES "Commune"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
