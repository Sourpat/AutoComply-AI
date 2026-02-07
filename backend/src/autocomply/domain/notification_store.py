from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

from sqlalchemy import Engine, create_engine, text

BASE_DIR = Path(__file__).resolve().parents[3]
DATA_DIR = BASE_DIR / ".data"
DB_PATH = DATA_DIR / "submission_events.sqlite"

_engine: Engine | None = None


def get_engine() -> Engine:
    global _engine
    if _engine is None:
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        _engine = create_engine(
            f"sqlite:///{DB_PATH}",
            connect_args={"check_same_thread": False},
        )
    return _engine


def ensure_schema() -> None:
    engine = get_engine()
    table_statement = """
        CREATE TABLE IF NOT EXISTS submission_events (
            id TEXT PRIMARY KEY,
            submission_id TEXT NOT NULL,
            case_id TEXT,
            actor_type TEXT NOT NULL,
            actor_id TEXT,
            event_type TEXT NOT NULL,
            title TEXT NOT NULL,
            message TEXT,
            payload_json TEXT,
            created_at TEXT NOT NULL
        );
    """
    index_statements = [
        "CREATE INDEX IF NOT EXISTS idx_submission_events_submission_id_created_at ON submission_events(submission_id, created_at DESC);",
        "CREATE INDEX IF NOT EXISTS idx_submission_events_case_id_created_at ON submission_events(case_id, created_at DESC);",
        "CREATE INDEX IF NOT EXISTS idx_submission_events_event_type ON submission_events(event_type);",
    ]
    with engine.begin() as conn:
        conn.execute(text(table_statement))
        for statement in index_statements:
            conn.execute(text(statement))


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _day_start_iso() -> str:
    now = datetime.now(timezone.utc)
    start = datetime(year=now.year, month=now.month, day=now.day, tzinfo=timezone.utc)
    return start.isoformat().replace("+00:00", "Z")


def emit_event(
    *,
    submission_id: str,
    case_id: Optional[str],
    actor_type: str,
    actor_id: Optional[str],
    event_type: str,
    title: str,
    message: Optional[str] = None,
    payload: Optional[Dict[str, Any]] = None,
    dedupe_by_day: bool = False,
) -> Optional[Dict[str, Any]]:
    ensure_schema()
    engine = get_engine()
    created_at = _now_iso()

    with engine.begin() as conn:
        if dedupe_by_day:
            day_start = _day_start_iso()
            rows = conn.execute(
                text(
                    """
                    SELECT id
                    FROM submission_events
                    WHERE event_type = :event_type
                      AND created_at >= :day_start
                      AND (case_id = :case_id OR submission_id = :submission_id)
                    LIMIT 1
                    """
                ),
                {
                    "event_type": event_type,
                    "day_start": day_start,
                    "case_id": case_id,
                    "submission_id": submission_id,
                },
            ).mappings().first()
            if rows:
                return None

        event_id = str(uuid.uuid4())
        payload_json = json.dumps(payload) if payload is not None else None
        conn.execute(
            text(
                """
                INSERT INTO submission_events (
                    id, submission_id, case_id, actor_type, actor_id,
                    event_type, title, message, payload_json, created_at
                ) VALUES (
                    :id, :submission_id, :case_id, :actor_type, :actor_id,
                    :event_type, :title, :message, :payload_json, :created_at
                )
                """
            ),
            {
                "id": event_id,
                "submission_id": submission_id,
                "case_id": case_id,
                "actor_type": actor_type,
                "actor_id": actor_id,
                "event_type": event_type,
                "title": title,
                "message": message,
                "payload_json": payload_json,
                "created_at": created_at,
            },
        )

    return {
        "id": event_id,
        "submission_id": submission_id,
        "case_id": case_id,
        "actor_type": actor_type,
        "actor_id": actor_id,
        "event_type": event_type,
        "title": title,
        "message": message,
        "payload": payload,
        "created_at": created_at,
    }


def list_events_by_submission(submission_id: str, limit: int = 50) -> List[Dict[str, Any]]:
    ensure_schema()
    engine = get_engine()
    with engine.begin() as conn:
        rows = conn.execute(
            text(
                """
                SELECT id, submission_id, case_id, actor_type, actor_id,
                       event_type, title, message, payload_json, created_at
                FROM submission_events
                WHERE submission_id = :submission_id
                ORDER BY created_at DESC
                LIMIT :limit
                """
            ),
            {"submission_id": submission_id, "limit": limit},
        ).mappings().all()
    return [dict(row) for row in rows]


def list_events_by_case(case_id: str, limit: int = 50) -> List[Dict[str, Any]]:
    ensure_schema()
    engine = get_engine()
    with engine.begin() as conn:
        rows = conn.execute(
            text(
                """
                SELECT id, submission_id, case_id, actor_type, actor_id,
                       event_type, title, message, payload_json, created_at
                FROM submission_events
                WHERE case_id = :case_id
                ORDER BY created_at DESC
                LIMIT :limit
                """
            ),
            {"case_id": case_id, "limit": limit},
        ).mappings().all()
    return [dict(row) for row in rows]
