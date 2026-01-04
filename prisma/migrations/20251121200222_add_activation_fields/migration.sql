/*
  Warnings:

  - Added the required column `address` to the `HealthCenter` table without a default value. This is not possible if the table is not empty.
  - Added the required column `comune` to the `HealthCenter` table without a default value. This is not possible if the table is not empty.
  - Added the required column `region` to the `HealthCenter` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "HealthCenter" ADD COLUMN     "address" TEXT NOT NULL,
ADD COLUMN     "comune" TEXT NOT NULL,
ADD COLUMN     "region" TEXT NOT NULL;
