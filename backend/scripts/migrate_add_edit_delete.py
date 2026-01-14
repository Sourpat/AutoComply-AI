"""
Migration: Add edit/delete support to submissions table

Adds columns:
- updated_at (TEXT): Timestamp of last modification
- is_deleted (INTEGER): Soft delete flag (0=active, 1=deleted)
- deleted_at (TEXT): Timestamp of deletion

Safe to run multiple times (checks if columns exist).
"""

import sys
from pathlib import Path

# Add src to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import text
from src.database.connection import engine


def migrate():
    """Add edit/delete support columns to submissions table."""
    
    print("🔄 Starting migration: Add submission edit/delete support...")
    
    with engine.connect() as conn:
        # Check existing columns
        print("\n📊 Checking submissions table...")
        result = conn.execute(text("PRAGMA table_info(submissions)"))
        existing_columns = {row[1] for row in result}
        
        migrations_needed = []
        
        if 'updated_at' not in existing_columns:
            migrations_needed.append(
                "ALTER TABLE submissions ADD COLUMN updated_at TEXT DEFAULT NULL"
            )
        
        if 'is_deleted' not in existing_columns:
            migrations_needed.append(
                "ALTER TABLE submissions ADD COLUMN is_deleted INTEGER DEFAULT 0 NOT NULL"
            )
        
        if 'deleted_at' not in existing_columns:
            migrations_needed.append(
                "ALTER TABLE submissions ADD COLUMN deleted_at TEXT DEFAULT NULL"
            )
        
        if not migrations_needed:
            print("✅ All columns already exist. No migration needed.")
            return
        
        # Apply migrations
        print(f"\n🔧 Applying {len(migrations_needed)} migration(s)...")
        for migration_sql in migrations_needed:
            print(f"  - {migration_sql}")
            conn.execute(text(migration_sql))
        
        conn.commit()
        
        # Create indexes
        print("\n📑 Creating indexes...")
        try:
            conn.execute(text(
                "CREATE INDEX IF NOT EXISTS idx_submissions_is_deleted ON submissions(is_deleted)"
            ))
            conn.execute(text(
                "CREATE INDEX IF NOT EXISTS idx_submissions_updated_at ON submissions(updated_at)"
            ))
            conn.commit()
            print("  ✅ Indexes created successfully")
        except Exception as e:
            print(f"  ⚠️  Index creation note: {e}")
        
        print("\n✅ Migration complete: Submission edit/delete support added")
        print("\nNew columns:")
        print("  - updated_at: Tracks last modification time")
        print("  - is_deleted: Soft delete flag (0=active, 1=deleted)")
        print("  - deleted_at: Tracks deletion time")


if __name__ == "__main__":
    try:
        migrate()
    except Exception as e:
        print(f"\n❌ Migration failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
