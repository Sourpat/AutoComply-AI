"""
Database Utility Module

Step 2.10: SQLite Persistence Layer

Provides database connection management, initialization, and utilities.

Features:
- SQLAlchemy engine and session management
- Database initialization with schema migrations
- Context manager for safe connection handling
- Row to dict mapping helpers
- Transaction support
"""

import os
import sqlite3
from contextlib import contextmanager
from pathlib import Path
from typing import Dict, List, Any, Optional, Generator

from sqlalchemy import create_engine, text, Engine
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import StaticPool

from src.config import get_settings


# ============================================================================
# Global Engine & SessionMaker
# ============================================================================

_engine: Optional[Engine] = None
_SessionLocal: Optional[sessionmaker] = None


def get_engine() -> Engine:
    """
    Get or create SQLAlchemy engine (singleton pattern).
    
    Uses SQLite with check_same_thread=False for FastAPI async compatibility.
    StaticPool ensures single connection for SQLite in-memory or file mode.
    
    Returns:
        SQLAlchemy Engine instance
    """
    global _engine
    if _engine is None:
        settings = get_settings()
        database_url = settings.DATABASE_URL
        
        # Ensure database directory exists
        if database_url.startswith("sqlite:///"):
            db_path = database_url.replace("sqlite:///", "")
            db_dir = Path(db_path).parent
            db_dir.mkdir(parents=True, exist_ok=True)
        
        # Create engine with SQLite optimizations
        _engine = create_engine(
            database_url,
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
            echo=False,  # Set to True for SQL debugging
        )
    
    return _engine


def get_session_maker() -> sessionmaker:
    """
    Get or create SessionMaker (singleton pattern).
    
    Returns:
        SessionMaker class for creating database sessions
    """
    global _SessionLocal
    if _SessionLocal is None:
        engine = get_engine()
        _SessionLocal = sessionmaker(
            autocommit=False,
            autoflush=False,
            bind=engine
        )
    
    return _SessionLocal


@contextmanager
def get_db() -> Generator[Session, None, None]:
    """
    Context manager for database sessions.
    
    Usage:
        with get_db() as db:
            result = db.execute(text("SELECT * FROM cases"))
            ...
    
    Automatically commits on success, rolls back on error.
    
    Yields:
        SQLAlchemy Session instance
    """
    SessionLocal = get_session_maker()
    db = SessionLocal()
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


# ============================================================================
# Raw SQLite Connection (for schema initialization)
# ============================================================================

@contextmanager
def get_raw_connection() -> Generator[sqlite3.Connection, None, None]:
    """
    Context manager for raw SQLite connections.
    
    Used for schema initialization and migrations where we need
    direct sqlite3 API access (e.g., executescript).
    
    Usage:
        with get_raw_connection() as conn:
            conn.executescript(schema_sql)
    
    Yields:
        sqlite3.Connection instance
    """
    settings = get_settings()
    database_url = settings.DATABASE_URL
    
    # Extract file path from sqlite:/// URL
    if database_url.startswith("sqlite:///"):
        db_path = database_url.replace("sqlite:///", "")
        db_dir = Path(db_path).parent
        db_dir.mkdir(parents=True, exist_ok=True)
    else:
        db_path = ":memory:"
    
    conn = sqlite3.connect(db_path, check_same_thread=False)
    conn.row_factory = sqlite3.Row  # Enable dict-like access
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


# ============================================================================
# Database Migrations
# ============================================================================

def _run_migrations(conn: sqlite3.Connection) -> None:
    """
    Run database migrations for existing databases.
    
    Adds missing columns and indexes to support new features without
    breaking existing data.
    
    Idempotent - safe to run multiple times.
    """
    cursor = conn.cursor()
    
    # Migration 1: Add searchable_text column to cases table
    # Check if column exists
    cursor.execute("PRAGMA table_info(cases)")
    columns = [row[1] for row in cursor.fetchall()]
    
    if 'searchable_text' not in columns:
        print("  Running migration: Adding searchable_text column to cases table...")
        cursor.execute("ALTER TABLE cases ADD COLUMN searchable_text TEXT")
        conn.commit()
        
        # Recreate index if needed (SQLite allows IF NOT EXISTS)
        try:
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_cases_searchable_text ON cases(searchable_text)")
            conn.commit()
            print("  ✓ Migration complete: searchable_text column added")
        except sqlite3.OperationalError as e:
            print(f"  Note: Index creation skipped ({e})")

    # Migration 1b: Add submission_id column to cases table
    if 'submission_id' not in columns:
        print("  Running migration: Adding submission_id column to cases table...")
        cursor.execute("ALTER TABLE cases ADD COLUMN submission_id TEXT")
        conn.commit()
        try:
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_cases_submission_id ON cases(submission_id)")
            conn.commit()
            print("  ✓ Migration complete: submission_id column added")
        except sqlite3.OperationalError as e:
            print(f"  Note: Index creation skipped ({e})")

    # Migration 1c: Add resolved_at column to cases table
    if 'resolved_at' not in columns:
        print("  Running migration: Adding resolved_at column to cases table...")
        cursor.execute("ALTER TABLE cases ADD COLUMN resolved_at TEXT")
        conn.commit()
        print("  ✓ Migration complete: resolved_at column added")
    
    cursor.close()

    # Migration 2: Add evidence upload columns to evidence_items
    cursor = conn.cursor()
    cursor.execute("PRAGMA table_info(evidence_items)")
    ev_columns = [row[1] for row in cursor.fetchall()]
    upload_columns = {
        "submission_id": "TEXT",
        "filename": "TEXT",
        "content_type": "TEXT",
        "size_bytes": "INTEGER",
        "storage_path": "TEXT",
        "sha256": "TEXT",
        "uploaded_by": "TEXT",
    }
    for col, col_type in upload_columns.items():
        if col not in ev_columns:
            cursor.execute(f"ALTER TABLE evidence_items ADD COLUMN {col} {col_type}")
            conn.commit()

    # Create indexes for evidence uploads
    try:
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_evidence_case_created ON evidence_items(case_id, created_at DESC)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_evidence_submission_created ON evidence_items(submission_id, created_at DESC)")
        conn.commit()
    except sqlite3.OperationalError:
        pass

    cursor.close()

    # Migration 3: Add attachments table/columns
    cursor = conn.cursor()
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='attachments'")
    table_exists = cursor.fetchone() is not None
    if table_exists:
        cursor.execute("PRAGMA table_info(attachments)")
        att_columns = [row[1] for row in cursor.fetchall()]
        new_columns = {
            "is_deleted": "INTEGER DEFAULT 0",
            "deleted_at": "TEXT",
            "deleted_by": "TEXT",
            "delete_reason": "TEXT",
            "is_redacted": "INTEGER DEFAULT 0",
            "redacted_at": "TEXT",
            "redacted_by": "TEXT",
            "redact_reason": "TEXT",
            "original_sha256": "TEXT",
        }
        for col, col_type in new_columns.items():
            if col not in att_columns:
                cursor.execute(f"ALTER TABLE attachments ADD COLUMN {col} {col_type}")
                conn.commit()

        try:
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_attachments_case_id ON attachments(case_id)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_attachments_created_at ON attachments(created_at)")
            conn.commit()
        except sqlite3.OperationalError:
            pass
    cursor.close()


# ============================================================================
# Schema Initialization
# ============================================================================

def init_db() -> None:
    """
    Initialize database with schema migrations.
    
    PRODUCTION-SAFE: Fast startup, no heavy seeding.
    - Runs CREATE TABLE IF NOT EXISTS (idempotent)
    - No INSERT statements in schemas
    - No KB seeding (use /api/v1/admin/kb/seed or scripts/seed_kb.py)
    - No heavy data loading
    
    Safe to run on every startup - completes in < 100ms.
    
    Idempotent - safe to run multiple times.
    
    Executes:
    1. backend/app/workflow/schema.sql (cases, evidence, audit events)
    2. backend/app/submissions/schema.sql (submissions)
    3. backend/app/analytics/schema.sql (saved views)
    4. backend/app/workflow/scheduled_exports_schema.sql (scheduled exports)
    
    Creates tables if they don't exist, preserves existing data.
    """
    # Determine paths - schema files are in backend/app/, not backend/src/app/
    backend_root = Path(__file__).parent.parent.parent  # backend/src/core -> backend
    workflow_schema_path = backend_root / "app" / "workflow" / "schema.sql"
    submissions_schema_path = backend_root / "app" / "submissions" / "schema.sql"
    analytics_schema_path = backend_root / "app" / "analytics" / "schema.sql"
    scheduled_exports_schema_path = backend_root / "app" / "workflow" / "scheduled_exports_schema.sql"
    
    with get_raw_connection() as conn:
        # Execute workflow schema (with error handling for migrations)
        if workflow_schema_path.exists():
            with open(workflow_schema_path, 'r', encoding='utf-8') as f:
                workflow_sql = f.read()
                try:
                    conn.executescript(workflow_sql)
                except sqlite3.OperationalError as e:
                    error_text = str(e)
                    if "no such column: searchable_text" in error_text or "no such column: submission_id" in error_text:
                        print("  Detected missing column, running migration...")
                        # Run migration first
                        _run_migrations(conn)
                        # Retry schema execution
                        conn.executescript(workflow_sql)
                    else:
                        raise
        else:
            print(f"Warning: Workflow schema not found at {workflow_schema_path}")
        
        # Ensure migrations are applied (idempotent)
        _run_migrations(conn)
        
        # Execute submissions schema
        if submissions_schema_path.exists():
            with open(submissions_schema_path, 'r', encoding='utf-8') as f:
                submissions_sql = f.read()
                conn.executescript(submissions_sql)
        else:
            print(f"Warning: Submissions schema not found at {submissions_schema_path}")
        
        # Execute analytics schema
        if analytics_schema_path.exists():
            with open(analytics_schema_path, 'r', encoding='utf-8') as f:
                analytics_sql = f.read()
                conn.executescript(analytics_sql)
        else:
            print(f"Warning: Analytics schema not found at {analytics_schema_path}")
        
        # Execute scheduled exports schema
        if scheduled_exports_schema_path.exists():
            with open(scheduled_exports_schema_path, 'r', encoding='utf-8') as f:
                scheduled_exports_sql = f.read()
                conn.executescript(scheduled_exports_sql)
        else:
            print(f"Warning: Scheduled exports schema not found at {scheduled_exports_schema_path}")
    
    print("Database initialized successfully")


# ============================================================================
# Row Mapping Helpers
# ============================================================================

def row_to_dict(row: sqlite3.Row) -> Dict[str, Any]:
    """
    Convert sqlite3.Row to dictionary.
    
    Args:
        row: sqlite3.Row object
    
    Returns:
        Dictionary with column names as keys
    """
    return {key: row[key] for key in row.keys()}


def rows_to_dicts(rows: List[sqlite3.Row]) -> List[Dict[str, Any]]:
    """
    Convert list of sqlite3.Row objects to list of dictionaries.
    
    Args:
        rows: List of sqlite3.Row objects
    
    Returns:
        List of dictionaries
    """
    return [row_to_dict(row) for row in rows]


# ============================================================================
# Transaction Helpers
# ============================================================================

@contextmanager
def transaction() -> Generator[Session, None, None]:
    """
    Context manager for explicit transaction control.
    
    Usage:
        with transaction() as db:
            db.execute(text("INSERT INTO cases ..."))
            db.execute(text("INSERT INTO audit_events ..."))
            # Both committed together
    
    Yields:
        SQLAlchemy Session instance
    """
    with get_db() as db:
        yield db


def execute_sql(sql: str, params: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
    """
    Execute raw SQL query and return results as list of dicts.
    
    Args:
        sql: SQL query string
        params: Optional parameters for query binding
    
    Returns:
        List of dictionaries with query results
    
    Example:
        results = execute_sql(
            "SELECT * FROM cases WHERE status = :status",
            {"status": "new"}
        )
    """
    with get_db() as db:
        result = db.execute(text(sql), params or {})
        rows = result.fetchall()
        return [dict(row._mapping) for row in rows]


def execute_insert(sql: str, params: Optional[Dict[str, Any]] = None) -> str:
    """
    Execute INSERT query and return last inserted row ID.
    
    Args:
        sql: INSERT SQL statement
        params: Optional parameters for query binding
    
    Returns:
        Last inserted row ID as string
    
    Example:
        case_id = execute_insert(
            "INSERT INTO cases (id, status, ...) VALUES (:id, :status, ...)",
            {"id": "case_123", "status": "new", ...}
        )
    """
    with get_db() as db:
        result = db.execute(text(sql), params or {})
        # For SQLite, lastrowid is the rowid (integer primary key)
        # But we use UUIDs, so return the ID from params
        return params.get("id", str(result.lastrowid)) if params else str(result.lastrowid)


def execute_update(sql: str, params: Optional[Dict[str, Any]] = None) -> int:
    """
    Execute UPDATE query and return number of affected rows.
    
    Args:
        sql: UPDATE SQL statement
        params: Optional parameters for query binding
    
    Returns:
        Number of rows affected
    
    Example:
        updated = execute_update(
            "UPDATE cases SET status = :status WHERE id = :id",
            {"status": "in_review", "id": "case_123"}
        )
    """
    with get_db() as db:
        result = db.execute(text(sql), params or {})
        return result.rowcount


def execute_delete(sql: str, params: Optional[Dict[str, Any]] = None) -> int:
    """
    Execute DELETE query and return number of deleted rows.
    
    Args:
        sql: DELETE SQL statement
        params: Optional parameters for query binding
    
    Returns:
        Number of rows deleted
    
    Example:
        deleted = execute_delete(
            "DELETE FROM cases WHERE id = :id",
            {"id": "case_123"}
        )
    """
    with get_db() as db:
        result = db.execute(text(sql), params or {})
        return result.rowcount
