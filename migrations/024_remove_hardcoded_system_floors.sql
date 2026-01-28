-- Migration 024: Remove hardcoded system floors (make floors fully dynamic)
-- Date: 2026-01-28
--
-- Description:
-- Removes the 8 system floors seeded by Migration 022 to make the floors system fully dynamic.
-- After this migration, floors are created entirely from JSON configuration files via the seeder.
--
-- This migration is safe and non-destructive:
-- - Only deletes system floors marked with is_system = true
-- - FK constraint prevents deletion if departments reference these floors
-- - New installations get an empty floors table
-- - Existing installations can upgrade gracefully
--
-- Impact:
-- - New installations: Floors table is empty after migrations, must be seeded via config
-- - Existing installations: May fail if departments reference system floors (safe FK protection)

-- Before deleting hardcoded system floors, reassign Internal department to a dynamic floor
-- This allows the FK constraint to be satisfied when we delete the hardcoded floors
-- Create a dynamic floor for the Internal system department if needed
INSERT INTO floors (name, sort_order, is_system, active) VALUES
  ('System', 0, false, true)
ON CONFLICT DO NOTHING;

-- Reassign Internal department from hardcoded floor to dynamic floor
UPDATE departments SET floor = 'System' WHERE name = 'Internal' AND floor IN (
  'Basement',
  'Ground Floor',
  '1st Floor',
  '2nd Floor',
  '3rd Floor',
  '4th Floor',
  '5th Floor',
  '6th Floor'
);

-- Delete the 8 hardcoded system floors from Migration 022
-- Safety: FK constraint prevents deletion if any departments reference these floors
-- (Should be safe now since we reassigned Internal department above)
DELETE FROM floors
WHERE is_system = true
  AND name IN (
    'Basement',
    'Ground Floor',
    '1st Floor',
    '2nd Floor',
    '3rd Floor',
    '4th Floor',
    '5th Floor',
    '6th Floor'
  );

-- Migration Notes:
-- If this migration fails with a foreign key constraint violation on existing installations:
--   Option A: Set is_system=false on floors you want to keep (allows them to be customized)
--   Option B: Migrate departments to new custom floors, then re-run this migration
--   Option C: Skip this migration (keep system floors as-is)
--
-- To apply one of these options manually:
--   -- Option A: Convert system floors to admin-managed floors
--   UPDATE floors SET is_system = false WHERE name IN ('Basement', 'Ground Floor', ...);
--
--   -- Option B: Create new custom floor and migrate departments
--   INSERT INTO floors (name, sort_order, is_system, active) VALUES ('My Floor', 0, false, true);
--   UPDATE departments SET floor = 'My Floor' WHERE floor IN ('Basement', ...);
