-- Migration 029: Add dashboard performance indexes
-- Purpose: Optimize dashboard queries for counts, pagination, and last comment retrieval

-- Index for efficient last comment queries
-- Supports DISTINCT ON queries to get most recent comment per ticket
CREATE INDEX IF NOT EXISTS idx_comments_ticket_created
ON comments(ticket_id, created_at DESC);

-- Indexes for count aggregations by status and priority
-- These speed up the GROUP BY queries for filter badge counts
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_priority ON tickets(priority);

-- Composite index for filtered pagination queries
-- Supports WHERE clauses with status/priority filters plus ORDER BY created_at
CREATE INDEX IF NOT EXISTS idx_tickets_status_created
ON tickets(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_tickets_priority_created
ON tickets(priority, created_at DESC);
