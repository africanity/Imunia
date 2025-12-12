-- Ensure we only keep the single unique constraint on User.email

-- Drop legacy unique constraints (some were created as constraints, others as indexes)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'User_email_role_key'
  ) THEN
    ALTER TABLE "User" DROP CONSTRAINT "User_email_role_key";
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'User_phone_role_key'
  ) THEN
    ALTER TABLE "User" DROP CONSTRAINT "User_phone_role_key";
  END IF;
END $$;

DROP INDEX IF EXISTS "User_email_role_key";
DROP INDEX IF EXISTS "User_phone_role_key";

-- Recreate the single-column unique index on email if it is missing
CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email");




