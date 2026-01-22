"""
Migration: Add trace fields to intelligence_history (Phase 8.1 - Enterprise Trace Observability).

Purpose:
    Extend intelligence_history table with optional trace fields for observability:
    - trace_id: Global trace identifier (UUID)
    - span_id: Unique span identifier (UUID)
    - parent_span_id: Parent span for hierarchical traces
    - span_name: Human-readable operation name
    - span_kind: Type of span (internal, ai_call, db_query, etc.)
    - duration_ms: Execution time in milliseconds
    - error_text: Error message if span failed
    - metadata_json: Additional structured trace metadata

Usage:
    .venv/Scripts/python scripts/migrate_add_trace_fields.py
"""

import sys
from pathlib import Path

# Add backend to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from src.core.db import execute_sql, execute_update


def migrate():
    """Add trace fields to intelligence_history table."""
    
    print("[Migrate] Adding trace fields to intelligence_history...")
    
    # Check existing columns
    result = execute_sql("PRAGMA table_info(intelligence_history)")
    existing_columns = {row["name"] for row in result}
    
    # Add trace_id
    if "trace_id" not in existing_columns:
        print("  Adding trace_id column...")
        execute_update(
            """
            ALTER TABLE intelligence_history 
            ADD COLUMN trace_id TEXT;
            """
        )
    else:
        print("  ✓ trace_id column already exists")
    
    # Add span_id
    if "span_id" not in existing_columns:
        print("  Adding span_id column...")
        execute_update(
            """
            ALTER TABLE intelligence_history 
            ADD COLUMN span_id TEXT;
            """
        )
    else:
        print("  ✓ span_id column already exists")
    
    # Add parent_span_id
    if "parent_span_id" not in existing_columns:
        print("  Adding parent_span_id column...")
        execute_update(
            """
            ALTER TABLE intelligence_history 
            ADD COLUMN parent_span_id TEXT;
            """
        )
    else:
        print("  ✓ parent_span_id column already exists")
    
    # Add span_name
    if "span_name" not in existing_columns:
        print("  Adding span_name column...")
        execute_update(
            """
            ALTER TABLE intelligence_history 
            ADD COLUMN span_name TEXT;
            """
        )
    else:
        print("  ✓ span_name column already exists")
    
    # Add span_kind
    if "span_kind" not in existing_columns:
        print("  Adding span_kind column...")
        execute_update(
            """
            ALTER TABLE intelligence_history 
            ADD COLUMN span_kind TEXT;
            """
        )
    else:
        print("  ✓ span_kind column already exists")
    
    # Add duration_ms
    if "duration_ms" not in existing_columns:
        print("  Adding duration_ms column...")
        execute_update(
            """
            ALTER TABLE intelligence_history 
            ADD COLUMN duration_ms INTEGER;
            """
        )
    else:
        print("  ✓ duration_ms column already exists")
    
    # Add error_text
    if "error_text" not in existing_columns:
        print("  Adding error_text column...")
        execute_update(
            """
            ALTER TABLE intelligence_history 
            ADD COLUMN error_text TEXT;
            """
        )
    else:
        print("  ✓ error_text column already exists")
    
    # Add metadata_json (separate from existing payload_json for trace-specific metadata)
    if "trace_metadata_json" not in existing_columns:
        print("  Adding trace_metadata_json column...")
        execute_update(
            """
            ALTER TABLE intelligence_history 
            ADD COLUMN trace_metadata_json TEXT;
            """
        )
    else:
        print("  ✓ trace_metadata_json column already exists")
    
    # Create indexes for trace queries
    print("  Creating trace indexes...")
    
    execute_update(
        """
        CREATE INDEX IF NOT EXISTS idx_intelligence_history_trace_id
        ON intelligence_history(trace_id);
        """
    )
    
    execute_update(
        """
        CREATE INDEX IF NOT EXISTS idx_intelligence_history_span_id
        ON intelligence_history(span_id);
        """
    )
    
    execute_update(
        """
        CREATE INDEX IF NOT EXISTS idx_intelligence_history_parent_span
        ON intelligence_history(parent_span_id);
        """
    )
    
    print("[Migrate] ✅ Trace fields added successfully")
    
    # Verify
    result = execute_sql("PRAGMA table_info(intelligence_history)")
    trace_columns = [
        "trace_id", "span_id", "parent_span_id", "span_name", 
        "span_kind", "duration_ms", "error_text", "trace_metadata_json"
    ]
    
    existing = {row["name"] for row in result}
    for col in trace_columns:
        if col in existing:
            print(f"  ✓ {col} verified")
        else:
            print(f"  ✗ {col} MISSING!")
            return False
    
    print("\n[Migrate] ✅ All trace fields verified")
    return True


if __name__ == "__main__":
    try:
        success = migrate()
        sys.exit(0 if success else 1)
    except Exception as e:
        print(f"\n[Migrate] ❌ Migration failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
