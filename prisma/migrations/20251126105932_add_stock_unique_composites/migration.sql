-- CreateEnum
CREATE TYPE "StockLotOwnerType" AS ENUM ('NATIONAL', 'REGIONAL', 'DISTRICT', 'HEALTHCENTER');

-- CreateEnum
CREATE TYPE "StockLotStatus" AS ENUM ('VALID', 'EXPIRED');

-- AlterTable
ALTER TABLE "StockDISTRICT" ADD COLUMN     "nearestExpiration" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "StockHEALTHCENTER" ADD COLUMN     "nearestExpiration" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "StockNATIONAL" ADD COLUMN     "nearestExpiration" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "StockREGIONAL" ADD COLUMN     "nearestExpiration" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "StockLot" (
    "id" TEXT NOT NULL,
    "vaccineId" TEXT NOT NULL,
    "ownerType" "StockLotOwnerType" NOT NULL,
    "ownerId" TEXT,
    "quantity" INTEGER NOT NULL,
    "remainingQuantity" INTEGER NOT NULL,
    "expiration" TIMESTAMP(3) NOT NULL,
    "status" "StockLotStatus" NOT NULL DEFAULT 'VALID',
    "sourceLotId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockLot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockTransfer" (
    "id" TEXT NOT NULL,
    "vaccineId" TEXT NOT NULL,
    "fromType" "StockLotOwnerType" NOT NULL,
    "fromId" TEXT,
    "toType" "StockLotOwnerType" NOT NULL,
    "toId" TEXT,
    "quantity" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockTransferLot" (
    "id" TEXT NOT NULL,
    "transferId" TEXT NOT NULL,
    "lotId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "StockTransferLot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StockLot_ownerType_ownerId_vaccineId_idx" ON "StockLot"("ownerType", "ownerId", "vaccineId");

-- AddForeignKey
ALTER TABLE "StockLot" ADD CONSTRAINT "StockLot_vaccineId_fkey" FOREIGN KEY ("vaccineId") REFERENCES "Vaccine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockLot" ADD CONSTRAINT "StockLot_sourceLotId_fkey" FOREIGN KEY ("sourceLotId") REFERENCES "StockLot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockTransfer" ADD CONSTRAINT "StockTransfer_vaccineId_fkey" FOREIGN KEY ("vaccineId") REFERENCES "Vaccine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockTransferLot" ADD CONSTRAINT "StockTransferLot_transferId_fkey" FOREIGN KEY ("transferId") REFERENCES "StockTransfer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockTransferLot" ADD CONSTRAINT "StockTransferLot_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "StockLot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
