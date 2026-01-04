CREATE TABLE "StockReservation" (
    "id" TEXT NOT NULL,
    "stockLotId" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockReservation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StockReservation_scheduleId_key" ON "StockReservation"("scheduleId");

ALTER TABLE "StockReservation"
    ADD CONSTRAINT "StockReservation_stockLotId_fkey"
    FOREIGN KEY ("stockLotId") REFERENCES "StockLot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "StockReservation"
    ADD CONSTRAINT "StockReservation_scheduleId_fkey"
    FOREIGN KEY ("scheduleId") REFERENCES "ChildVaccineScheduled"("id") ON DELETE CASCADE ON UPDATE CASCADE;




