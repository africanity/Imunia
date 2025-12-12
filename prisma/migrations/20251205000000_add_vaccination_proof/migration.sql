-- CreateTable
CREATE TABLE "ChildVaccinationProof" (
    "id" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER,
    "mimeType" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChildVaccinationProof_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChildVaccinationProof_childId_idx" ON "ChildVaccinationProof"("childId");

-- CreateIndex
CREATE INDEX "ChildVaccinationProof_uploadedAt_idx" ON "ChildVaccinationProof"("uploadedAt");

-- AddForeignKey
ALTER TABLE "ChildVaccinationProof" ADD CONSTRAINT "ChildVaccinationProof_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Children"("id") ON DELETE CASCADE ON UPDATE CASCADE;


