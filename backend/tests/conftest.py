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

from fastapi.testclient import TestClient
from src.api.main import app

client = TestClient(app)


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
