/*
  Warnings:

  - You are about to drop the column `comune` on the `HealthCenter` table. All the data in the column will be lost.
  - Added the required column `commune` to the `HealthCenter` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "HealthCenter" DROP COLUMN "comune",
ADD COLUMN     "commune" TEXT NOT NULL;
