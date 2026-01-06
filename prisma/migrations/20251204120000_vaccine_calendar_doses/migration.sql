CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create new table to store explicit dose assignments between vaccines and calendar entries
CREATE TABLE "VaccineCalendarDose" (
    "id" TEXT NOT NULL,
    "vaccineId" TEXT NOT NULL,
    "calendarId" TEXT NOT NULL,
    "doseNumber" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VaccineCalendarDose_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "VaccineCalendarDose_vaccineId_fkey"
        FOREIGN KEY ("vaccineId") REFERENCES "Vaccine"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "VaccineCalendarDose_calendarId_fkey"
        FOREIGN KEY ("calendarId") REFERENCES "VaccineCalendar"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "VaccineCalendarDose_vaccineId_doseNumber_key"
    ON "VaccineCalendarDose"("vaccineId", "doseNumber");

CREATE INDEX "VaccineCalendarDose_calendarId_idx"
    ON "VaccineCalendarDose"("calendarId");

-- Backfill the new table using existing many-to-many links
INSERT INTO "VaccineCalendarDose" ("id", "vaccineId", "calendarId", "doseNumber")
SELECT
    gen_random_uuid(),
    link."A" AS "vaccineId",
    link."B" AS "calendarId",
    ROW_NUMBER() OVER (
        PARTITION BY link."A"
        ORDER BY
            CASE "vc"."ageUnit"
                WHEN 'WEEKS' THEN 1
                WHEN 'MONTHS' THEN 2
                WHEN 'YEARS' THEN 3
                ELSE 4
            END,
            COALESCE("vc"."specificAge", "vc"."minAge", "vc"."maxAge", 0)
    ) AS "doseNumber"
FROM "_VaccineToVaccineCalendar" AS link
INNER JOIN "VaccineCalendar" AS "vc" ON "vc"."id" = link."B";

-- Remove the legacy implicit relation table
DROP TABLE "_VaccineToVaccineCalendar";

