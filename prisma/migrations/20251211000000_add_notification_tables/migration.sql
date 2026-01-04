-- CreateTable
CREATE TABLE "StockExpirationNotification" (
    "id" TEXT NOT NULL,
    "stockLotId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "notifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expirationDate" TIMESTAMP(3) NOT NULL,
    "daysBeforeExpiration" INTEGER NOT NULL,
    "notificationType" TEXT NOT NULL,

    CONSTRAINT "StockExpirationNotification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppointmentNotification" (
    "id" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "scheduledVaccineId" TEXT,
    "appointmentDate" TIMESTAMP(3) NOT NULL,
    "notificationType" TEXT NOT NULL,
    "notifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentVia" TEXT NOT NULL,

    CONSTRAINT "AppointmentNotification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StockExpirationNotification_notifiedAt_idx" ON "StockExpirationNotification"("notifiedAt");

-- CreateIndex
CREATE INDEX "StockExpirationNotification_expirationDate_idx" ON "StockExpirationNotification"("expirationDate");

-- CreateIndex
CREATE UNIQUE INDEX "StockExpirationNotification_stockLotId_userId_notificationType_key" ON "StockExpirationNotification"("stockLotId", "userId", "notificationType");

-- CreateIndex
CREATE INDEX "AppointmentNotification_appointmentDate_idx" ON "AppointmentNotification"("appointmentDate");

-- CreateIndex
CREATE INDEX "AppointmentNotification_notifiedAt_idx" ON "AppointmentNotification"("notifiedAt");

-- CreateIndex
CREATE INDEX "AppointmentNotification_childId_idx" ON "AppointmentNotification"("childId");

-- CreateIndex
CREATE INDEX "AppointmentNotification_scheduledVaccineId_idx" ON "AppointmentNotification"("scheduledVaccineId");

-- CreateIndex
CREATE UNIQUE INDEX "AppointmentNotification_childId_notificationType_appointmentDate_key" ON "AppointmentNotification"("childId", "notificationType", "appointmentDate");

-- AddForeignKey
ALTER TABLE "StockExpirationNotification" ADD CONSTRAINT "StockExpirationNotification_stockLotId_fkey" FOREIGN KEY ("stockLotId") REFERENCES "StockLot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockExpirationNotification" ADD CONSTRAINT "StockExpirationNotification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppointmentNotification" ADD CONSTRAINT "AppointmentNotification_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Children"("id") ON DELETE CASCADE ON UPDATE CASCADE;





