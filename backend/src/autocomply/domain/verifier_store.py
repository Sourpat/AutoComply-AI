from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy import create_engine, text, Engine


BASE_DIR = Path(__file__).resolve().parents[3]
DATA_DIR = BASE_DIR / ".data"
DB_PATH = DATA_DIR / "verifier_cases.sqlite"

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
    ddl_statements = [
        """
        CREATE TABLE IF NOT EXISTS cases (
            case_id TEXT PRIMARY KEY,
            submission_id TEXT,
            status TEXT,
            jurisdiction TEXT,
            created_at TEXT,
            updated_at TEXT,
            summary TEXT
        );
        """,
        """
        CREATE TABLE IF NOT EXISTS case_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            case_id TEXT,
            event_type TEXT,
            payload_json TEXT,
            created_at TEXT
        );
        """,
        "CREATE INDEX IF NOT EXISTS idx_cases_status ON cases(status);",
        "CREATE INDEX IF NOT EXISTS idx_cases_created_at ON cases(created_at);",
        "CREATE INDEX IF NOT EXISTS idx_cases_submission_id ON cases(submission_id);",
        "CREATE INDEX IF NOT EXISTS idx_case_events_case_id ON case_events(case_id);",
    ]
    with engine.begin() as conn:
        for statement in ddl_statements:
            conn.execute(text(statement))


def seed_cases(n: int = 10) -> Dict[str, int]:
    ensure_schema()
    engine = get_engine()
    base_time = datetime(2026, 2, 1, tzinfo=timezone.utc)
    statuses = ["pending_review", "approved", "rejected"]
    jurisdictions = ["OH", "NY", "CA", "TX"]

    cases: List[Dict[str, Any]] = []
    events: List[Dict[str, Any]] = []

    for idx in range(1, n + 1):
        case_id = f"case-{idx:03d}"
        submission_id = f"sub-{idx:03d}"
        status = statuses[(idx - 1) % len(statuses)]
        jurisdiction = jurisdictions[(idx - 1) % len(jurisdictions)]
        created_at = (base_time + timedelta(days=idx - 1)).isoformat().replace("+00:00", "Z")
        updated_at = created_at
        summary = f"Deterministic verifier case {idx:03d}"
        cases.append(
            {
                "case_id": case_id,
                "submission_id": submission_id,
                "status": status,
                "jurisdiction": jurisdiction,
                "created_at": created_at,
                "updated_at": updated_at,
                "summary": summary,
            }
        )
        events.append(
            {
                "case_id": case_id,
                "event_type": "seeded",
                "payload_json": json.dumps({"case_id": case_id, "status": status}),
                "created_at": created_at,
            }
        )

    with engine.begin() as conn:
        conn.execute(text("DELETE FROM case_events"))
        conn.execute(text("DELETE FROM cases"))
        for case in cases:
            conn.execute(
                text(
                    """
                    INSERT INTO cases (
                        case_id, submission_id, status, jurisdiction,
                        created_at, updated_at, summary
                    ) VALUES (
                        :case_id, :submission_id, :status, :jurisdiction,
                        :created_at, :updated_at, :summary
                    )
                    """
                ),
                case,
            )
        for event in events:
            conn.execute(
                text(
                    """
                    INSERT INTO case_events (
                        case_id, event_type, payload_json, created_at
                    ) VALUES (
                        :case_id, :event_type, :payload_json, :created_at
                    )
                    """
                ),
                event,
            )

    return {"inserted_cases": len(cases), "inserted_events": len(events)}


def list_cases(
    limit: int,
    offset: int,
    status: Optional[str] = None,
    jurisdiction: Optional[str] = None,
) -> Tuple[List[Dict[str, Any]], int]:
    ensure_schema()
    engine = get_engine()

    filters: List[str] = []
    params: Dict[str, Any] = {"limit": limit, "offset": offset}

    if status:
        filters.append("status = :status")
        params["status"] = status
    if jurisdiction:
        filters.append("jurisdiction = :jurisdiction")
        params["jurisdiction"] = jurisdiction

    where_clause = f"WHERE {' AND '.join(filters)}" if filters else ""

    with engine.begin() as conn:
        count_row = conn.execute(
            text(f"SELECT COUNT(1) AS count FROM cases {where_clause}"),
            params,
        ).mappings().first()
        count = int(count_row["count"]) if count_row else 0

        rows = conn.execute(
            text(
                f"""
                SELECT case_id, submission_id, status, jurisdiction,
                       created_at, updated_at, summary
                FROM cases
                {where_clause}
                ORDER BY created_at DESC
                LIMIT :limit OFFSET :offset
                """
            ),
            params,
        ).mappings().all()

    return [dict(row) for row in rows], count


def get_case(case_id: str) -> Optional[Dict[str, Any]]:
    ensure_schema()
    engine = get_engine()

    with engine.begin() as conn:
        case_row = conn.execute(
            text(
                """
                SELECT case_id, submission_id, status, jurisdiction,
                       created_at, updated_at, summary
                FROM cases
                WHERE case_id = :case_id
                """
            ),
            {"case_id": case_id},
        ).mappings().first()

        if not case_row:
            return None

        events = conn.execute(
            text(
                """
                SELECT id, case_id, event_type, payload_json, created_at
                FROM case_events
                WHERE case_id = :case_id
                ORDER BY created_at DESC
                LIMIT 10
                """
            ),
            {"case_id": case_id},
        ).mappings().all()

    return {
        "case": dict(case_row),
        "events": [dict(row) for row in events],
    }
