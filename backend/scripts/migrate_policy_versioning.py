"""
Migration: Add policy version fields to intelligence_history (Phase 7.25).

Adds:
- policy_id: Identifier for the policy set
- policy_version: Semantic version of the policy
- policy_hash: SHA256 hash of the policy definition

This enables traceability of which policy version produced each decision.

Run:
    cd backend
    .venv/Scripts/python scripts/migrate_policy_versioning.py
"""

import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from src.core.db import execute_sql, execute_update


def migrate():
    """Add policy versioning fields to intelligence_history table."""
    
    print("[Migrate] Adding policy versioning fields to intelligence_history...")
    
    # Check if columns already exist
    result = execute_sql("PRAGMA table_info(intelligence_history)")
    existing_columns = {row['name'] for row in result}
    
    # Add policy_id column
    if 'policy_id' not in existing_columns:
        print("[Migrate] Adding policy_id column...")
        execute_update("""
            ALTER TABLE intelligence_history 
            ADD COLUMN policy_id TEXT;
        """)
        print("[Migrate] ✅ policy_id column added")
    else:
        print("[Migrate] ⚠️  policy_id column already exists, skipping")
    
    # Add policy_version column
    if 'policy_version' not in existing_columns:
        print("[Migrate] Adding policy_version column...")
        execute_update("""
            ALTER TABLE intelligence_history 
            ADD COLUMN policy_version TEXT;
        """)
        print("[Migrate] ✅ policy_version column added")
    else:
        print("[Migrate] ⚠️  policy_version column already exists, skipping")
    
    # Add policy_hash column
    if 'policy_hash' not in existing_columns:
        print("[Migrate] Adding policy_hash column...")
        execute_update("""
            ALTER TABLE intelligence_history 
            ADD COLUMN policy_hash TEXT;
        """)
        print("[Migrate] ✅ policy_hash column added")
    else:
        print("[Migrate] ⚠️  policy_hash column already exists, skipping")
    
    # Create index on policy_version for filtering
    print("[Migrate] Creating index on policy_version...")
    execute_update("""
        CREATE INDEX IF NOT EXISTS idx_intelligence_history_policy_version
        ON intelligence_history(policy_version);
    """)
    print("[Migrate] ✅ Index created on policy_version")
    
    # Verify columns exist
    result = execute_sql("PRAGMA table_info(intelligence_history)")
    current_columns = {row['name'] for row in result}
    
    required_columns = {'policy_id', 'policy_version', 'policy_hash'}
    if required_columns.issubset(current_columns):
        print("[Migrate] ✅ Verification: All policy fields exist")
        print(f"[Migrate] ✅ Current columns: {sorted(current_columns)}")
    else:
        missing = required_columns - current_columns
        print(f"[Migrate] ❌ ERROR: Missing columns: {missing}")
        sys.exit(1)
    
    print("[Migrate] ✅ Migration complete")
    print("[Migrate] ℹ️  Policy versions will be captured on next intelligence computation")


if __name__ == "__main__":
    migrate()
