-- CreateTable
CREATE TABLE "VaccinationProof" (
    "id" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "mimeType" TEXT,
    "fileSize" INTEGER,
    "uploadedBy" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VaccinationProof_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VaccinationProof_childId_idx" ON "VaccinationProof"("childId");

-- AddForeignKey
ALTER TABLE "VaccinationProof" ADD CONSTRAINT "VaccinationProof_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Children"("id") ON DELETE RESTRICT ON UPDATE CASCADE;



