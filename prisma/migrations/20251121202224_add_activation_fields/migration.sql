/*
  Warnings:

  - You are about to drop the column `region` on the `HealthCenter` table. All the data in the column will be lost.
  - You are about to drop the column `region` on the `User` table. All the data in the column will be lost.
  - Added the required column `regionId` to the `HealthCenter` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "HealthCenter" DROP COLUMN "region",
ADD COLUMN     "regionId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "User" DROP COLUMN "region",
ADD COLUMN     "regionId" TEXT;

-- CreateTable
CREATE TABLE "Region" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Region_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "Region"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HealthCenter" ADD CONSTRAINT "HealthCenter_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "Region"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
