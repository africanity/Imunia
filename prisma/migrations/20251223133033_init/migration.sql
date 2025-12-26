-- CreateEnum
CREATE TYPE "Role" AS ENUM ('NATIONAL', 'REGIONAL', 'DISTRICT', 'AGENT');

-- CreateEnum
CREATE TYPE "AgentLevel" AS ENUM ('ADMIN', 'STAFF');

-- CreateEnum
CREATE TYPE "AgeUnit" AS ENUM ('WEEKS', 'MONTHS', 'YEARS');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('M', 'F');

-- CreateEnum
CREATE TYPE "Status" AS ENUM ('A_JOUR', 'PAS_A_JOUR');

-- CreateEnum
CREATE TYPE "StockLotOwnerType" AS ENUM ('NATIONAL', 'REGIONAL', 'DISTRICT', 'HEALTHCENTER');

-- CreateEnum
CREATE TYPE "StockLotStatus" AS ENUM ('VALID', 'EXPIRED');

-- CreateEnum
CREATE TYPE "PendingTransferStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "pendingEmail" TEXT,
    "emailVerificationCode" TEXT,
    "emailVerificationExpiry" TIMESTAMP(3),
    "password" TEXT NOT NULL,
    "code" TEXT,
    "phone" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "regionId" TEXT,
    "agentLevel" "AgentLevel",
    "districtId" TEXT,
    "healthCenterId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "activationToken" TEXT,
    "activationExpires" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HealthCenter" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "districtId" TEXT NOT NULL,

    CONSTRAINT "HealthCenter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Region" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Region_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "regionId" TEXT NOT NULL,
    "medias" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VaccineCalendar" (
    "id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "ageUnit" "AgeUnit" NOT NULL,
    "specificAge" INTEGER NOT NULL,
    "minAge" INTEGER NOT NULL,
    "maxAge" INTEGER NOT NULL,

    CONSTRAINT "VaccineCalendar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vaccine" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "dosesRequired" TEXT NOT NULL,
    "gender" "Gender",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vaccine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VaccineCalendarDose" (
    "id" TEXT NOT NULL,
    "vaccineId" TEXT NOT NULL,
    "calendarId" TEXT NOT NULL,
    "doseNumber" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VaccineCalendarDose_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Commune" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "regionId" TEXT NOT NULL,

    CONSTRAINT "Commune_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "District" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "communeId" TEXT NOT NULL,

    CONSTRAINT "District_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockNATIONAL" (
    "id" TEXT NOT NULL,
    "vaccineId" TEXT NOT NULL,
    "quantity" INTEGER,

    CONSTRAINT "StockNATIONAL_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockREGIONAL" (
    "id" TEXT NOT NULL,
    "vaccineId" TEXT NOT NULL,
    "regionId" TEXT NOT NULL,
    "quantity" INTEGER DEFAULT 0,

    CONSTRAINT "StockREGIONAL_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockDISTRICT" (
    "id" TEXT NOT NULL,
    "vaccineId" TEXT NOT NULL,
    "districtId" TEXT NOT NULL,
    "quantity" INTEGER,

    CONSTRAINT "StockDISTRICT_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockHEALTHCENTER" (
    "id" TEXT NOT NULL,
    "vaccineId" TEXT NOT NULL,
    "healthCenterId" TEXT NOT NULL,
    "quantity" INTEGER,

    CONSTRAINT "StockHEALTHCENTER_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Children" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "birthDate" TIMESTAMP(3) NOT NULL,
    "birthPlace" TEXT NOT NULL,
    "gender" "Gender" NOT NULL,
    "address" TEXT NOT NULL,
    "healthCenterId" TEXT NOT NULL,
    "status" "Status" NOT NULL,
    "emailParent" TEXT NOT NULL,
    "passwordParent" TEXT NOT NULL DEFAULT '0000',
    "code" TEXT,
    "phoneParent" TEXT NOT NULL,
    "fatherName" TEXT NOT NULL,
    "motherName" TEXT NOT NULL,
    "nextVaccineId" TEXT,
    "nextAgentId" TEXT,
    "nextAppointment" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "photosRequested" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Children_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Record" (
    "id" TEXT NOT NULL,
    "healthCenterId" TEXT NOT NULL,
    "vaccineId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "childrenId" TEXT NOT NULL,

    CONSTRAINT "Record_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChildVaccineCompleted" (
    "id" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "vaccineCalendarId" TEXT,
    "vaccineId" TEXT NOT NULL,
    "dose" INTEGER NOT NULL DEFAULT 1,
    "administeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "administeredById" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChildVaccineCompleted_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChildVaccineDue" (
    "id" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "vaccineCalendarId" TEXT NOT NULL,
    "vaccineId" TEXT NOT NULL,
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "dose" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "ChildVaccineDue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChildVaccineScheduled" (
    "id" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "vaccineCalendarId" TEXT,
    "vaccineId" TEXT NOT NULL,
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "plannerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "dose" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "ChildVaccineScheduled_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChildVaccineOverdue" (
    "id" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "vaccineCalendarId" TEXT NOT NULL,
    "vaccineId" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "escalatedToId" TEXT,
    "dose" INTEGER NOT NULL DEFAULT 1,

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
    "dose" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "ChildVaccineLate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

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

-- CreateTable
CREATE TABLE "Advice" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "category" TEXT,
    "ageUnit" "AgeUnit",
    "minAge" INTEGER,
    "maxAge" INTEGER,
    "specificAge" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Advice_pkey" PRIMARY KEY ("id")
);

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

-- CreateTable
CREATE TABLE "ChildVaccinationProof" (
    "id" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER,
    "mimeType" TEXT,
    "uploadedBy" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChildVaccinationProof_pkey" PRIMARY KEY ("id")
);

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
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "VaccineCalendarDose_calendarId_idx" ON "VaccineCalendarDose"("calendarId");

-- CreateIndex
CREATE UNIQUE INDEX "VaccineCalendarDose_vaccineId_doseNumber_key" ON "VaccineCalendarDose"("vaccineId", "doseNumber");

-- CreateIndex
CREATE UNIQUE INDEX "District_communeId_key" ON "District"("communeId");

-- CreateIndex
CREATE UNIQUE INDEX "StockNATIONAL_vaccineId_key" ON "StockNATIONAL"("vaccineId");

-- CreateIndex
CREATE UNIQUE INDEX "StockREGIONAL_vaccineId_regionId_key" ON "StockREGIONAL"("vaccineId", "regionId");

-- CreateIndex
CREATE UNIQUE INDEX "StockDISTRICT_vaccineId_districtId_key" ON "StockDISTRICT"("vaccineId", "districtId");

-- CreateIndex
CREATE UNIQUE INDEX "StockHEALTHCENTER_vaccineId_healthCenterId_key" ON "StockHEALTHCENTER"("vaccineId", "healthCenterId");

-- CreateIndex
CREATE UNIQUE INDEX "ChildVaccineCompleted_childId_vaccineId_dose_key" ON "ChildVaccineCompleted"("childId", "vaccineId", "dose");

-- CreateIndex
CREATE UNIQUE INDEX "ChildVaccineDue_childId_vaccineCalendarId_vaccineId_dose_key" ON "ChildVaccineDue"("childId", "vaccineCalendarId", "vaccineId", "dose");

-- CreateIndex
CREATE UNIQUE INDEX "ChildVaccineScheduled_childId_vaccineCalendarId_vaccineId_d_key" ON "ChildVaccineScheduled"("childId", "vaccineCalendarId", "vaccineId", "dose");

-- CreateIndex
CREATE UNIQUE INDEX "ChildVaccineOverdue_childId_vaccineCalendarId_vaccineId_dos_key" ON "ChildVaccineOverdue"("childId", "vaccineCalendarId", "vaccineId", "dose");

-- CreateIndex
CREATE UNIQUE INDEX "ChildVaccineLate_childId_vaccineCalendarId_vaccineId_dose_key" ON "ChildVaccineLate"("childId", "vaccineCalendarId", "vaccineId", "dose");

-- CreateIndex
CREATE INDEX "Notification_childId_idx" ON "Notification"("childId");

-- CreateIndex
CREATE INDEX "Notification_isRead_idx" ON "Notification"("isRead");

-- CreateIndex
CREATE INDEX "Notification_createdAt_idx" ON "Notification"("createdAt");

-- CreateIndex
CREATE INDEX "StockLot_ownerType_ownerId_vaccineId_idx" ON "StockLot"("ownerType", "ownerId", "vaccineId");

-- CreateIndex
CREATE UNIQUE INDEX "StockReservation_scheduleId_key" ON "StockReservation"("scheduleId");

-- CreateIndex
CREATE INDEX "VaccineRequest_childId_idx" ON "VaccineRequest"("childId");

-- CreateIndex
CREATE INDEX "VaccineRequest_status_idx" ON "VaccineRequest"("status");

-- CreateIndex
CREATE INDEX "VaccineRequest_requestedAt_idx" ON "VaccineRequest"("requestedAt");

-- CreateIndex
CREATE INDEX "VaccineRequest_scheduledById_idx" ON "VaccineRequest"("scheduledById");

-- CreateIndex
CREATE INDEX "ChildVaccinationProof_childId_idx" ON "ChildVaccinationProof"("childId");

-- CreateIndex
CREATE INDEX "ChildVaccinationProof_uploadedAt_idx" ON "ChildVaccinationProof"("uploadedAt");

-- CreateIndex
CREATE INDEX "StockExpirationNotification_notifiedAt_idx" ON "StockExpirationNotification"("notifiedAt");

-- CreateIndex
CREATE INDEX "StockExpirationNotification_expirationDate_idx" ON "StockExpirationNotification"("expirationDate");

-- CreateIndex
CREATE UNIQUE INDEX "StockExpirationNotification_stockLotId_userId_notificationT_key" ON "StockExpirationNotification"("stockLotId", "userId", "notificationType");

-- CreateIndex
CREATE INDEX "AppointmentNotification_appointmentDate_idx" ON "AppointmentNotification"("appointmentDate");

-- CreateIndex
CREATE INDEX "AppointmentNotification_notifiedAt_idx" ON "AppointmentNotification"("notifiedAt");

-- CreateIndex
CREATE INDEX "AppointmentNotification_childId_idx" ON "AppointmentNotification"("childId");

-- CreateIndex
CREATE INDEX "AppointmentNotification_scheduledVaccineId_idx" ON "AppointmentNotification"("scheduledVaccineId");

-- CreateIndex
CREATE UNIQUE INDEX "AppointmentNotification_childId_notificationType_appointmen_key" ON "AppointmentNotification"("childId", "notificationType", "appointmentDate");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "Region"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_districtId_fkey" FOREIGN KEY ("districtId") REFERENCES "District"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_healthCenterId_fkey" FOREIGN KEY ("healthCenterId") REFERENCES "HealthCenter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HealthCenter" ADD CONSTRAINT "HealthCenter_districtId_fkey" FOREIGN KEY ("districtId") REFERENCES "District"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "Region"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VaccineCalendarDose" ADD CONSTRAINT "VaccineCalendarDose_vaccineId_fkey" FOREIGN KEY ("vaccineId") REFERENCES "Vaccine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VaccineCalendarDose" ADD CONSTRAINT "VaccineCalendarDose_calendarId_fkey" FOREIGN KEY ("calendarId") REFERENCES "VaccineCalendar"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Commune" ADD CONSTRAINT "Commune_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "Region"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "District" ADD CONSTRAINT "District_communeId_fkey" FOREIGN KEY ("communeId") REFERENCES "Commune"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockNATIONAL" ADD CONSTRAINT "StockNATIONAL_vaccineId_fkey" FOREIGN KEY ("vaccineId") REFERENCES "Vaccine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockREGIONAL" ADD CONSTRAINT "StockREGIONAL_vaccineId_fkey" FOREIGN KEY ("vaccineId") REFERENCES "Vaccine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockREGIONAL" ADD CONSTRAINT "StockREGIONAL_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "Region"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockDISTRICT" ADD CONSTRAINT "StockDISTRICT_vaccineId_fkey" FOREIGN KEY ("vaccineId") REFERENCES "Vaccine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockDISTRICT" ADD CONSTRAINT "StockDISTRICT_districtId_fkey" FOREIGN KEY ("districtId") REFERENCES "District"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockHEALTHCENTER" ADD CONSTRAINT "StockHEALTHCENTER_vaccineId_fkey" FOREIGN KEY ("vaccineId") REFERENCES "Vaccine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockHEALTHCENTER" ADD CONSTRAINT "StockHEALTHCENTER_healthCenterId_fkey" FOREIGN KEY ("healthCenterId") REFERENCES "HealthCenter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Children" ADD CONSTRAINT "Children_healthCenterId_fkey" FOREIGN KEY ("healthCenterId") REFERENCES "HealthCenter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Children" ADD CONSTRAINT "Children_nextVaccineId_fkey" FOREIGN KEY ("nextVaccineId") REFERENCES "Vaccine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Children" ADD CONSTRAINT "Children_nextAgentId_fkey" FOREIGN KEY ("nextAgentId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Record" ADD CONSTRAINT "Record_healthCenterId_fkey" FOREIGN KEY ("healthCenterId") REFERENCES "HealthCenter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Record" ADD CONSTRAINT "Record_vaccineId_fkey" FOREIGN KEY ("vaccineId") REFERENCES "Vaccine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Record" ADD CONSTRAINT "Record_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Record" ADD CONSTRAINT "Record_childrenId_fkey" FOREIGN KEY ("childrenId") REFERENCES "Children"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChildVaccineCompleted" ADD CONSTRAINT "ChildVaccineCompleted_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Children"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChildVaccineCompleted" ADD CONSTRAINT "ChildVaccineCompleted_vaccineCalendarId_fkey" FOREIGN KEY ("vaccineCalendarId") REFERENCES "VaccineCalendar"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChildVaccineCompleted" ADD CONSTRAINT "ChildVaccineCompleted_vaccineId_fkey" FOREIGN KEY ("vaccineId") REFERENCES "Vaccine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChildVaccineCompleted" ADD CONSTRAINT "ChildVaccineCompleted_administeredById_fkey" FOREIGN KEY ("administeredById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChildVaccineDue" ADD CONSTRAINT "ChildVaccineDue_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Children"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChildVaccineDue" ADD CONSTRAINT "ChildVaccineDue_vaccineCalendarId_fkey" FOREIGN KEY ("vaccineCalendarId") REFERENCES "VaccineCalendar"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChildVaccineDue" ADD CONSTRAINT "ChildVaccineDue_vaccineId_fkey" FOREIGN KEY ("vaccineId") REFERENCES "Vaccine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChildVaccineScheduled" ADD CONSTRAINT "ChildVaccineScheduled_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Children"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChildVaccineScheduled" ADD CONSTRAINT "ChildVaccineScheduled_vaccineCalendarId_fkey" FOREIGN KEY ("vaccineCalendarId") REFERENCES "VaccineCalendar"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChildVaccineScheduled" ADD CONSTRAINT "ChildVaccineScheduled_vaccineId_fkey" FOREIGN KEY ("vaccineId") REFERENCES "Vaccine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChildVaccineScheduled" ADD CONSTRAINT "ChildVaccineScheduled_plannerId_fkey" FOREIGN KEY ("plannerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

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

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Children"("id") ON DELETE CASCADE ON UPDATE CASCADE;

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

-- AddForeignKey
ALTER TABLE "PendingStockTransfer" ADD CONSTRAINT "PendingStockTransfer_vaccineId_fkey" FOREIGN KEY ("vaccineId") REFERENCES "Vaccine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PendingStockTransfer" ADD CONSTRAINT "PendingStockTransfer_confirmedById_fkey" FOREIGN KEY ("confirmedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PendingStockTransferLot" ADD CONSTRAINT "PendingStockTransferLot_pendingTransferId_fkey" FOREIGN KEY ("pendingTransferId") REFERENCES "PendingStockTransfer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PendingStockTransferLot" ADD CONSTRAINT "PendingStockTransferLot_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "StockLot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockReservation" ADD CONSTRAINT "StockReservation_stockLotId_fkey" FOREIGN KEY ("stockLotId") REFERENCES "StockLot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockReservation" ADD CONSTRAINT "StockReservation_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "ChildVaccineScheduled"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VaccineRequest" ADD CONSTRAINT "VaccineRequest_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Children"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VaccineRequest" ADD CONSTRAINT "VaccineRequest_vaccineId_fkey" FOREIGN KEY ("vaccineId") REFERENCES "Vaccine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VaccineRequest" ADD CONSTRAINT "VaccineRequest_vaccineCalendarId_fkey" FOREIGN KEY ("vaccineCalendarId") REFERENCES "VaccineCalendar"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VaccineRequest" ADD CONSTRAINT "VaccineRequest_scheduledById_fkey" FOREIGN KEY ("scheduledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChildVaccinationProof" ADD CONSTRAINT "ChildVaccinationProof_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Children"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockExpirationNotification" ADD CONSTRAINT "StockExpirationNotification_stockLotId_fkey" FOREIGN KEY ("stockLotId") REFERENCES "StockLot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockExpirationNotification" ADD CONSTRAINT "StockExpirationNotification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppointmentNotification" ADD CONSTRAINT "AppointmentNotification_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Children"("id") ON DELETE CASCADE ON UPDATE CASCADE;
