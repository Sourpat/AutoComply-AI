import os
import sys
import tempfile
from pathlib import Path

import pytest

ROOT_DIR = Path(__file__).resolve().parents[1]
SRC_DIR = ROOT_DIR / "src"

if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))
if str(SRC_DIR) not in sys.path:
    sys.path.insert(0, str(SRC_DIR))


def _configure_test_db() -> str:
    """Configure a temp SQLite database for the test session."""
    temp_dir = Path(tempfile.mkdtemp(prefix="autocomply-test-db-"))
    db_path = temp_dir / "test.db"

    os.environ["DB_PATH"] = str(db_path)
    os.environ["DATABASE_URL"] = f"sqlite:///{db_path}"
    os.environ["EXPORT_DIR"] = str(temp_dir / "exports")
    os.environ["POLICY_ENFORCEMENT_MODE"] = "observe"

    return str(db_path)


_TEST_DB_PATH = _configure_test_db()

# Reset cached settings and DB engine before importing the app
from src.config import get_settings
from src.core import db as core_db

get_settings.cache_clear()
core_db._engine = None
core_db._SessionLocal = None

from src.core.db import init_db, get_raw_connection

init_db()


@pytest.fixture(scope="session", autouse=True)
def _apply_test_migrations() -> None:
    """Ensure required migrations run against the test DB (idempotent)."""
    from scripts.migrate_add_ai_decision_contract import migrate as migrate_ai_decision_contract
    from scripts.migrate_add_trace_fields import migrate as migrate_trace_fields

    migrate_ai_decision_contract()
    migrate_trace_fields()


def ensure_test_schema():
    """
    Apply schema migrations for test database.
    
    Idempotently adds columns added in Phases 7.20-7.26 that may be missing
    from older test databases.
    
    Safe to run multiple times - ignores "duplicate column name" errors.
    """
    import sqlite3
    
    with get_raw_connection() as conn:
        cursor = conn.cursor()
        
        # Helper function to check if table exists
        def table_exists(table_name):
            cursor.execute(
                "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
                (table_name,)
            )
            return cursor.fetchone() is not None
        
        # Helper function to check if column exists
        def column_exists(table_name, column_name):
            if not table_exists(table_name):
                return False
            cursor.execute(f"PRAGMA table_info({table_name})")
            columns = [row[1] for row in cursor.fetchall()]
            return column_name in columns
        
        # Phase 7.20+: Add case_id to submissions (needed for evidence snapshot)
        if not column_exists("submissions", "case_id"):
            cursor.execute("ALTER TABLE submissions ADD COLUMN case_id TEXT")
            conn.commit()
        
        # Phase 7.20+: Add submitted_at to submissions (needed for evidence snapshot)
        if not column_exists("submissions", "submitted_at"):
            cursor.execute("ALTER TABLE submissions ADD COLUMN submitted_at TEXT")
            conn.commit()
        
        # Phase 7.20+: Add form_data_json column to submissions (alias for form_data)
        if not column_exists("submissions", "form_data_json"):
            cursor.execute("ALTER TABLE submissions ADD COLUMN form_data_json TEXT")
            conn.commit()
        
        # Phase 7.20+: intelligence_history columns
        # First ensure the table exists (from Phase 7.11 migration)
        if not table_exists("intelligence_history"):
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS intelligence_history (
                    id TEXT PRIMARY KEY NOT NULL,
                    case_id TEXT NOT NULL,
                    computed_at TEXT NOT NULL,
                    payload_json TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    actor TEXT,
                    reason TEXT,
                    FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE
                )
            """)
            conn.commit()
        
        for col in ["input_hash", "previous_run_id", "triggered_by"]:
            if not column_exists("intelligence_history", col):
                cursor.execute(f"ALTER TABLE intelligence_history ADD COLUMN {col} TEXT")
                conn.commit()
        
        # Phase 7.24: Evidence snapshot columns
        for col in ["evidence_snapshot", "evidence_hash"]:
            if not column_exists("intelligence_history", col):
                cursor.execute(f"ALTER TABLE intelligence_history ADD COLUMN {col} TEXT")
                conn.commit()
        
        if not column_exists("intelligence_history", "evidence_version"):
            cursor.execute("ALTER TABLE intelligence_history ADD COLUMN evidence_version INTEGER DEFAULT 1")
            conn.commit()
        
        # Phase 7.25: Policy versioning columns
        for col in ["policy_id", "policy_version", "policy_hash"]:
            if not column_exists("intelligence_history", col):
                cursor.execute(f"ALTER TABLE intelligence_history ADD COLUMN {col} TEXT")
                conn.commit()
        
        # Phase 7.33: Request ID column
        if not column_exists("intelligence_history", "request_id"):
            cursor.execute("ALTER TABLE intelligence_history ADD COLUMN request_id TEXT")
            conn.commit()
        
        # Phase 7.33: Add applicant_name to cases (for test fixtures)
        if not column_exists("cases", "applicant_name"):
            cursor.execute("ALTER TABLE cases ADD COLUMN applicant_name TEXT")
            conn.commit()
        
        # Phase 7.24+: Add missing columns to attachments (used by evidence snapshot)
        for col in ["mime_type", "uploaded_at", "category"]:
            if not column_exists("attachments", col):
                cursor.execute(f"ALTER TABLE attachments ADD COLUMN {col} TEXT")
                conn.commit()
        
        # Phase 7.24+: Create request_info_responses table if it doesn't exist (used by evidence snapshot)
        try:
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS request_info_responses (
                    id TEXT PRIMARY KEY,
                    case_id TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    response_text TEXT,
                    actor TEXT
                )
            """)
            conn.commit()
        except sqlite3.OperationalError:
            pass
        
        cursor.close()


# Apply schema upgrades
ensure_test_schema()

from fastapi.testclient import TestClient
from src.api.main import app

client = TestClient(app)


@pytest.fixture(autouse=True)
def _reset_settings_cache() -> None:
    """Clear cached settings between tests to honor env overrides."""
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


@pytest.fixture(autouse=True)
def _isolate_db_per_test() -> None:
    """Clear all tables between tests to avoid cross-test collisions."""
    with get_raw_connection() as conn:
        conn.execute("PRAGMA foreign_keys = OFF")
        cursor = conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
        )
        tables = [row[0] for row in cursor.fetchall()]
        for table in tables:
            if table == "schema_version":
                continue
            conn.execute(f"DELETE FROM {table}")
        conn.commit()
        conn.execute("PRAGMA foreign_keys = ON")
    yield
