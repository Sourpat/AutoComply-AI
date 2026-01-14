-- ============================================================================
-- Migration: Add Edit/Delete Support to Submissions
-- ============================================================================
-- Adds columns to support submission modification and soft deletion
-- 
-- New columns:
-- - updated_at: Track when submission was last modified
-- - is_deleted: Soft delete flag
-- - deleted_at: Timestamp of deletion
--
-- Idempotent: Safe to run multiple times
-- ============================================================================

-- Add updated_at column if it doesn't exist
-- SQLite doesn't support IF NOT EXISTS for ALTER COLUMN, so we check in Python
-- This is a no-op if column exists
ALTER TABLE submissions ADD COLUMN updated_at TEXT DEFAULT NULL;

-- Add is_deleted column for soft deletion
ALTER TABLE submissions ADD COLUMN is_deleted INTEGER DEFAULT 0 NOT NULL;

-- Add deleted_at timestamp
ALTER TABLE submissions ADD COLUMN deleted_at TEXT DEFAULT NULL;

-- Create index for filtering deleted submissions
CREATE INDEX IF NOT EXISTS idx_submissions_is_deleted ON submissions(is_deleted);

-- Create index for updated_at (for sorting modified submissions)
CREATE INDEX IF NOT EXISTS idx_submissions_updated_at ON submissions(updated_at);

-- ============================================================================
-- Notes:
-- ============================================================================
-- 1. updated_at will be NULL for submissions created before this migration
--    and will be set on first update
-- 2. is_deleted=0 means active, is_deleted=1 means soft deleted
-- 3. deleted_at will be NULL unless is_deleted=1
-- ============================================================================
