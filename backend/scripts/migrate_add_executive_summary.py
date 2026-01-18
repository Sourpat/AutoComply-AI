"""
Migration: Add executive_summary_json to decision_intelligence table (Phase 7.6).

Adds a new TEXT column to store cached ExecutiveSummary JSON.

Usage:
    cd backend
    python scripts/migrate_add_executive_summary.py
"""

import sys
import os
from pathlib import Path

# Add backend to path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from src.core.db import execute_sql, execute_update

def migrate_add_executive_summary():
    """Add executive_summary_json column to decision_intelligence table."""
    
    print("[Migration] Starting migration to add executive_summary_json column...")
    
    # Check if column already exists
    check_sql = """
        SELECT COUNT(*) as count
        FROM pragma_table_info('decision_intelligence')
        WHERE name = 'executive_summary_json'
    """
    
    result = execute_sql(check_sql)
    
    if result and len(result) > 0 and result[0].get("count", 0) > 0:
        print("[Migration] Column 'executive_summary_json' already exists. Skipping.")
        return
    
    # Add column
    alter_sql = """
        ALTER TABLE decision_intelligence
        ADD COLUMN executive_summary_json TEXT
    """
    
    try:
        # Use execute_update for DDL statements
        import sqlite3
        from src.core.db import get_raw_connection
        
        with get_raw_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(alter_sql)
            conn.commit()
        
        print("[Migration] ✓ Added column 'executive_summary_json' to decision_intelligence table")
    except Exception as e:
        print(f"[Migration] ✗ Failed to add column: {e}")
        sys.exit(1)
    
    # Verify column was added
    verify_result = execute_sql(check_sql)
    if verify_result and len(verify_result) > 0 and verify_result[0].get("count", 0) > 0:
        print("[Migration] ✓ Verified column exists")
    else:
        print("[Migration] ✗ Column verification failed")
        sys.exit(1)
    
    print("[Migration] ✓ Migration completed successfully")


if __name__ == "__main__":
    migrate_add_executive_summary()
