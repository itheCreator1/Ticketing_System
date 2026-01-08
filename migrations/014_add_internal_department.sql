-- Migration: Add 'Internal' department for admin-only tickets
-- Purpose: Enable admins to create internal tickets visible only to other admins
-- Date: 2026-01-08
-- Version: v2.2.0

-- Step 1: Drop existing CHECK constraint on reporter_department
ALTER TABLE tickets
DROP CONSTRAINT IF EXISTS tickets_reporter_department_check;

-- Step 2: Recreate CHECK constraint with 'Internal' added
ALTER TABLE tickets
ADD CONSTRAINT tickets_reporter_department_check
CHECK (reporter_department IN (
  'IT Support',
  'General Support',
  'Human Resources',
  'Finance',
  'Facilities',
  'Internal'
));

-- Verification query (run after migration):
-- SELECT conname, pg_get_constraintdef(oid)
-- FROM pg_constraint
-- WHERE conname = 'tickets_reporter_department_check';
