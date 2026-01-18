"""
Migration: Add intelligence_history table for tracking intelligence changes (Phase 7.11).

This table stores a snapshot of each intelligence computation, enabling:
- Historical tracking of confidence changes
- Diff computation ("what changed")
- Audit trail for intelligence evolution

Run:
    cd backend
    .venv/Scripts/python scripts/migrate_add_intelligence_history.py
"""

import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from src.core.db import execute_sql, execute_update


def migrate():
    """Add intelligence_history table to track intelligence snapshots."""
    
    print("[Migrate] Creating intelligence_history table...")
    
    # Create intelligence_history table
    execute_update("""
        CREATE TABLE IF NOT EXISTS intelligence_history (
            -- Primary key
            id TEXT PRIMARY KEY NOT NULL,
            
            -- Foreign key to case
            case_id TEXT NOT NULL,
            
            -- Timestamp when this intelligence was computed
            computed_at TEXT NOT NULL,  -- ISO 8601 format (UTC)
            
            -- Full snapshot of intelligence response
            payload_json TEXT NOT NULL,  -- JSON serialization of DecisionIntelligenceResponse
            
            -- Metadata
            created_at TEXT NOT NULL,    -- When this history entry was created
            actor TEXT,                  -- Who/what triggered the recompute
            reason TEXT,                 -- Why the recompute happened
            
            FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE
        );
    """)
    
    # Create indexes for efficient querying
    execute_update("""
        CREATE INDEX IF NOT EXISTS idx_intelligence_history_case_id 
        ON intelligence_history(case_id, computed_at DESC);
    """)
    
    execute_update("""
        CREATE INDEX IF NOT EXISTS idx_intelligence_history_created_at
        ON intelligence_history(created_at DESC);
    """)
    
    print("[Migrate] ✅ intelligence_history table created successfully")
    print("[Migrate] ✅ Indexes created for efficient querying")
    
    # Check table exists
    result = execute_sql("SELECT name FROM sqlite_master WHERE type='table' AND name='intelligence_history'")
    if result:
        print("[Migrate] ✅ Verification: intelligence_history table exists")
    else:
        print("[Migrate] ❌ ERROR: Table creation failed")
        sys.exit(1)


if __name__ == "__main__":
    migrate()
