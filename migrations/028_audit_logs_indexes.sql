-- Migration 028: Add Indexes and Immutability Trigger for Audit Logs
-- Description: Creates performance indexes (CONCURRENTLY safe) and tamper-prevention trigger
-- Created: 2026-02-26
-- Impact: Enables fast keyset pagination, filtering, and search; prevents audit log tampering
-- Risk Level: LOW - Read-only optimization + append-only enforcement
-- Note: CREATE INDEX CONCURRENTLY requires NOT being inside a transaction.
--        The migration runner (init-db.js) executes via pool.query() without explicit transactions,
--        so CONCURRENTLY is safe here.

-- Enable pg_trgm extension for trigram-based text search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Keyset pagination index: primary access pattern for Log Explorer
-- Supports ORDER BY created_at DESC, id DESC with cursor (created_at, id) < ($1, $2)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_created_id
ON audit_logs(created_at DESC, id DESC);

-- Actor timeline index: user-specific queries sorted by time
-- Replaces the existing idx_audit_logs_actor which lacks time ordering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_actor_created
ON audit_logs(actor_id, created_at DESC);

-- Session grouping index: for future Session Reconstructor feature
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_session
ON audit_logs(session_hash, created_at ASC);

-- Category + severity filter index: dashboard structured filtering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_category_severity
ON audit_logs(action_category, severity, created_at DESC);

-- Trigram GIN index on search_text: fast ILIKE pattern matching
-- Enables sub-10ms search even at millions of rows
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_search_trgm
ON audit_logs USING GIN (search_text gin_trgm_ops);

-- Audit log immutability trigger: prevent UPDATE and DELETE
-- Audit logs are append-only records for compliance and security
CREATE OR REPLACE FUNCTION prevent_audit_modification()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Audit logs are immutable and cannot be modified or deleted';
END;
$$ LANGUAGE plpgsql;

-- Only create trigger if it doesn't already exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'audit_log_immutable'
    AND tgrelid = 'audit_logs'::regclass
  ) THEN
    CREATE TRIGGER audit_log_immutable
      BEFORE UPDATE OR DELETE ON audit_logs
      FOR EACH ROW EXECUTE FUNCTION prevent_audit_modification();

    RAISE NOTICE 'Immutability trigger created on audit_logs';
  ELSE
    RAISE NOTICE 'Immutability trigger already exists on audit_logs';
  END IF;
END $$;

-- Migration verification
DO $$
BEGIN
  -- Verify keyset pagination index
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'audit_logs'
    AND indexname = 'idx_audit_created_id'
  ) THEN
    RAISE EXCEPTION 'Migration 028 failed: idx_audit_created_id was not created';
  END IF;

  -- Verify trigram index
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'audit_logs'
    AND indexname = 'idx_audit_search_trgm'
  ) THEN
    RAISE EXCEPTION 'Migration 028 failed: idx_audit_search_trgm was not created';
  END IF;

  -- Verify immutability trigger
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'audit_log_immutable'
  ) THEN
    RAISE EXCEPTION 'Migration 028 failed: audit_log_immutable trigger was not created';
  END IF;

  RAISE NOTICE 'Migration 028 completed successfully: Indexes and immutability trigger created';
END $$;
