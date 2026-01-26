-- Migration: 020_add_department_floor.sql
-- Description: Add floor field to departments table with validation
-- Date: 2026-01-26

-- Add floor column as nullable first (for backward compatibility during deployment)
ALTER TABLE departments
ADD COLUMN floor VARCHAR(20);

-- Add CHECK constraint to enforce valid floor values
ALTER TABLE departments
ADD CONSTRAINT departments_floor_check
CHECK (floor IN (
  'Basement',
  'Ground Floor',
  '1st Floor',
  '2nd Floor',
  '3rd Floor',
  '4th Floor',
  '5th Floor',
  '6th Floor'
));

-- Add index for efficient filtering (if we add floor-based search later)
CREATE INDEX idx_departments_floor ON departments(floor);

-- Update existing hospital departments with default floor assignments
UPDATE departments SET floor = 'Basement' WHERE name = 'Facilities Management';
UPDATE departments SET floor = 'Ground Floor' WHERE name = 'Emergency Department';
UPDATE departments SET floor = 'Ground Floor' WHERE name = 'Patient Registration';
UPDATE departments SET floor = '1st Floor' WHERE name = 'Pharmacy';
UPDATE departments SET floor = '1st Floor' WHERE name = 'Laboratory';
UPDATE departments SET floor = '2nd Floor' WHERE name = 'Radiology';
UPDATE departments SET floor = '3rd Floor' WHERE name = 'Cardiology';
UPDATE departments SET floor = '4th Floor' WHERE name = 'Surgery';
UPDATE departments SET floor = '5th Floor' WHERE name = 'Intensive Care Unit';
UPDATE departments SET floor = '6th Floor' WHERE name = 'Medical Records';
UPDATE departments SET floor = 'Ground Floor' WHERE name = 'Internal';

-- Now make floor NOT NULL (after data migration)
ALTER TABLE departments
ALTER COLUMN floor SET NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN departments.floor IS 'Physical floor location: Basement, Ground Floor, 1st-6th Floor';
