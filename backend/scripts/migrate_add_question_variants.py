"""
Database migration: Add question_variants and variant_embeddings to kb_entries table.

Run this script once to add the new columns:
    python scripts/migrate_add_question_variants.py
"""

import sys
from pathlib import Path

# Add src to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import text
from src.database.connection import engine, init_db


def migrate():
    """Add question_variants and variant_embeddings to kb_entries table."""
    
    print("🔄 Starting migration: Add question variants to kb_entries...")
    
    with engine.connect() as conn:
        # Check kb_entries table
        print("\n📊 Checking kb_entries table...")
        result = conn.execute(text("PRAGMA table_info(kb_entries)"))
        existing_columns = {row[1] for row in result}
        
        migrations_needed = []
        
        if 'question_variants' not in existing_columns:
            migrations_needed.append(
                "ALTER TABLE kb_entries ADD COLUMN question_variants JSON"
            )
        
        if 'variant_embeddings' not in existing_columns:
            migrations_needed.append(
                "ALTER TABLE kb_entries ADD COLUMN variant_embeddings JSON"
            )
        
        if migrations_needed:
            for sql in migrations_needed:
                print(f"  Executing: {sql}")
                conn.execute(text(sql))
            print(f"✅ Added {len(migrations_needed)} columns to kb_entries table.")
        else:
            print("✅ All variant columns already exist in kb_entries.")
        
        conn.commit()
        
        if migrations_needed:
            print(f"\n✅ Successfully completed {len(migrations_needed)} migrations.")
        else:
            print("\n✅ No migrations needed - database is up to date.")


if __name__ == "__main__":
    # Ensure tables exist
    init_db()
    
    # Run migration
    migrate()
    
    print("\n🎉 Migration complete!")
    print("\n💡 Tip: Re-run the seed script to create KB entries with variants:")
    print("   python scripts/seed_kb.py")
