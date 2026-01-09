-- Scheduled Exports Schema
-- Stores recurring export jobs for cases and saved views

CREATE TABLE IF NOT EXISTS scheduled_exports (
    id TEXT PRIMARY KEY,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    name TEXT NOT NULL,
    schedule TEXT NOT NULL,  -- "DAILY" or "WEEKLY"
    hour INTEGER NOT NULL CHECK (hour >= 0 AND hour <= 23),
    minute INTEGER NOT NULL CHECK (minute >= 0 AND minute <= 59),
    timezone TEXT NOT NULL DEFAULT 'UTC',
    mode TEXT NOT NULL CHECK (mode IN ('case', 'saved_view')),
    target_id TEXT NOT NULL,  -- caseId or viewId
    export_type TEXT NOT NULL CHECK (export_type IN ('pdf', 'json', 'both')),
    is_enabled INTEGER NOT NULL DEFAULT 1,
    last_run_at TEXT,
    next_run_at TEXT,
    owner TEXT
);

-- Index for scheduled jobs queries
CREATE INDEX IF NOT EXISTS idx_scheduled_exports_next_run 
ON scheduled_exports(next_run_at, is_enabled);

-- Index for owner filtering
CREATE INDEX IF NOT EXISTS idx_scheduled_exports_owner 
ON scheduled_exports(owner);

-- Index for target lookups
CREATE INDEX IF NOT EXISTS idx_scheduled_exports_target 
ON scheduled_exports(mode, target_id);
