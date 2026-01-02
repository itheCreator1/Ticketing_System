-- Migration: Modify ticket reporter fields
-- Purpose: Remove email, make name optional, add department and desk
-- Date: 2026-01-02

-- Step 1: Add new columns as nullable first (safe operation)
ALTER TABLE tickets
ADD COLUMN reporter_department VARCHAR(100),
ADD COLUMN reporter_desk VARCHAR(100);

-- Step 2: Backfill existing tickets with default values
UPDATE tickets
SET reporter_department = 'General Support',
    reporter_desk = 'Not Specified'
WHERE reporter_department IS NULL;

-- Step 3: Add NOT NULL constraints after backfill
ALTER TABLE tickets
ALTER COLUMN reporter_department SET NOT NULL,
ALTER COLUMN reporter_desk SET NOT NULL;

-- Step 4: Add CHECK constraints for data integrity
ALTER TABLE tickets
ADD CONSTRAINT tickets_reporter_department_check
CHECK (reporter_department IN ('IT Support', 'General Support', 'Human Resources', 'Finance', 'Facilities'));

ALTER TABLE tickets
ADD CONSTRAINT tickets_reporter_desk_check
CHECK (reporter_desk IN ('Director', 'Manager', 'Nursing Station', 'Doctors office', 'Secretary', 'Not Specified'));

-- Step 5: Remove reporter_email column (safe after adding new fields)
ALTER TABLE tickets
DROP COLUMN reporter_email;

-- Note: reporter_name is already nullable in the schema, no change needed
