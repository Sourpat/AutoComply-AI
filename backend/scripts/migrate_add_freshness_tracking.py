"""
Schema migration: Add freshness tracking to decision_intelligence table (Phase 7.4).

Adds:
- stale_after_minutes column (INTEGER DEFAULT 30)

Run this script once to update existing databases.
"""

import sqlite3
from pathlib import Path


def main():
    """Add stale_after_minutes column to decision_intelligence table."""
    db_path = Path(__file__).parent.parent / "app" / "workflow" / "autocomply.db"
    
    if not db_path.exists():
        print(f"❌ Database not found at {db_path}")
        print("   No migration needed (will create fresh schema on first run)")
        return
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        # Check if column already exists
        cursor.execute("PRAGMA table_info(decision_intelligence)")
        columns = [row[1] for row in cursor.fetchall()]
        
        if "stale_after_minutes" in columns:
            print("✅ Column 'stale_after_minutes' already exists in decision_intelligence table")
            print("   No migration needed")
            return
        
        # Add the column
        print("🔄 Adding 'stale_after_minutes' column to decision_intelligence...")
        cursor.execute("""
            ALTER TABLE decision_intelligence
            ADD COLUMN stale_after_minutes INTEGER DEFAULT 30
        """)
        
        conn.commit()
        print("✅ Successfully added 'stale_after_minutes' column")
        print("   Default value: 30 minutes")
        
        # Verify the change
        cursor.execute("PRAGMA table_info(decision_intelligence)")
        columns = [row[1] for row in cursor.fetchall()]
        assert "stale_after_minutes" in columns
        print("✅ Migration verified")
        
    except Exception as e:
        print(f"❌ Migration failed: {e}")
        conn.rollback()
        raise
    finally:
        conn.close()


if __name__ == "__main__":
    main()
