-- CreateEnum (if not exists)
DO $$ BEGIN
 CREATE TYPE "PendingTransferStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- Drop constraint User_phone_role_key if it exists (it's a constraint, not an index)
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'User_phone_role_key'
    ) THEN
        ALTER TABLE "User" DROP CONSTRAINT "User_phone_role_key";
    END IF;
END $$;

-- Drop index User_phone_role_key if it exists (fallback)
DROP INDEX IF EXISTS "User_phone_role_key";

-- CreateTable PendingStockTransfer (if not exists)
CREATE TABLE IF NOT EXISTS "PendingStockTransfer" (
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

-- CreateTable PendingStockTransferLot (if not exists)
CREATE TABLE IF NOT EXISTS "PendingStockTransferLot" (
    "id" TEXT NOT NULL,
    "pendingTransferId" TEXT NOT NULL,
    "lotId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "PendingStockTransferLot_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey PendingStockTransfer.vaccineId
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'PendingStockTransfer_vaccineId_fkey'
    ) THEN
        ALTER TABLE "PendingStockTransfer" ADD CONSTRAINT "PendingStockTransfer_vaccineId_fkey" FOREIGN KEY ("vaccineId") REFERENCES "Vaccine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey PendingStockTransfer.confirmedById
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'PendingStockTransfer_confirmedById_fkey'
    ) THEN
        ALTER TABLE "PendingStockTransfer" ADD CONSTRAINT "PendingStockTransfer_confirmedById_fkey" FOREIGN KEY ("confirmedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey PendingStockTransferLot.pendingTransferId
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'PendingStockTransferLot_pendingTransferId_fkey'
    ) THEN
        ALTER TABLE "PendingStockTransferLot" ADD CONSTRAINT "PendingStockTransferLot_pendingTransferId_fkey" FOREIGN KEY ("pendingTransferId") REFERENCES "PendingStockTransfer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey PendingStockTransferLot.lotId
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'PendingStockTransferLot_lotId_fkey'
    ) THEN
        ALTER TABLE "PendingStockTransferLot" ADD CONSTRAINT "PendingStockTransferLot_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "StockLot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;






