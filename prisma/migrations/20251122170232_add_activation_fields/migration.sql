/*
  Warnings:

  - A unique constraint covering the columns `[districtId]` on the table `StockDISTRICT` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[healthCenterId]` on the table `StockHEALTHCENTER` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[vaccineId,healthCenterId]` on the table `StockHEALTHCENTER` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[regionId]` on the table `StockREGIONAL` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `districtId` to the `StockDISTRICT` table without a default value. This is not possible if the table is not empty.
  - Added the required column `healthCenterId` to the `StockHEALTHCENTER` table without a default value. This is not possible if the table is not empty.
  - Added the required column `regionId` to the `StockREGIONAL` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "StockDISTRICT" ADD COLUMN     "districtId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "StockHEALTHCENTER" ADD COLUMN     "healthCenterId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "StockREGIONAL" ADD COLUMN     "regionId" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "StockDISTRICT_districtId_key" ON "StockDISTRICT"("districtId");

-- CreateIndex
CREATE UNIQUE INDEX "StockHEALTHCENTER_healthCenterId_key" ON "StockHEALTHCENTER"("healthCenterId");

-- CreateIndex
CREATE UNIQUE INDEX "StockHEALTHCENTER_vaccineId_healthCenterId_key" ON "StockHEALTHCENTER"("vaccineId", "healthCenterId");

-- CreateIndex
CREATE UNIQUE INDEX "StockREGIONAL_regionId_key" ON "StockREGIONAL"("regionId");

-- AddForeignKey
ALTER TABLE "StockREGIONAL" ADD CONSTRAINT "StockREGIONAL_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "Region"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockDISTRICT" ADD CONSTRAINT "StockDISTRICT_districtId_fkey" FOREIGN KEY ("districtId") REFERENCES "District"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockHEALTHCENTER" ADD CONSTRAINT "StockHEALTHCENTER_healthCenterId_fkey" FOREIGN KEY ("healthCenterId") REFERENCES "HealthCenter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
