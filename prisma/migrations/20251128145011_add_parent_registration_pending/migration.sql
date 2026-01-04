-- CreateTable
CREATE TABLE "ParentRegistrationPending" (
    "id" TEXT NOT NULL,
    "parentName" TEXT NOT NULL,
    "parentPhone" TEXT NOT NULL,
    "parentEmail" TEXT,
    "childFirstName" TEXT NOT NULL,
    "childLastName" TEXT NOT NULL,
    "childBirthDate" TIMESTAMP(3) NOT NULL,
    "childGender" TEXT NOT NULL,
    "address" TEXT,
    "verificationCode" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ParentRegistrationPending_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ParentRegistrationPending_parentPhone_verificationCode_idx" ON "ParentRegistrationPending"("parentPhone", "verificationCode");

-- CreateIndex
CREATE INDEX "ParentRegistrationPending_expiresAt_idx" ON "ParentRegistrationPending"("expiresAt");
