# backend/scripts/migrate_add_reason_codes.py
"""
Migration script to add new reason codes to the ReasonCode enum.

Adds:
- jurisdiction_mismatch
- internal_error

Run this after updating the models.py file.
"""

import sys
from pathlib import Path

# Add backend/src to path
backend_src = Path(__file__).parent.parent / "src"
sys.path.insert(0, str(backend_src))

from database.connection import SessionLocal, init_db, engine
from database.models import QuestionEvent, ReasonCode
from sqlalchemy import text


def migrate_reason_codes():
    """Add new reason codes to the database."""
    
    print("Initializing database connection...")
    init_db()
    
    db = SessionLocal()
    
    try:
        # SQLite doesn't support enum modifications, so we just ensure the table exists
        # and the application code will handle the new enum values
        
        print("Checking existing question events with reason codes...")
        events = db.query(QuestionEvent).filter(
            QuestionEvent.reason_code.isnot(None)
        ).all()
        
        reason_counts = {}
        for event in events:
            reason = event.reason_code
            reason_counts[reason] = reason_counts.get(reason, 0) + 1
        
        print(f"\nCurrent reason code distribution:")
        for reason, count in sorted(reason_counts.items()):
            print(f"  {reason}: {count}")
        
        print(f"\nNew reason codes added to enum:")
        print(f"  - jurisdiction_mismatch: For state-based filtering")
        print(f"  - internal_error: For exception handling")
        
        print("\n✓ Migration completed successfully!")
        print("The application will now handle these new reason codes.")
        
    except Exception as e:
        print(f"✗ Migration failed: {e}")
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    migrate_reason_codes()
