/*
  Warnings:

  - You are about to drop the column `MotherName` on the `Children` table. All the data in the column will be lost.
  - Added the required column `motherName` to the `Children` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Children" DROP COLUMN "MotherName",
ADD COLUMN     "motherName" TEXT NOT NULL;
