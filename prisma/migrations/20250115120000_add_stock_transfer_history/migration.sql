-- CreateTable
CREATE TABLE IF NOT EXISTS "StockTransferHistory" (
    "id" TEXT NOT NULL,
    "vaccineId" TEXT NOT NULL,
    "vaccineName" TEXT NOT NULL,
    "fromType" "StockLotOwnerType" NOT NULL,
    "fromId" TEXT,
    "fromName" TEXT,
    "toType" "StockLotOwnerType" NOT NULL,
    "toId" TEXT,
    "toName" TEXT,
    "quantity" INTEGER NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL,
    "confirmedAt" TIMESTAMP(3) NOT NULL,
    "confirmedById" TEXT,
    "confirmedByName" TEXT,
    "lotExpiration" TIMESTAMP(3),
    "lotStatus" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockTransferHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "StockTransferHistory_fromType_fromId_idx" ON "StockTransferHistory"("fromType", "fromId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "StockTransferHistory_toType_toId_idx" ON "StockTransferHistory"("toType", "toId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "StockTransferHistory_vaccineId_idx" ON "StockTransferHistory"("vaccineId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "StockTransferHistory_confirmedAt_idx" ON "StockTransferHistory"("confirmedAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "StockTransferHistory_sentAt_idx" ON "StockTransferHistory"("sentAt");


