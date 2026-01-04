-- CreateTable
CREATE TABLE "StockReservation" (
    "id" TEXT NOT NULL,
    "stockLotId" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockReservation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StockReservation_scheduleId_key" ON "StockReservation"("scheduleId");

-- AddForeignKey
ALTER TABLE "StockReservation" ADD CONSTRAINT "StockReservation_stockLotId_fkey" FOREIGN KEY ("stockLotId") REFERENCES "StockLot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockReservation" ADD CONSTRAINT "StockReservation_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "ChildVaccineScheduled"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
