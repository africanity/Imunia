-- Drop the unique constraint on email alone
DROP INDEX IF EXISTS "User_email_key";

-- Add composite unique constraints: email+role and phone+role
-- This allows the same email/phone to be used by different roles, but not twice with the same role
CREATE UNIQUE INDEX "User_email_role_key" ON "User"("email", "role");
CREATE UNIQUE INDEX "User_phone_role_key" ON "User"("phone", "role");

-- Recreate Campaign table (it was accidentally dropped in a previous migration)
CREATE TABLE IF NOT EXISTS "Campaign" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "regionId" TEXT NOT NULL,
    "medias" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey Campaign.regionId (if not exists)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'Campaign_regionId_fkey'
    ) THEN
        ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "Region"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

