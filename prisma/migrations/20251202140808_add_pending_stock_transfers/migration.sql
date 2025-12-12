/*
  Warnings:

  - You are about to drop the column `dose` on the `ChildVaccineCompleted` table. All the data in the column will be lost.
  - You are about to drop the column `dose` on the `ChildVaccineDue` table. All the data in the column will be lost.
  - You are about to drop the column `dose` on the `ChildVaccineLate` table. All the data in the column will be lost.
  - You are about to drop the column `dose` on the `ChildVaccineOverdue` table. All the data in the column will be lost.
  - You are about to drop the column `dose` on the `ChildVaccineScheduled` table. All the data in the column will be lost.
  - You are about to drop the column `nearestExpiration` on the `StockDISTRICT` table. All the data in the column will be lost.
  - You are about to drop the column `nearestExpiration` on the `StockHEALTHCENTER` table. All the data in the column will be lost.
  - You are about to drop the column `nearestExpiration` on the `StockNATIONAL` table. All the data in the column will be lost.
  - You are about to drop the column `nearestExpiration` on the `StockREGIONAL` table. All the data in the column will be lost.
  - You are about to drop the `Advice` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Campaign` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Notification` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `StockReservation` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `VaccineRequest` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[childId,vaccineCalendarId]` on the table `ChildVaccineCompleted` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[childId,vaccineCalendarId,vaccineId]` on the table `ChildVaccineDue` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[childId,vaccineCalendarId,vaccineId]` on the table `ChildVaccineScheduled` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[healthCenterId]` on the table `Children` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[email]` on the table `User` will be added. If there are existing duplicate values, this will fail.
  - Made the column `vaccineCalendarId` on table `ChildVaccineOverdue` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "PendingTransferStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED');

-- DropForeignKey
ALTER TABLE "Campaign" DROP CONSTRAINT "Campaign_regionId_fkey";

-- DropForeignKey
ALTER TABLE "ChildVaccineOverdue" DROP CONSTRAINT "ChildVaccineOverdue_vaccineCalendarId_fkey";

-- DropForeignKey
ALTER TABLE "Notification" DROP CONSTRAINT "Notification_childId_fkey";

-- DropForeignKey
ALTER TABLE "StockReservation" DROP CONSTRAINT "StockReservation_scheduleId_fkey";

-- DropForeignKey
ALTER TABLE "StockReservation" DROP CONSTRAINT "StockReservation_stockLotId_fkey";

-- DropForeignKey
ALTER TABLE "VaccineRequest" DROP CONSTRAINT "VaccineRequest_childId_fkey";

-- DropForeignKey
ALTER TABLE "VaccineRequest" DROP CONSTRAINT "VaccineRequest_scheduledById_fkey";

-- DropForeignKey
ALTER TABLE "VaccineRequest" DROP CONSTRAINT "VaccineRequest_vaccineCalendarId_fkey";

-- DropForeignKey
ALTER TABLE "VaccineRequest" DROP CONSTRAINT "VaccineRequest_vaccineId_fkey";

-- DropIndex
DROP INDEX "ChildVaccineCompleted_childId_vaccineId_dose_key";

-- DropIndex
DROP INDEX "ChildVaccineDue_childId_vaccineCalendarId_vaccineId_dose_key";

-- DropIndex
DROP INDEX "ChildVaccineLate_childId_vaccineCalendarId_vaccineId_dose_key";

-- DropIndex
DROP INDEX "ChildVaccineOverdue_childId_vaccineId_dose_key";

-- DropIndex
DROP INDEX "ChildVaccineScheduled_childId_vaccineId_dose_key";

-- DropIndex
DROP INDEX IF EXISTS "User_email_role_key";

-- Drop constraint instead of index for User_phone_role_key
ALTER TABLE "User" DROP CONSTRAINT IF EXISTS "User_phone_role_key";

-- AlterTable
ALTER TABLE "ChildVaccineCompleted" DROP COLUMN "dose";

-- AlterTable
ALTER TABLE "ChildVaccineDue" DROP COLUMN "dose";

-- AlterTable
ALTER TABLE "ChildVaccineLate" DROP COLUMN "dose";

-- AlterTable
ALTER TABLE "ChildVaccineOverdue" DROP COLUMN "dose",
ALTER COLUMN "vaccineCalendarId" SET NOT NULL;

-- AlterTable
ALTER TABLE "ChildVaccineScheduled" DROP COLUMN "dose";

-- AlterTable
ALTER TABLE "StockDISTRICT" DROP COLUMN "nearestExpiration";

-- AlterTable
ALTER TABLE "StockHEALTHCENTER" DROP COLUMN "nearestExpiration";

-- AlterTable
ALTER TABLE "StockNATIONAL" DROP COLUMN "nearestExpiration";

-- AlterTable
ALTER TABLE "StockREGIONAL" DROP COLUMN "nearestExpiration";

-- DropTable
DROP TABLE "Advice";

-- DropTable
DROP TABLE "Campaign";

-- DropTable
DROP TABLE "Notification";

-- DropTable
DROP TABLE "StockReservation";

-- DropTable
DROP TABLE "VaccineRequest";

-- CreateTable
CREATE TABLE "PendingStockTransfer" (
    "id" TEXT NOT NULL,
    "vaccineId" TEXT NOT NULL,
    "fromType" "StockLotOwnerType" NOT NULL,
    "fromId" TEXT,
    "toType" "StockLotOwnerType" NOT NULL,
    "toId" TEXT,
    "quantity" INTEGER NOT NULL,
    "status" "PendingTransferStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedAt" TIMESTAMP(3),
    "confirmedById" TEXT,

    CONSTRAINT "PendingStockTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PendingStockTransferLot" (
    "id" TEXT NOT NULL,
    "pendingTransferId" TEXT NOT NULL,
    "lotId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "PendingStockTransferLot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ChildVaccineCompleted_childId_vaccineCalendarId_key" ON "ChildVaccineCompleted"("childId", "vaccineCalendarId");

-- CreateIndex
CREATE UNIQUE INDEX "ChildVaccineDue_childId_vaccineCalendarId_vaccineId_key" ON "ChildVaccineDue"("childId", "vaccineCalendarId", "vaccineId");

-- CreateIndex
CREATE UNIQUE INDEX "ChildVaccineScheduled_childId_vaccineCalendarId_vaccineId_key" ON "ChildVaccineScheduled"("childId", "vaccineCalendarId", "vaccineId");

-- CreateIndex
CREATE UNIQUE INDEX "Children_healthCenterId_key" ON "Children"("healthCenterId");

-- Remove duplicate emails before creating unique index (keep the oldest record)
DELETE FROM "User" WHERE id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY email ORDER BY "createdAt" ASC) as rn
    FROM "User"
    WHERE email IS NOT NULL
  ) t
  WHERE t.rn > 1
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- AddForeignKey
ALTER TABLE "ChildVaccineOverdue" ADD CONSTRAINT "ChildVaccineOverdue_vaccineCalendarId_fkey" FOREIGN KEY ("vaccineCalendarId") REFERENCES "VaccineCalendar"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PendingStockTransfer" ADD CONSTRAINT "PendingStockTransfer_vaccineId_fkey" FOREIGN KEY ("vaccineId") REFERENCES "Vaccine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PendingStockTransfer" ADD CONSTRAINT "PendingStockTransfer_confirmedById_fkey" FOREIGN KEY ("confirmedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PendingStockTransferLot" ADD CONSTRAINT "PendingStockTransferLot_pendingTransferId_fkey" FOREIGN KEY ("pendingTransferId") REFERENCES "PendingStockTransfer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PendingStockTransferLot" ADD CONSTRAINT "PendingStockTransferLot_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "StockLot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
