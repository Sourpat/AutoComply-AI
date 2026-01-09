-- ============================================================================
-- Workflow Schema v1
-- Step 2.10: SQLite Persistence
-- ============================================================================
--
-- Tables for case management, evidence tracking, and audit trail.
--
-- Features:
-- - cases: Work queue items with status, assignment, SLA
-- - evidence_items: RAG evidence linked to cases
-- - case_packet: Many-to-many mapping for packet curation
-- - audit_events: Complete audit timeline
--
-- Idempotent: Safe to run multiple times (CREATE TABLE IF NOT EXISTS)
-- ============================================================================

-- ============================================================================
-- Cases Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS cases (
    -- Primary key
    id TEXT PRIMARY KEY NOT NULL,
    
    -- Timestamps
    created_at TEXT NOT NULL,  -- ISO 8601 format
    updated_at TEXT NOT NULL,  -- ISO 8601 format
    
    -- Core fields
    decision_type TEXT NOT NULL,  -- e.g., "csf_practitioner", "ohio_tddd"
    submission_id TEXT,           -- Foreign key to submissions.id
    title TEXT NOT NULL,
    summary TEXT,
    
    -- Workflow state
    status TEXT NOT NULL DEFAULT 'new',  -- new, in_review, needs_info, approved, blocked, closed
    priority TEXT NOT NULL DEFAULT 'normal',  -- low, normal, high, urgent
    
    -- Assignment
    assigned_to TEXT,            -- User ID or email
    assigned_at TEXT,            -- ISO 8601 timestamp
    
    -- SLA tracking
    sla_hours INTEGER,           -- SLA deadline in hours
    due_at TEXT,                 -- ISO 8601 deadline
    
    -- Metadata (JSON blob)
    metadata TEXT DEFAULT '{}',  -- Additional context, tags, etc.
    
    -- Evidence tracking
    evidence_count INTEGER DEFAULT 0,
    packet_evidence_ids TEXT DEFAULT '[]',  -- JSON array of evidence IDs in packet
    
    -- Trace ID for debugging
    trace_id TEXT,
    
    -- Normalized searchable text (populated from title, summary, decision_type, assigned_to, and submission fields)
    searchable_text TEXT
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_cases_status ON cases(status);
CREATE INDEX IF NOT EXISTS idx_cases_assigned_to ON cases(assigned_to);
CREATE INDEX IF NOT EXISTS idx_cases_decision_type ON cases(decision_type);
CREATE INDEX IF NOT EXISTS idx_cases_created_at ON cases(created_at);
CREATE INDEX IF NOT EXISTS idx_cases_submission_id ON cases(submission_id);
CREATE INDEX IF NOT EXISTS idx_cases_due_at ON cases(due_at);
CREATE INDEX IF NOT EXISTS idx_cases_searchable_text ON cases(searchable_text);

-- ============================================================================
-- Evidence Items Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS evidence_items (
    -- Primary key
    id TEXT PRIMARY KEY NOT NULL,
    
    -- Foreign key
    case_id TEXT NOT NULL,
    
    -- Timestamps
    created_at TEXT NOT NULL,  -- ISO 8601 format
    
    -- Evidence content
    title TEXT NOT NULL,
    snippet TEXT NOT NULL,
    citation TEXT,
    source_id TEXT,            -- RAG document ID
    
    -- Classification
    tags TEXT DEFAULT '[]',    -- JSON array of tags
    
    -- Metadata (JSON blob)
    metadata TEXT DEFAULT '{}',  -- Confidence scores, page numbers, etc.
    
    -- Packet inclusion
    included_in_packet INTEGER DEFAULT 1,  -- 0 = false, 1 = true
    
    FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE
);

-- Indexes for evidence queries
CREATE INDEX IF NOT EXISTS idx_evidence_case_id ON evidence_items(case_id);
CREATE INDEX IF NOT EXISTS idx_evidence_created_at ON evidence_items(created_at);
CREATE INDEX IF NOT EXISTS idx_evidence_included_in_packet ON evidence_items(included_in_packet);

-- ============================================================================
-- Case Packet (Many-to-Many)
-- ============================================================================

CREATE TABLE IF NOT EXISTS case_packet (
    -- Composite key
    case_id TEXT NOT NULL,
    evidence_id TEXT NOT NULL,
    
    -- Metadata
    added_at TEXT NOT NULL,    -- ISO 8601 timestamp
    added_by TEXT,             -- User who added to packet
    
    PRIMARY KEY (case_id, evidence_id),
    FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE,
    FOREIGN KEY (evidence_id) REFERENCES evidence_items(id) ON DELETE CASCADE
);

-- Indexes for packet queries
CREATE INDEX IF NOT EXISTS idx_packet_case_id ON case_packet(case_id);
CREATE INDEX IF NOT EXISTS idx_packet_evidence_id ON case_packet(evidence_id);

-- ============================================================================
-- Audit Events Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS audit_events (
    -- Primary key
    id TEXT PRIMARY KEY NOT NULL,
    
    -- Foreign key
    case_id TEXT NOT NULL,
    
    -- Timestamps
    created_at TEXT NOT NULL,  -- ISO 8601 format
    
    -- Event details
    event_type TEXT NOT NULL,  -- submission_received, case_created, status_changed, etc.
    actor_role TEXT,           -- admin, reviewer, submitter, system
    actor_name TEXT,           -- User name or "System"
    message TEXT NOT NULL,     -- Human-readable description
    
    -- Related entities
    submission_id TEXT,        -- Optional link to submission
    
    -- Metadata (JSON blob)
    meta TEXT DEFAULT '{}',    -- Additional context, old/new values, etc.
    
    FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE
);

-- Indexes for audit queries
CREATE INDEX IF NOT EXISTS idx_audit_case_id ON audit_events(case_id);
CREATE INDEX IF NOT EXISTS idx_audit_created_at ON audit_events(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_event_type ON audit_events(event_type);
CREATE INDEX IF NOT EXISTS idx_audit_submission_id ON audit_events(submission_id);

-- ============================================================================
-- Schema Version Tracking
-- ============================================================================

CREATE TABLE IF NOT EXISTS schema_version (
    version INTEGER PRIMARY KEY,
    applied_at TEXT NOT NULL,  -- ISO 8601 timestamp
    description TEXT
);

-- Insert initial version
INSERT OR IGNORE INTO schema_version (version, applied_at, description)
VALUES (1, datetime('now'), 'Initial workflow schema: cases, evidence, audit events');
