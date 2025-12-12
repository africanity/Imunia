-- CreateTable
CREATE TABLE "VaccineRequest" (
    "id" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "vaccineId" TEXT NOT NULL,
    "vaccineCalendarId" TEXT,
    "dose" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "scheduledFor" TIMESTAMP(3),
    "scheduledById" TEXT,
    "appointmentId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VaccineRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VaccineRequest_childId_idx" ON "VaccineRequest"("childId");

-- CreateIndex
CREATE INDEX "VaccineRequest_status_idx" ON "VaccineRequest"("status");

-- CreateIndex
CREATE INDEX "VaccineRequest_requestedAt_idx" ON "VaccineRequest"("requestedAt");

-- CreateIndex
CREATE INDEX "VaccineRequest_scheduledById_idx" ON "VaccineRequest"("scheduledById");

-- AddForeignKey
ALTER TABLE "VaccineRequest" ADD CONSTRAINT "VaccineRequest_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Children"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VaccineRequest" ADD CONSTRAINT "VaccineRequest_vaccineId_fkey" FOREIGN KEY ("vaccineId") REFERENCES "Vaccine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VaccineRequest" ADD CONSTRAINT "VaccineRequest_vaccineCalendarId_fkey" FOREIGN KEY ("vaccineCalendarId") REFERENCES "VaccineCalendar"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VaccineRequest" ADD CONSTRAINT "VaccineRequest_scheduledById_fkey" FOREIGN KEY ("scheduledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
