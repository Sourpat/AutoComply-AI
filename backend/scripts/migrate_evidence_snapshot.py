"""
Migration: Add evidence snapshot fields to intelligence_history (Phase 7.24).

Adds:
- evidence_snapshot: JSON snapshot of evidence used for computation
- evidence_hash: SHA256 hash of normalized evidence_snapshot
- evidence_version: Optional version string for evidence schema

This makes each intelligence run fully reproducible by storing the exact
evidence state at computation time.

Run:
    cd backend
    .venv/Scripts/python scripts/migrate_evidence_snapshot.py
"""

import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from src.core.db import execute_sql, execute_update


def migrate():
    """Add evidence snapshot fields to intelligence_history table."""
    
    print("[Migrate] Adding evidence snapshot fields to intelligence_history...")
    
    # Check if columns already exist
    result = execute_sql("PRAGMA table_info(intelligence_history)")
    existing_columns = {row['name'] for row in result}
    
    # Add evidence_snapshot column (JSON snapshot of evidence)
    if 'evidence_snapshot' not in existing_columns:
        print("[Migrate] Adding evidence_snapshot column...")
        execute_update("""
            ALTER TABLE intelligence_history 
            ADD COLUMN evidence_snapshot TEXT;
        """)
        print("[Migrate] ✅ evidence_snapshot column added")
    else:
        print("[Migrate] ⚠️  evidence_snapshot column already exists, skipping")
    
    # Add evidence_hash column (SHA256 of normalized evidence)
    if 'evidence_hash' not in existing_columns:
        print("[Migrate] Adding evidence_hash column...")
        execute_update("""
            ALTER TABLE intelligence_history 
            ADD COLUMN evidence_hash TEXT;
        """)
        print("[Migrate] ✅ evidence_hash column added")
    else:
        print("[Migrate] ⚠️  evidence_hash column already exists, skipping")
    
    # Add evidence_version column (optional schema version)
    if 'evidence_version' not in existing_columns:
        print("[Migrate] Adding evidence_version column...")
        execute_update("""
            ALTER TABLE intelligence_history 
            ADD COLUMN evidence_version TEXT;
        """)
        print("[Migrate] ✅ evidence_version column added")
    else:
        print("[Migrate] ⚠️  evidence_version column already exists, skipping")
    
    # Create index on evidence_hash for duplicate detection
    print("[Migrate] Creating index on evidence_hash...")
    execute_update("""
        CREATE INDEX IF NOT EXISTS idx_intelligence_history_evidence_hash
        ON intelligence_history(case_id, evidence_hash);
    """)
    print("[Migrate] ✅ Index created on evidence_hash")
    
    # Verify columns exist
    result = execute_sql("PRAGMA table_info(intelligence_history)")
    current_columns = {row['name'] for row in result}
    
    required_columns = {'evidence_snapshot', 'evidence_hash', 'evidence_version'}
    if required_columns.issubset(current_columns):
        print("[Migrate] ✅ Verification: All evidence fields exist")
        print(f"[Migrate] ✅ Current columns: {sorted(current_columns)}")
    else:
        missing = required_columns - current_columns
        print(f"[Migrate] ❌ ERROR: Missing columns: {missing}")
        sys.exit(1)
    
    print("[Migrate] ✅ Migration complete")
    print("[Migrate] ℹ️  Evidence snapshots will be populated on next intelligence computation")


if __name__ == "__main__":
    migrate()
