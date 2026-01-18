"""
Database migration: Add signals and decision_intelligence tables.

Run this script once to add the new tables:
    python scripts/migrate_add_signal_intelligence.py
"""

import sys
from pathlib import Path

# Add src to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import text
from src.database.connection import engine, init_db


def migrate():
    """Add signals and decision_intelligence tables."""
    
    print("🔄 Starting migration: Add signal intelligence tables...")
    
    with engine.connect() as conn:
        # Check if signals table exists
        print("\n📊 Checking signals table...")
        result = conn.execute(text(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='signals'"
        ))
        signals_exists = result.fetchone() is not None
        
        if not signals_exists:
            print("✨ Creating signals table...")
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS signals (
                    -- Primary key
                    id TEXT PRIMARY KEY NOT NULL,
                    
                    -- Foreign key
                    case_id TEXT NOT NULL,
                    
                    -- Signal details
                    decision_type TEXT NOT NULL,
                    source_type TEXT NOT NULL,  -- submission, evidence, rag_trace, case_event
                    timestamp TEXT NOT NULL,    -- ISO 8601 format (UTC)
                    
                    -- Signal metrics
                    signal_strength REAL DEFAULT 1.0,
                    completeness_flag INTEGER DEFAULT 0,  -- 0 = incomplete, 1 = complete
                    
                    -- Metadata (JSON blob)
                    metadata_json TEXT DEFAULT '{}',
                    
                    -- Timestamps
                    created_at TEXT NOT NULL,   -- ISO 8601 format (UTC)
                    
                    FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE
                )
            """))
            
            print("📇 Creating signals indexes...")
            conn.execute(text(
                "CREATE INDEX IF NOT EXISTS idx_signals_case_id ON signals(case_id)"
            ))
            conn.execute(text(
                "CREATE INDEX IF NOT EXISTS idx_signals_case_id_timestamp ON signals(case_id, timestamp DESC)"
            ))
            conn.execute(text(
                "CREATE INDEX IF NOT EXISTS idx_signals_source_type ON signals(source_type)"
            ))
            conn.execute(text(
                "CREATE INDEX IF NOT EXISTS idx_signals_decision_type ON signals(decision_type)"
            ))
            conn.commit()
            print("✅ signals table created successfully")
        else:
            print("⏭️  signals table already exists, skipping...")
        
        # Check if decision_intelligence table exists
        print("\n📊 Checking decision_intelligence table...")
        result = conn.execute(text(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='decision_intelligence'"
        ))
        di_exists = result.fetchone() is not None
        
        if not di_exists:
            print("✨ Creating decision_intelligence table...")
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS decision_intelligence (
                    -- Primary key
                    case_id TEXT PRIMARY KEY NOT NULL,
                    
                    -- Computation timestamp
                    computed_at TEXT NOT NULL,  -- ISO 8601 format (UTC)
                    updated_at TEXT NOT NULL,   -- ISO 8601 format (UTC)
                    
                    -- Completeness metrics
                    completeness_score INTEGER NOT NULL,  -- 0-100
                    gap_json TEXT DEFAULT '[]',           -- JSON array of gaps
                    
                    -- Bias detection
                    bias_json TEXT DEFAULT '[]',          -- JSON array of bias flags
                    
                    -- Confidence metrics
                    confidence_score INTEGER NOT NULL,    -- 0-100
                    confidence_band TEXT NOT NULL,        -- high, medium, low
                    
                    -- Narrative generation
                    narrative_template TEXT NOT NULL,
                    narrative_genai TEXT,                 -- Optional GenAI-generated narrative
                    
                    FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE
                )
            """))
            
            print("📇 Creating decision_intelligence indexes...")
            conn.execute(text(
                "CREATE INDEX IF NOT EXISTS idx_decision_intelligence_computed_at ON decision_intelligence(computed_at DESC)"
            ))
            conn.execute(text(
                "CREATE INDEX IF NOT EXISTS idx_decision_intelligence_confidence_band ON decision_intelligence(confidence_band)"
            ))
            conn.commit()
            print("✅ decision_intelligence table created successfully")
        else:
            print("⏭️  decision_intelligence table already exists, skipping...")
        
        conn.commit()
    
    print("\n✅ Migration complete!")


if __name__ == "__main__":
    # Initialize DB to ensure connection
    init_db()
    migrate()
