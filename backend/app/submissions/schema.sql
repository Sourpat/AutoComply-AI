-- ============================================================================
-- Submissions Schema v1
-- Step 2.10: SQLite Persistence
-- ============================================================================
--
-- Tables for submission persistence and querying.
--
-- Features:
-- - submissions: Form submission data with metadata
-- - Full-text search support (future enhancement)
-- - Indexes for common query patterns
--
-- Idempotent: Safe to run multiple times (CREATE TABLE IF NOT EXISTS)
-- ============================================================================

-- ============================================================================
-- Submissions Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS submissions (
    -- Primary key
    id TEXT PRIMARY KEY NOT NULL,
    
    -- Timestamps
    created_at TEXT NOT NULL,  -- ISO 8601 format
    
    -- Classification
    decision_type TEXT NOT NULL,  -- e.g., "csf_practitioner", "ohio_tddd"
    
    -- User context
    submitted_by TEXT,           -- User ID, email, or name
    account_id TEXT,             -- Account/tenant ID for multi-tenancy
    location_id TEXT,            -- Location/facility ID
    
    -- Form data (JSON blob)
    form_data TEXT NOT NULL DEFAULT '{}',  -- Form field key-value pairs
    
    -- Raw payload (JSON blob)
    raw_payload TEXT,            -- Original request payload for debugging
    
    -- AI/Evaluator output (JSON blob)
    evaluator_output TEXT,       -- Decision status, risk level, trace ID, explanation
    
    -- Status tracking
    status TEXT DEFAULT 'pending',  -- pending, processed, failed
    
    -- Error handling
    error_message TEXT           -- Error details if processing failed
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_submissions_created_at ON submissions(created_at);
CREATE INDEX IF NOT EXISTS idx_submissions_decision_type ON submissions(decision_type);
CREATE INDEX IF NOT EXISTS idx_submissions_submitted_by ON submissions(submitted_by);
CREATE INDEX IF NOT EXISTS idx_submissions_account_id ON submissions(account_id);
CREATE INDEX IF NOT EXISTS idx_submissions_location_id ON submissions(location_id);
CREATE INDEX IF NOT EXISTS idx_submissions_status ON submissions(status);

-- ============================================================================
-- Schema Version Tracking
-- ============================================================================

CREATE TABLE IF NOT EXISTS schema_version_submissions (
    version INTEGER PRIMARY KEY,
    applied_at TEXT NOT NULL,  -- ISO 8601 timestamp
    description TEXT
);

-- Insert initial version
INSERT OR IGNORE INTO schema_version_submissions (version, applied_at, description)
VALUES (1, datetime('now'), 'Initial submissions schema');
