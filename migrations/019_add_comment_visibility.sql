-- Migration 019: Add visibility_type to comments table
-- Date: 2026-01-07 (Renumbered from 013 on 2026-01-09)
-- Description: Adds visibility_type column to support internal (admin-only) and public
--              (visible to all) comments. This enables admins to add internal notes that
--              department users cannot see, while public comments are visible to everyone.
--              Existing comments default to 'public' to maintain current behavior.

-- Add visibility_type column with default 'public' (NOT NULL for data integrity)
ALTER TABLE comments ADD COLUMN visibility_type VARCHAR(20) DEFAULT 'public' NOT NULL;

-- Add CHECK constraint to enforce valid values
ALTER TABLE comments ADD CONSTRAINT comments_visibility_type_check
  CHECK (visibility_type IN ('public', 'internal'));

-- Create composite index for improved query performance when filtering by ticket and visibility
CREATE INDEX idx_comments_visibility ON comments(ticket_id, visibility_type);

-- Add comment for documentation
COMMENT ON COLUMN comments.visibility_type IS 'Comment visibility: public (visible to all users including departments), internal (visible only to admins and super_admins)';

-- Verify all existing comments have 'public' visibility (informational)
DO $$
DECLARE
  total_comments INTEGER;
  public_comments INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_comments FROM comments;
  SELECT COUNT(*) INTO public_comments FROM comments WHERE visibility_type = 'public';

  RAISE NOTICE 'Comment visibility migration complete:';
  RAISE NOTICE '  - Total comments: %', total_comments;
  RAISE NOTICE '  - Public comments: %', public_comments;
  RAISE NOTICE '  - All existing comments set to public: %', (total_comments = public_comments);
END $$;
