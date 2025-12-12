-- CreateTable
CREATE TABLE "ChildVaccineCompleted" (
    "id" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "vaccineCalendarId" TEXT NOT NULL,
    "vaccineId" TEXT NOT NULL,
    "administeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "administeredById" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChildVaccineCompleted_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChildVaccinePlanned" (
    "id" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "vaccineCalendarId" TEXT NOT NULL,
    "vaccineId" TEXT NOT NULL,
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "plannerId" TEXT,

    CONSTRAINT "ChildVaccinePlanned_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChildVaccineOverdue" (
    "id" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "vaccineCalendarId" TEXT NOT NULL,
    "vaccineId" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "escalatedToId" TEXT,

    CONSTRAINT "ChildVaccineOverdue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChildVaccineLate" (
    "id" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "vaccineCalendarId" TEXT NOT NULL,
    "vaccineId" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChildVaccineLate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ChildVaccineCompleted_childId_vaccineCalendarId_key" ON "ChildVaccineCompleted"("childId", "vaccineCalendarId");

-- AddForeignKey
ALTER TABLE "ChildVaccineCompleted" ADD CONSTRAINT "ChildVaccineCompleted_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Children"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChildVaccineCompleted" ADD CONSTRAINT "ChildVaccineCompleted_vaccineCalendarId_fkey" FOREIGN KEY ("vaccineCalendarId") REFERENCES "VaccineCalendar"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChildVaccineCompleted" ADD CONSTRAINT "ChildVaccineCompleted_vaccineId_fkey" FOREIGN KEY ("vaccineId") REFERENCES "Vaccine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChildVaccineCompleted" ADD CONSTRAINT "ChildVaccineCompleted_administeredById_fkey" FOREIGN KEY ("administeredById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChildVaccinePlanned" ADD CONSTRAINT "ChildVaccinePlanned_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Children"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChildVaccinePlanned" ADD CONSTRAINT "ChildVaccinePlanned_vaccineCalendarId_fkey" FOREIGN KEY ("vaccineCalendarId") REFERENCES "VaccineCalendar"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChildVaccinePlanned" ADD CONSTRAINT "ChildVaccinePlanned_vaccineId_fkey" FOREIGN KEY ("vaccineId") REFERENCES "Vaccine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChildVaccinePlanned" ADD CONSTRAINT "ChildVaccinePlanned_plannerId_fkey" FOREIGN KEY ("plannerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChildVaccineOverdue" ADD CONSTRAINT "ChildVaccineOverdue_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Children"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChildVaccineOverdue" ADD CONSTRAINT "ChildVaccineOverdue_vaccineCalendarId_fkey" FOREIGN KEY ("vaccineCalendarId") REFERENCES "VaccineCalendar"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChildVaccineOverdue" ADD CONSTRAINT "ChildVaccineOverdue_vaccineId_fkey" FOREIGN KEY ("vaccineId") REFERENCES "Vaccine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChildVaccineOverdue" ADD CONSTRAINT "ChildVaccineOverdue_escalatedToId_fkey" FOREIGN KEY ("escalatedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChildVaccineLate" ADD CONSTRAINT "ChildVaccineLate_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Children"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChildVaccineLate" ADD CONSTRAINT "ChildVaccineLate_vaccineCalendarId_fkey" FOREIGN KEY ("vaccineCalendarId") REFERENCES "VaccineCalendar"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChildVaccineLate" ADD CONSTRAINT "ChildVaccineLate_vaccineId_fkey" FOREIGN KEY ("vaccineId") REFERENCES "Vaccine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
