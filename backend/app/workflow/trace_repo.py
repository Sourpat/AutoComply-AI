"""
Trace Repository - SQLite-backed trace storage

Stores decision traces for retrieval and replay.
"""

import json
import sqlite3
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List
from pathlib import Path


class TraceRepo:
    """Repository for storing and retrieving decision traces."""

    def __init__(self, db_path: str = "app/data/autocomply.db"):
        """Initialize trace repository with SQLite database."""
        self.db_path = db_path
        self._ensure_schema()

    def _get_connection(self) -> sqlite3.Connection:
        """Get database connection."""
        conn = sqlite3.Connection(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def _ensure_schema(self) -> None:
        """Ensure traces table exists."""
        schema_sql = """
        CREATE TABLE IF NOT EXISTS traces (
            trace_id TEXT PRIMARY KEY,
            created_at TEXT NOT NULL,
            engine_family TEXT,
            decision_type TEXT,
            status TEXT,
            trace_json TEXT NOT NULL
        );
        
        CREATE INDEX IF NOT EXISTS idx_traces_created_at ON traces(created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_traces_engine_family ON traces(engine_family);
        """
        
        with self._get_connection() as conn:
            conn.executescript(schema_sql)
            conn.commit()

    def store_trace(
        self,
        trace_id: str,
        trace_data: Dict[str, Any],
        engine_family: Optional[str] = None,
        decision_type: Optional[str] = None,
        status: Optional[str] = None,
    ) -> None:
        """
        Store a trace in the database.
        
        Args:
            trace_id: Unique trace identifier
            trace_data: Complete trace payload (will be serialized to JSON)
            engine_family: Optional engine family (e.g., "csf", "license")
            decision_type: Optional decision type (e.g., "csf_facility")
            status: Optional decision status (e.g., "ok_to_ship", "blocked")
        """
        created_at = datetime.now(timezone.utc).isoformat()
        trace_json = json.dumps(trace_data, default=str)
        
        with self._get_connection() as conn:
            conn.execute(
                """
                INSERT OR REPLACE INTO traces 
                (trace_id, created_at, engine_family, decision_type, status, trace_json)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (trace_id, created_at, engine_family, decision_type, status, trace_json),
            )
            conn.commit()

    def get_trace(self, trace_id: str) -> Optional[Dict[str, Any]]:
        """
        Retrieve a trace by ID.
        
        Args:
            trace_id: Trace identifier
            
        Returns:
            Trace data dictionary or None if not found
        """
        with self._get_connection() as conn:
            row = conn.execute(
                "SELECT trace_json FROM traces WHERE trace_id = ?",
                (trace_id,),
            ).fetchone()
            
            if row:
                return json.loads(row["trace_json"])
            return None

    def get_recent_traces(self, limit: int = 20) -> List[Dict[str, Any]]:
        """
        Get recent traces ordered by creation time.
        
        Args:
            limit: Maximum number of traces to return
            
        Returns:
            List of trace metadata dictionaries
        """
        with self._get_connection() as conn:
            rows = conn.execute(
                """
                SELECT trace_id, created_at, engine_family, decision_type, status
                FROM traces
                ORDER BY created_at DESC
                LIMIT ?
                """,
                (limit,),
            ).fetchall()
            
            return [dict(row) for row in rows]

    def delete_trace(self, trace_id: str) -> bool:
        """
        Delete a trace by ID.
        
        Args:
            trace_id: Trace identifier
            
        Returns:
            True if trace was deleted, False if not found
        """
        with self._get_connection() as conn:
            cursor = conn.execute(
                "DELETE FROM traces WHERE trace_id = ?",
                (trace_id,),
            )
            conn.commit()
            return cursor.rowcount > 0


# Singleton instance
_trace_repo: Optional[TraceRepo] = None


def get_trace_repo() -> TraceRepo:
    """Get singleton trace repository instance."""
    global _trace_repo
    if _trace_repo is None:
        _trace_repo = TraceRepo()
    return _trace_repo


__all__ = ["TraceRepo", "get_trace_repo"]
