-- Migration 013: Add department column to users table
-- Date: 2026-01-08
-- Description: Adds department field to users table to track which department
--              a department-role user belongs to. This eliminates the need for
--              department users to select their department when creating tickets.

-- Add department column (nullable, only required for role='department')
ALTER TABLE users ADD COLUMN department VARCHAR(100);

-- Add CHECK constraint to enforce valid department values
ALTER TABLE users ADD CONSTRAINT users_department_check
  CHECK (department IS NULL OR department IN (
    'IT Support',
    'General Support',
    'Human Resources',
    'Finance',
    'Facilities'
  ));

-- Note: We do NOT add a constraint requiring department for role='department' here
-- because existing department users may have NULL department initially.
-- The application layer (userService.js) will enforce this requirement for new users.
-- Admins must update existing department users to set their department before they can create tickets.

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_users_department ON users(department) WHERE department IS NOT NULL;

-- Add column comment
COMMENT ON COLUMN users.department IS 'Department affiliation (required for role=department, null for admin/super_admin). Values: IT Support, General Support, Human Resources, Finance, Facilities';
