"""
Database migration: Add triage fields to question_events table and draft_metadata to review_queue_items.

Run this script once to add the new columns:
    python scripts/migrate_add_triage_fields.py
"""

import sys
from pathlib import Path

# Add src to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import text
from src.database.connection import engine, init_db


def migrate():
    """Add triage fields to question_events and draft_metadata to review_queue_items."""
    
    print("🔄 Starting migration: Add triage fields and draft_metadata...")
    
    with engine.connect() as conn:
        # Migrate question_events table
        print("\n📊 Checking question_events table...")
        result = conn.execute(text("PRAGMA table_info(question_events)"))
        existing_columns = {row[1] for row in result}
        
        migrations_needed = []
        
        if 'intent_category' not in existing_columns:
            migrations_needed.append(
                "ALTER TABLE question_events ADD COLUMN intent_category VARCHAR(100)"
            )
        
        if 'risk_level' not in existing_columns:
            migrations_needed.append(
                "ALTER TABLE question_events ADD COLUMN risk_level VARCHAR(50)"
            )
        
        if 'needs_clarification' not in existing_columns:
            migrations_needed.append(
                "ALTER TABLE question_events ADD COLUMN needs_clarification INTEGER DEFAULT 0"
            )
        
        if 'recommended_action' not in existing_columns:
            migrations_needed.append(
                "ALTER TABLE question_events ADD COLUMN recommended_action VARCHAR(50)"
            )
        
        if 'triage_metadata' not in existing_columns:
            migrations_needed.append(
                "ALTER TABLE question_events ADD COLUMN triage_metadata JSON"
            )
        
        if migrations_needed:
            for sql in migrations_needed:
                print(f"  Executing: {sql}")
                conn.execute(text(sql))
            print(f"✅ Added {len(migrations_needed)} triage columns to question_events table.")
        else:
            print("✅ All triage columns already exist in question_events.")
        
        # Migrate review_queue_items table
        print("\n📊 Checking review_queue_items table...")
        result = conn.execute(text("PRAGMA table_info(review_queue_items)"))
        existing_columns = {row[1] for row in result}
        
        review_migrations = []
        
        if 'draft_metadata' not in existing_columns:
            review_migrations.append(
                "ALTER TABLE review_queue_items ADD COLUMN draft_metadata JSON"
            )
        
        if review_migrations:
            for sql in review_migrations:
                print(f"  Executing: {sql}")
                conn.execute(text(sql))
            print(f"✅ Added {len(review_migrations)} columns to review_queue_items table.")
        else:
            print("✅ draft_metadata column already exists in review_queue_items.")
        
        conn.commit()
        
        total_migrations = len(migrations_needed) + len(review_migrations)
        if total_migrations > 0:
            print(f"\n✅ Successfully completed {total_migrations} migrations.")
        else:
            print("\n✅ No migrations needed - database is up to date.")


if __name__ == "__main__":
    # Ensure tables exist
    init_db()
    
    # Run migration
    migrate()
    
    print("\n🎉 Migration complete!")
