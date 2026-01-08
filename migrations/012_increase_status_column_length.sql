-- Migration 012: Increase status column length to accommodate workflow statuses
-- Date: 2026-01-08
-- Description: Increases the status column from VARCHAR(20) to VARCHAR(30) to accommodate
--              the 'waiting_on_department' status which is 23 characters long.
--              This migration fixes the "value too long for type character varying(20)" error.

-- Increase status column length from VARCHAR(20) to VARCHAR(30)
ALTER TABLE tickets ALTER COLUMN status TYPE VARCHAR(30);

-- Add comment for documentation
COMMENT ON COLUMN tickets.status IS 'Ticket status: open (newly created), in_progress (being worked on), closed (resolved), waiting_on_admin (department waiting for admin response), waiting_on_department (admin waiting for department response). Max length: 30 characters.';
