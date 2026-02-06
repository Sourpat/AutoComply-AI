from __future__ import annotations

from sqlalchemy import text, Engine


def ensure_intelligence_schema(engine: Engine) -> None:
    """Ensure intelligence tables and indexes exist (SQLite only)."""
    if engine.dialect.name != "sqlite":
        return

    ddl_statements = [
        """
        CREATE TABLE IF NOT EXISTS signals (
            id TEXT PRIMARY KEY,
            case_id TEXT NOT NULL,
            decision_type TEXT,
            source_type TEXT,
            timestamp TEXT NOT NULL,
            signal_strength REAL DEFAULT 1.0,
            completeness_flag INTEGER DEFAULT 0,
            metadata_json TEXT,
            created_at TEXT NOT NULL
        );
        """,
        """
        CREATE TABLE IF NOT EXISTS decision_intelligence (
            case_id TEXT PRIMARY KEY,
            computed_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            completeness_score REAL,
            gap_json TEXT,
            bias_json TEXT,
            confidence_score REAL,
            confidence_band TEXT,
            narrative_template TEXT,
            narrative_genai TEXT,
            executive_summary_json TEXT
        );
        """,
        "CREATE INDEX IF NOT EXISTS idx_signals_case_id ON signals(case_id);",
        "CREATE INDEX IF NOT EXISTS idx_signals_case_id_timestamp ON signals(case_id, timestamp);",
        "CREATE INDEX IF NOT EXISTS idx_signals_source_type ON signals(source_type);",
        "CREATE INDEX IF NOT EXISTS idx_signals_decision_type ON signals(decision_type);",
    ]

    with engine.begin() as conn:
        for statement in ddl_statements:
            conn.execute(text(statement))
