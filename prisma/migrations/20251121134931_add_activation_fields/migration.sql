-- CreateEnum
CREATE TYPE "Role" AS ENUM ('NATIONAL', 'REGIONAL', 'DISTRICT', 'AGENT');

-- CreateEnum
CREATE TYPE "AgentLevel" AS ENUM ('ADMIN', 'STAFF');

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
    "code" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "region" TEXT,
    "agentLevel" "AgentLevel",
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

    CONSTRAINT "HealthCenter_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_code_key" ON "User"("code");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_healthCenterId_fkey" FOREIGN KEY ("healthCenterId") REFERENCES "HealthCenter"("id") ON DELETE SET NULL ON UPDATE CASCADE;
