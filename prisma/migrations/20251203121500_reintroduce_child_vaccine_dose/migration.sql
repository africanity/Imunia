/* 
  Reintroduce dose tracking for child vaccine tables and backfill existing data.
*/

-- Drop obsolete unique indexes without dose dimension
DROP INDEX IF EXISTS "ChildVaccineCompleted_childId_vaccineCalendarId_key";
DROP INDEX IF EXISTS "ChildVaccineDue_childId_vaccineCalendarId_vaccineId_key";
DROP INDEX IF EXISTS "ChildVaccineScheduled_childId_vaccineCalendarId_vaccineId_key";

-- Add dose columns
ALTER TABLE "ChildVaccineCompleted" ADD COLUMN "dose" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "ChildVaccineDue" ADD COLUMN "dose" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "ChildVaccineLate" ADD COLUMN "dose" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "ChildVaccineOverdue" ADD COLUMN "dose" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "ChildVaccineScheduled" ADD COLUMN "dose" INTEGER NOT NULL DEFAULT 1;

-- Backfill ChildVaccineCompleted dose values based on administration order
WITH ranked_completed AS (
  SELECT
    c.id,
    ROW_NUMBER() OVER (
      PARTITION BY c."childId", c."vaccineId"
      ORDER BY c."administeredAt", c."createdAt"
    ) AS rn
  FROM "ChildVaccineCompleted" c
)
UPDATE "ChildVaccineCompleted" AS c
SET "dose" = ranked_completed.rn
FROM ranked_completed
WHERE c.id = ranked_completed.id;

-- Helper expression for ordering by calendar age (in approximate days)
-- Backfill ChildVaccineDue
WITH ranked_due AS (
  SELECT
    d.id,
    ROW_NUMBER() OVER (
      PARTITION BY d."childId", d."vaccineId"
      ORDER BY
        CASE vc."ageUnit"
          WHEN 'WEEKS' THEN COALESCE(vc."specificAge", vc."maxAge", vc."minAge", 0) * 7
          WHEN 'MONTHS' THEN COALESCE(vc."specificAge", vc."maxAge", vc."minAge", 0) * 30
          WHEN 'YEARS' THEN COALESCE(vc."specificAge", vc."maxAge", vc."minAge", 0) * 365
          ELSE COALESCE(vc."specificAge", vc."maxAge", vc."minAge", 0)
        END,
        vc.id
    ) AS rn
  FROM "ChildVaccineDue" d
  JOIN "VaccineCalendar" vc ON vc.id = d."vaccineCalendarId"
)
UPDATE "ChildVaccineDue" AS d
SET "dose" = ranked_due.rn
FROM ranked_due
WHERE d.id = ranked_due.id;

-- Backfill ChildVaccineLate
WITH ranked_late AS (
  SELECT
    l.id,
    ROW_NUMBER() OVER (
      PARTITION BY l."childId", l."vaccineId"
      ORDER BY
        CASE vc."ageUnit"
          WHEN 'WEEKS' THEN COALESCE(vc."specificAge", vc."maxAge", vc."minAge", 0) * 7
          WHEN 'MONTHS' THEN COALESCE(vc."specificAge", vc."maxAge", vc."minAge", 0) * 30
          WHEN 'YEARS' THEN COALESCE(vc."specificAge", vc."maxAge", vc."minAge", 0) * 365
          ELSE COALESCE(vc."specificAge", vc."maxAge", vc."minAge", 0)
        END,
        vc.id
    ) AS rn
  FROM "ChildVaccineLate" l
  JOIN "VaccineCalendar" vc ON vc.id = l."vaccineCalendarId"
)
UPDATE "ChildVaccineLate" AS l
SET "dose" = ranked_late.rn
FROM ranked_late
WHERE l.id = ranked_late.id;

-- Backfill ChildVaccineOverdue
WITH ranked_overdue AS (
  SELECT
    o.id,
    ROW_NUMBER() OVER (
      PARTITION BY o."childId", o."vaccineId"
      ORDER BY
        CASE vc."ageUnit"
          WHEN 'WEEKS' THEN COALESCE(vc."specificAge", vc."maxAge", vc."minAge", 0) * 7
          WHEN 'MONTHS' THEN COALESCE(vc."specificAge", vc."maxAge", vc."minAge", 0) * 30
          WHEN 'YEARS' THEN COALESCE(vc."specificAge", vc."maxAge", vc."minAge", 0) * 365
          ELSE COALESCE(vc."specificAge", vc."maxAge", vc."minAge", 0)
        END,
        vc.id
    ) AS rn
  FROM "ChildVaccineOverdue" o
  JOIN "VaccineCalendar" vc ON vc.id = o."vaccineCalendarId"
)
UPDATE "ChildVaccineOverdue" AS o
SET "dose" = ranked_overdue.rn
FROM ranked_overdue
WHERE o.id = ranked_overdue.id;

-- Backfill ChildVaccineScheduled
WITH ranked_scheduled AS (
  SELECT
    s.id,
    ROW_NUMBER() OVER (
      PARTITION BY s."childId", s."vaccineId"
      ORDER BY
        COALESCE(
          CASE vc."ageUnit"
            WHEN 'WEEKS' THEN COALESCE(vc."specificAge", vc."maxAge", vc."minAge", 0) * 7
            WHEN 'MONTHS' THEN COALESCE(vc."specificAge", vc."maxAge", vc."minAge", 0) * 30
            WHEN 'YEARS' THEN COALESCE(vc."specificAge", vc."maxAge", vc."minAge", 0) * 365
            ELSE COALESCE(vc."specificAge", vc."maxAge", vc."minAge", 0)
          END,
          EXTRACT(EPOCH FROM s."scheduledFor")
        ),
        s."scheduledFor",
        s.id
    ) AS rn
  FROM "ChildVaccineScheduled" s
  LEFT JOIN "VaccineCalendar" vc ON vc.id = s."vaccineCalendarId"
)
UPDATE "ChildVaccineScheduled" AS s
SET "dose" = ranked_scheduled.rn
FROM ranked_scheduled
WHERE s.id = ranked_scheduled.id;

-- Create new unique indexes including dose dimension
CREATE UNIQUE INDEX "ChildVaccineCompleted_childId_vaccineId_dose_key"
  ON "ChildVaccineCompleted"("childId", "vaccineId", "dose");

CREATE UNIQUE INDEX "ChildVaccineDue_childId_vaccineCalendarId_vaccineId_dose_key"
  ON "ChildVaccineDue"("childId", "vaccineCalendarId", "vaccineId", "dose");

CREATE UNIQUE INDEX "ChildVaccineScheduled_childId_vaccineCalendarId_vaccineId_dose_key"
  ON "ChildVaccineScheduled"("childId", "vaccineCalendarId", "vaccineId", "dose");

CREATE UNIQUE INDEX "ChildVaccineLate_childId_vaccineCalendarId_vaccineId_dose_key"
  ON "ChildVaccineLate"("childId", "vaccineCalendarId", "vaccineId", "dose");

CREATE UNIQUE INDEX "ChildVaccineOverdue_childId_vaccineCalendarId_vaccineId_dose_key"
  ON "ChildVaccineOverdue"("childId", "vaccineCalendarId", "vaccineId", "dose");




