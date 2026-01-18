"""
Migration: Add case_requests table

Adds the case_requests table for Phase 4.1 Request Info loop.
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.core.db import execute_update

def migrate():
    """Add case_requests table and indexes."""
    
    print("Creating case_requests table...")
    execute_update("""
        CREATE TABLE IF NOT EXISTS case_requests (
            id TEXT PRIMARY KEY NOT NULL,
            case_id TEXT NOT NULL,
            created_at TEXT NOT NULL,
            resolved_at TEXT,
            status TEXT NOT NULL DEFAULT 'open',
            requested_by TEXT,
            message TEXT NOT NULL,
            required_fields_json TEXT,
            FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE
        )
    """, {})
    
    print("Creating indexes...")
    execute_update("CREATE INDEX IF NOT EXISTS idx_case_requests_case_id ON case_requests(case_id)", {})
    execute_update("CREATE INDEX IF NOT EXISTS idx_case_requests_status ON case_requests(status)", {})
    execute_update("CREATE INDEX IF NOT EXISTS idx_case_requests_case_id_status ON case_requests(case_id, status)", {})
    
    print("✅ Migration complete!")

if __name__ == "__main__":
    migrate()
