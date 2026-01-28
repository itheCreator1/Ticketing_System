-- Migration 022: Create floors table for database-driven floor management
-- This replaces hardcoded floor constants with a database table
-- Initial 8 floors are marked as system floors to prevent accidental deletion

CREATE TABLE floors (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_system BOOLEAN NOT NULL DEFAULT false,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for common queries
CREATE INDEX idx_floors_active ON floors(active);
CREATE INDEX idx_floors_sort_order ON floors(sort_order);

-- Seed initial 8 hospital floors (marked as system to prevent deletion)
INSERT INTO floors (name, sort_order, is_system, active) VALUES
  ('Basement', 0, true, true),
  ('Ground Floor', 1, true, true),
  ('1st Floor', 2, true, true),
  ('2nd Floor', 3, true, true),
  ('3rd Floor', 4, true, true),
  ('4th Floor', 5, true, true),
  ('5th Floor', 6, true, true),
  ('6th Floor', 7, true, true);
