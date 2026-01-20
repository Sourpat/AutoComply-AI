"""
Migration: Add integrity fields to intelligence_history (Phase 7.20).

Adds:
- previous_run_id: Links to previous computation for audit chain
- triggered_by: Role/user who triggered recompute
- input_hash: Stable hash of normalized inputs for tamper detection

Run:
    cd backend
    .venv/Scripts/python scripts/migrate_intelligence_history_integrity.py
"""

import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from src.core.db import execute_sql, execute_update


def migrate():
    """Add integrity fields to intelligence_history table."""
    
    print("[Migrate] Adding integrity fields to intelligence_history...")
    
    # Check if columns already exist
    result = execute_sql("PRAGMA table_info(intelligence_history)")
    existing_columns = {row['name'] for row in result}
    
    # Add previous_run_id column (links to previous computation)
    if 'previous_run_id' not in existing_columns:
        print("[Migrate] Adding previous_run_id column...")
        execute_update("""
            ALTER TABLE intelligence_history 
            ADD COLUMN previous_run_id TEXT;
        """)
        print("[Migrate] ✅ previous_run_id column added")
    else:
        print("[Migrate] ⚠️  previous_run_id column already exists, skipping")
    
    # Add triggered_by column (role/user who triggered recompute)
    if 'triggered_by' not in existing_columns:
        print("[Migrate] Adding triggered_by column...")
        execute_update("""
            ALTER TABLE intelligence_history 
            ADD COLUMN triggered_by TEXT;
        """)
        print("[Migrate] ✅ triggered_by column added")
    else:
        print("[Migrate] ⚠️  triggered_by column already exists, skipping")
    
    # Add input_hash column (stable hash of normalized inputs)
    if 'input_hash' not in existing_columns:
        print("[Migrate] Adding input_hash column...")
        execute_update("""
            ALTER TABLE intelligence_history 
            ADD COLUMN input_hash TEXT;
        """)
        print("[Migrate] ✅ input_hash column added")
    else:
        print("[Migrate] ⚠️  input_hash column already exists, skipping")
    
    # Create index on previous_run_id for audit chain traversal
    print("[Migrate] Creating index on previous_run_id...")
    execute_update("""
        CREATE INDEX IF NOT EXISTS idx_intelligence_history_previous_run
        ON intelligence_history(previous_run_id);
    """)
    print("[Migrate] ✅ Index created on previous_run_id")
    
    # Create index on input_hash for duplicate detection
    print("[Migrate] Creating index on input_hash...")
    execute_update("""
        CREATE INDEX IF NOT EXISTS idx_intelligence_history_input_hash
        ON intelligence_history(case_id, input_hash);
    """)
    print("[Migrate] ✅ Index created on input_hash")
    
    # Verify columns exist
    result = execute_sql("PRAGMA table_info(intelligence_history)")
    current_columns = {row['name'] for row in result}
    
    required_columns = {'previous_run_id', 'triggered_by', 'input_hash'}
    if required_columns.issubset(current_columns):
        print("[Migrate] ✅ Verification: All integrity fields exist")
        print(f"[Migrate] ✅ Current columns: {sorted(current_columns)}")
    else:
        missing = required_columns - current_columns
        print(f"[Migrate] ❌ ERROR: Missing columns: {missing}")
        sys.exit(1)
    
    print("[Migrate] ✅ Migration complete")


if __name__ == "__main__":
    migrate()
