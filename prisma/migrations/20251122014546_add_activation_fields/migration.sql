/*
  Warnings:

  - Added the required column `dosesRequired` to the `Vaccine` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Vaccine" ADD COLUMN     "dosesRequired" TEXT NOT NULL;
