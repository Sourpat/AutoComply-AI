-- ============================================================================
-- Workflow Schema v2 - Phase 2 Extensions
-- Case Lifecycle Management: Notes, Events, and Decisions
-- ============================================================================
--
-- Extends Phase 1 schema with:
-- - case_notes: Internal notes with author tracking
-- - case_events: Enhanced event log for lifecycle actions
-- - case_decisions: Approval/rejection decisions with reasons
--
-- Idempotent: Safe to run multiple times (CREATE TABLE IF NOT EXISTS)
-- ============================================================================

-- ============================================================================
-- Case Notes Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS case_notes (
    -- Primary key
    id TEXT PRIMARY KEY NOT NULL,
    
    -- Foreign key
    case_id TEXT NOT NULL,
    
    -- Timestamps
    created_at TEXT NOT NULL,  -- ISO 8601 format
    
    -- Author tracking
    author_role TEXT NOT NULL,  -- admin, reviewer, system
    author_name TEXT,           -- User name (nullable for system notes)
    
    -- Note content
    note_text TEXT NOT NULL,
    
    -- Metadata
    metadata TEXT DEFAULT '{}',  -- JSON blob for additional context
    
    FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE
);

-- Indexes for note queries
CREATE INDEX IF NOT EXISTS idx_notes_case_id ON case_notes(case_id);
CREATE INDEX IF NOT EXISTS idx_notes_created_at ON case_notes(created_at);
CREATE INDEX IF NOT EXISTS idx_notes_author_role ON case_notes(author_role);


-- ============================================================================
-- Case Events Table
-- ============================================================================
-- Enhanced event log for Phase 2 lifecycle actions
-- Complements audit_events table with richer structured data
-- ============================================================================

CREATE TABLE IF NOT EXISTS case_events (
    -- Primary key
    id TEXT PRIMARY KEY NOT NULL,
    
    -- Foreign key
    case_id TEXT NOT NULL,
    
    -- Timestamps
    created_at TEXT NOT NULL,  -- ISO 8601 format
    
    -- Event details
    event_type TEXT NOT NULL,  -- status_changed, note_added, decision_made, assigned, etc.
    event_payload_json TEXT DEFAULT '{}',  -- Structured event data (old/new status, decision details, etc.)
    
    -- Actor tracking
    actor_role TEXT,           -- admin, reviewer, submitter, system
    actor_name TEXT,           -- User name or "System"
    
    FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE
);

-- Indexes for event queries
CREATE INDEX IF NOT EXISTS idx_events_case_id ON case_events(case_id);
CREATE INDEX IF NOT EXISTS idx_events_created_at ON case_events(created_at);
CREATE INDEX IF NOT EXISTS idx_events_event_type ON case_events(event_type);


-- ============================================================================
-- Case Decisions Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS case_decisions (
    -- Primary key
    id TEXT PRIMARY KEY NOT NULL,
    
    -- Foreign key
    case_id TEXT NOT NULL,
    
    -- Timestamps
    created_at TEXT NOT NULL,  -- ISO 8601 format
    
    -- Decision details
    decision TEXT NOT NULL,  -- APPROVED or REJECTED
    reason TEXT,             -- Brief reason/summary
    details_json TEXT DEFAULT '{}',  -- Structured details (conditions, notes, evidence references, etc.)
    
    -- Actor tracking
    decided_by_role TEXT,    -- admin, reviewer
    decided_by_name TEXT,    -- User name
    
    FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE
);

-- Indexes for decision queries
CREATE INDEX IF NOT EXISTS idx_decisions_case_id ON case_decisions(case_id);
CREATE INDEX IF NOT EXISTS idx_decisions_created_at ON case_decisions(created_at);
CREATE INDEX IF NOT EXISTS idx_decisions_decision ON case_decisions(decision);


-- ============================================================================
-- Schema Version Update
-- ============================================================================

INSERT OR IGNORE INTO schema_version (version, applied_at, description)
VALUES (2, datetime('now'), 'Phase 2: Case lifecycle - notes, events, and decisions');
