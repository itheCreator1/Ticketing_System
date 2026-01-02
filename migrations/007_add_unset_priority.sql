-- Migration: Add 'unset' priority value
-- Purpose: Allow tickets to have an 'unset' priority state for untriaged submissions
-- Date: 2026-01-02

-- Step 1: Drop existing CHECK constraint
ALTER TABLE tickets
DROP CONSTRAINT tickets_priority_check;

-- Step 2: Add new CHECK constraint with 'unset' included
ALTER TABLE tickets
ADD CONSTRAINT tickets_priority_check
CHECK (priority IN ('unset', 'low', 'medium', 'high', 'critical'));

-- Step 3: Change default priority from 'medium' to 'unset'
ALTER TABLE tickets
ALTER COLUMN priority SET DEFAULT 'unset';
