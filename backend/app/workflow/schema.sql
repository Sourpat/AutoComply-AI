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
    resolved_at TEXT,           -- ISO 8601 format (UTC), set when approved/rejected
    
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
    submission_id TEXT,
    
    -- Timestamps
    created_at TEXT NOT NULL,  -- ISO 8601 format
    
    -- Evidence content
    title TEXT NOT NULL,
    snippet TEXT NOT NULL,
    citation TEXT,
    source_id TEXT,            -- RAG document ID
    filename TEXT,
    content_type TEXT,
    size_bytes INTEGER,
    storage_path TEXT,
    sha256 TEXT,
    uploaded_by TEXT,
    
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
CREATE INDEX IF NOT EXISTS idx_evidence_case_created ON evidence_items(case_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_evidence_submission_created ON evidence_items(submission_id, created_at DESC);

-- ============================================================================
-- Attachments Table (Phase 6.1)
-- ============================================================================

CREATE TABLE IF NOT EXISTS attachments (
    id TEXT PRIMARY KEY NOT NULL,
    case_id TEXT NOT NULL,
    submission_id TEXT,
    filename TEXT NOT NULL,
    content_type TEXT NOT NULL,
    size_bytes INTEGER NOT NULL,
    storage_path TEXT NOT NULL,
    uploaded_by TEXT,
    description TEXT,
    is_deleted INTEGER DEFAULT 0,
    deleted_at TEXT,
    deleted_by TEXT,
    delete_reason TEXT,
    is_redacted INTEGER DEFAULT 0,
    redacted_at TEXT,
    redacted_by TEXT,
    redact_reason TEXT,
    original_sha256 TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_attachments_case_id ON attachments(case_id);
CREATE INDEX IF NOT EXISTS idx_attachments_created_at ON attachments(created_at);

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
-- Case Notes Table (Phase 2)
-- ============================================================================

CREATE TABLE IF NOT EXISTS case_notes (
    id TEXT PRIMARY KEY NOT NULL,
    case_id TEXT NOT NULL,
    created_at TEXT NOT NULL, -- ISO 8601 format
    author_role TEXT NOT NULL,
    author_name TEXT,
    note_text TEXT NOT NULL,
    metadata TEXT DEFAULT '{}',
    FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_case_notes_case_id ON case_notes(case_id);
CREATE INDEX IF NOT EXISTS idx_case_notes_created_at ON case_notes(created_at);

-- ============================================================================
-- Case Decisions Table (Phase 2)
-- ============================================================================

CREATE TABLE IF NOT EXISTS case_decisions (
    id TEXT PRIMARY KEY NOT NULL,
    case_id TEXT NOT NULL,
    created_at TEXT NOT NULL, -- ISO 8601 format
    decision TEXT NOT NULL, -- APPROVED or REJECTED
    reason TEXT,
    details_json TEXT DEFAULT '{}',
    decided_by_role TEXT,
    decided_by_name TEXT,
    FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_case_decisions_case_id ON case_decisions(case_id);
CREATE INDEX IF NOT EXISTS idx_case_decisions_created_at ON case_decisions(created_at);

-- ============================================================================
-- Case Events Table (Phase 3.1: Verifier Actions Timeline)
-- ============================================================================

CREATE TABLE IF NOT EXISTS case_events (
    -- Primary key
    id TEXT PRIMARY KEY NOT NULL,
    
    -- Foreign key
    case_id TEXT NOT NULL,
    
    -- Timestamps
    created_at TEXT NOT NULL,  -- ISO 8601 format (UTC)
    
    -- Event details
    event_type TEXT NOT NULL,  -- case_created, assigned, unassigned, status_changed, note_added, etc.
    actor_role TEXT NOT NULL,  -- verifier, submitter, system
    actor_id TEXT,             -- User ID or email (null for system events)
    message TEXT,              -- Human-readable description (optional)
    
    -- Metadata (JSON blob)
    payload_json TEXT,         -- Additional context: {from, to, assignee, etc.}
    
    FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE
);

-- Indexes for case events queries (newest first is most common)
CREATE INDEX IF NOT EXISTS idx_case_events_case_id_created_at ON case_events(case_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_case_events_event_type ON case_events(event_type);
CREATE INDEX IF NOT EXISTS idx_case_events_actor_role ON case_events(actor_role);

-- ============================================================================
-- Case Requests Table (Phase 4.1: Request Info Loop)
-- ============================================================================

CREATE TABLE IF NOT EXISTS case_requests (
    -- Primary key
    id TEXT PRIMARY KEY NOT NULL,
    
    -- Foreign key
    case_id TEXT NOT NULL,
    
    -- Timestamps
    created_at TEXT NOT NULL,   -- ISO 8601 format (UTC)
    resolved_at TEXT,           -- ISO 8601 format (UTC), null if open
    
    -- Request status
    status TEXT NOT NULL DEFAULT 'open',  -- 'open' or 'resolved'
    
    -- Request details
    requested_by TEXT,          -- Verifier email/ID who requested
    message TEXT NOT NULL,      -- Request message to submitter
    required_fields_json TEXT,  -- JSON array of required field names (optional)
    
    FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE
);

-- Indexes for case requests queries
CREATE INDEX IF NOT EXISTS idx_case_requests_case_id ON case_requests(case_id);
CREATE INDEX IF NOT EXISTS idx_case_requests_status ON case_requests(status);
CREATE INDEX IF NOT EXISTS idx_case_requests_case_id_status ON case_requests(case_id, status);

-- ============================================================================
-- Signals Table (Phase 7.1: Signal Intelligence)
-- ============================================================================

CREATE TABLE IF NOT EXISTS signals (
    -- Primary key
    id TEXT PRIMARY KEY NOT NULL,
    
    -- Foreign key
    case_id TEXT NOT NULL,
    
    -- Signal details
    decision_type TEXT NOT NULL,
    source_type TEXT NOT NULL,  -- submission, evidence, rag_trace, case_event
    timestamp TEXT NOT NULL,    -- ISO 8601 format (UTC)
    
    -- Signal metrics
    signal_strength REAL DEFAULT 1.0,
    completeness_flag INTEGER DEFAULT 0,  -- 0 = incomplete, 1 = complete
    
    -- Metadata (JSON blob)
    metadata_json TEXT DEFAULT '{}',
    
    -- Timestamps
    created_at TEXT NOT NULL,   -- ISO 8601 format (UTC)
    
    FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE
);

-- Indexes for signals queries
CREATE INDEX IF NOT EXISTS idx_signals_case_id ON signals(case_id);
CREATE INDEX IF NOT EXISTS idx_signals_case_id_timestamp ON signals(case_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_signals_source_type ON signals(source_type);
CREATE INDEX IF NOT EXISTS idx_signals_decision_type ON signals(decision_type);

-- ============================================================================
-- Decision Intelligence Table (Phase 7.1: Signal Intelligence)
-- ============================================================================

CREATE TABLE IF NOT EXISTS decision_intelligence (
    -- Primary key
    case_id TEXT PRIMARY KEY NOT NULL,
    
    -- Computation timestamp
    computed_at TEXT NOT NULL,  -- ISO 8601 format (UTC)
    updated_at TEXT NOT NULL,   -- ISO 8601 format (UTC)
    
    -- Completeness metrics
    completeness_score INTEGER NOT NULL,  -- 0-100
    gap_json TEXT DEFAULT '[]',           -- JSON array of gaps
    
    -- Bias detection
    bias_json TEXT DEFAULT '[]',          -- JSON array of bias flags
    
    -- Confidence metrics
    confidence_score INTEGER NOT NULL,    -- 0-100
    confidence_band TEXT NOT NULL,        -- high, medium, low
    
    -- Narrative generation
    narrative_template TEXT NOT NULL,
    narrative_genai TEXT,                 -- Optional GenAI-generated narrative
    
    -- Phase 7.4: Freshness tracking
    stale_after_minutes INTEGER DEFAULT 30,  -- How long before intelligence is considered stale
    
    -- Phase 7.6: Executive summary (deterministic)
    executive_summary_json TEXT,         -- JSON object with headline, what_we_know, risks, next_actions, badges
    
    FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE
);

-- Index for decision intelligence queries
CREATE INDEX IF NOT EXISTS idx_decision_intelligence_computed_at ON decision_intelligence(computed_at DESC);
CREATE INDEX IF NOT EXISTS idx_decision_intelligence_confidence_band ON decision_intelligence(confidence_band);

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
