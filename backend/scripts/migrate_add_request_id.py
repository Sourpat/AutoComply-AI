"""
Phase 7.33: Add request_id to intelligence_history for observability.

Migration: Add request_id column to intelligence_history table

Author: AutoComply AI
Date: 2026-01-21
"""

import sys
import os

# Add backend root to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from src.core.db import execute_sql, execute_update


def migrate():
    """Add request_id column to intelligence_history table."""
    
    print("🔄 Starting migration: Add request_id to intelligence_history...")
    
    # Check if columns already exist
    result = execute_sql("PRAGMA table_info(intelligence_history)")
    existing_columns = {row['name'] for row in result}
    
    if 'request_id' in existing_columns:
        print("✅ Column 'request_id' already exists in intelligence_history table")
        return
    
    print("📝 Adding 'request_id' column to intelligence_history table...")
    
    # Add request_id column (nullable, as existing rows won't have it)
    execute_update("""
        ALTER TABLE intelligence_history
        ADD COLUMN request_id TEXT
    """)
    
    print("✅ Successfully added request_id column")
    
    # Verify the change
    result = execute_sql("PRAGMA table_info(intelligence_history)")
    columns = list(result)
    
    print("\n📊 Updated intelligence_history schema:")
    for col in columns:
        col_id, name, type_, notnull, default, pk = (
            col['cid'], col['name'], col['type'], 
            col['notnull'], col['dflt_value'], col['pk']
        )
        nullable = "NOT NULL" if notnull else "NULL"
        pk_str = " (PRIMARY KEY)" if pk else ""
        default_str = f" DEFAULT {default}" if default is not None else ""
        print(f"  - {name}: {type_} {nullable}{default_str}{pk_str}")
    
    # Show sample data
    result = execute_sql("SELECT COUNT(*) FROM intelligence_history")
    count = list(result)[0]['COUNT(*)'] if result else 0
    print(f"\n📈 Total rows in intelligence_history: {count}")
    
    if count > 0:
        result = execute_sql("""
            SELECT id, case_id, computed_at, request_id 
            FROM intelligence_history 
            ORDER BY computed_at DESC 
            LIMIT 3
        """)
        rows = list(result)
        print("\n📋 Sample entries (newest first):")
        for row in rows:
            entry_id = row['id']
            case_id = row['case_id']
            computed_at = row['computed_at']
            request_id = row.get('request_id')
            req_id_str = request_id or "(none)"
            print(f"  - {entry_id}: {case_id} @ {computed_at} | request_id={req_id_str}")
    
    print("\n🎉 Migration complete!")


if __name__ == "__main__":
    migrate()

