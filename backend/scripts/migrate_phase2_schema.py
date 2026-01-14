"""
Phase 2 Schema Migration

Applies Phase 2 schema extensions (case_notes, case_events, case_decisions).
"""

import sys
import os
import sqlite3
from pathlib import Path

# Add backend to Python path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from src.config import get_settings


def get_db_path():
    """Get SQLite database path from settings."""
    settings = get_settings()
    database_url = settings.DATABASE_URL
    
    if database_url.startswith("sqlite:///"):
        return database_url.replace("sqlite:///", "")
    else:
        raise ValueError(f"Unsupported database URL: {database_url}")


def apply_phase2_schema():
    """Apply Phase 2 schema extensions."""
    
    print("📦 Applying Phase 2 schema extensions...")
    
    # Read schema file
    schema_path = backend_dir / "app" / "workflow" / "phase2_schema.sql"
    
    if not schema_path.exists():
        print(f"❌ Schema file not found: {schema_path}")
        return False
    
    with open(schema_path, 'r') as f:
        schema_sql = f.read()
    
    # Get database path and execute
    db_path = get_db_path()
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Use executescript to run all statements at once
        cursor.executescript(schema_sql)
        
        conn.commit()
        conn.close()
        
        print(f"✓ Phase 2 schema applied successfully")
        return True
        
    except Exception as e:
        print(f"❌ Error: {e}")
        return False


def verify_schema():
    """Verify that Phase 2 tables exist."""
    
    print("\n🔍 Verifying Phase 2 schema...")
    
    db_path = get_db_path()
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    tables = ['case_notes', 'case_events', 'case_decisions']
    
    for table in tables:
        cursor.execute(
            f"SELECT name FROM sqlite_master WHERE type='table' AND name='{table}'"
        )
        if cursor.fetchone():
            print(f"✓ Table '{table}' exists")
        else:
            print(f"❌ Table '{table}' not found")
            conn.close()
            return False
    
    # Check schema version
    cursor.execute("SELECT version, description FROM schema_version WHERE version = 2")
    row = cursor.fetchone()
    if row:
        print(f"✓ Schema version 2: {row[1]}")
    else:
        print("ℹ Schema version 2 not recorded (may be first run)")
    
    conn.close()
    print("✓ Phase 2 schema verification passed")
    return True


if __name__ == "__main__":
    print("\n" + "=" * 60)
    print("Phase 2 Schema Migration")
    print("=" * 60 + "\n")
    
    # Apply schema
    if not apply_phase2_schema():
        print("\n❌ Schema migration failed")
        sys.exit(1)
    
    # Verify schema
    if not verify_schema():
        print("\n❌ Schema verification failed")
        sys.exit(1)
    
    print("\n" + "=" * 60)
    print("✓ Phase 2 migration completed successfully!")
    print("=" * 60 + "\n")
