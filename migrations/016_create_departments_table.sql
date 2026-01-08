-- Migration: 016_create_departments_table.sql
-- Description: Transform departments from hardcoded constants to database-driven system
-- Adds departments table, migrates CHECK constraints to foreign keys with CASCADE/RESTRICT

-- Create departments table
CREATE TABLE IF NOT EXISTS departments (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  is_system BOOLEAN NOT NULL DEFAULT false,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Add index on active status for efficient filtering
CREATE INDEX IF NOT EXISTS idx_departments_active ON departments(active);

-- Seed initial departments (migration from hardcoded REPORTER_DEPARTMENT constant)
INSERT INTO departments (name, description, is_system, active) VALUES
  ('IT Support', 'Information Technology support and services', false, true),
  ('General Support', 'General administrative support', false, true),
  ('Human Resources', 'HR and employee services', false, true),
  ('Finance', 'Financial services and accounting', false, true),
  ('Facilities', 'Building maintenance and facilities management', false, true),
  ('Internal', 'System department for admin-only tickets', true, true)
ON CONFLICT (name) DO NOTHING;

-- Drop old CHECK constraints (replaced by foreign keys)
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_department_check;
ALTER TABLE tickets DROP CONSTRAINT IF EXISTS tickets_reporter_department_check;

-- Add foreign key constraint to users table
-- ON DELETE RESTRICT: Prevents deletion of departments with assigned users
-- ON UPDATE CASCADE: Automatically updates user.department when department.name changes
ALTER TABLE users ADD CONSTRAINT users_department_fk
  FOREIGN KEY (department) REFERENCES departments(name)
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Add foreign key constraint to tickets table
-- ON DELETE RESTRICT: Prevents deletion of departments with existing tickets
-- ON UPDATE CASCADE: Automatically updates ticket.reporter_department when department.name changes
ALTER TABLE tickets ADD CONSTRAINT tickets_reporter_department_fk
  FOREIGN KEY (reporter_department) REFERENCES departments(name)
  ON DELETE RESTRICT ON UPDATE CASCADE;
