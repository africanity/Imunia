/*
  Warnings:

  - A unique constraint covering the columns `[vaccineId,districtId]` on the table `StockDISTRICT` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[vaccineId,regionId]` on the table `StockREGIONAL` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "StockDISTRICT_vaccineId_districtId_key" ON "StockDISTRICT"("vaccineId", "districtId");

-- CreateIndex
CREATE UNIQUE INDEX "StockREGIONAL_vaccineId_regionId_key" ON "StockREGIONAL"("vaccineId", "regionId");
