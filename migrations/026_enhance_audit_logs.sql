-- Migration 026: Enhance Audit Logs for Dashboard
-- Description: Adds denormalized columns for fast display, search, and session tracking
-- Created: 2026-02-26
-- Impact: Enables audit log dashboard without JOINs; all columns nullable for backward compatibility
-- Risk Level: LOW - Only adds nullable columns, no data changes, no locks on existing rows

-- Denormalized actor info (snapshot at event time, survives user deletion/rename)
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS actor_username VARCHAR(50);
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS actor_role VARCHAR(20);

-- Structured classification for filtering
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS action_category VARCHAR(30);
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS severity VARCHAR(20) DEFAULT 'info';

-- Optional human-readable target description
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS target_label VARCHAR(200);

-- Session tracking: SHA-256 hash of session ID (NOT raw session ID for security)
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS session_hash VARCHAR(16);

-- Pre-computed searchable text for fast ILIKE with trigram index
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS search_text TEXT;

-- Migration verification
DO $$
BEGIN
  -- Verify actor_username column exists
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'audit_logs'
    AND column_name = 'actor_username'
  ) THEN
    RAISE EXCEPTION 'Migration 026 failed: actor_username column was not created';
  END IF;

  -- Verify session_hash column exists
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'audit_logs'
    AND column_name = 'session_hash'
  ) THEN
    RAISE EXCEPTION 'Migration 026 failed: session_hash column was not created';
  END IF;

  -- Verify search_text column exists
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'audit_logs'
    AND column_name = 'search_text'
  ) THEN
    RAISE EXCEPTION 'Migration 026 failed: search_text column was not created';
  END IF;

  RAISE NOTICE 'Migration 026 completed successfully: Audit log columns enhanced';
END $$;
