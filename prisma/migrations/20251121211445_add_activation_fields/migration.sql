-- DropIndex
DROP INDEX "User_code_key";

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "code" DROP NOT NULL;
