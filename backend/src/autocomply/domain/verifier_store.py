from __future__ import annotations

import json
import os
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy import Engine, create_engine, text


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
    table_statements = [
        """
        CREATE TABLE IF NOT EXISTS cases (
            case_id TEXT PRIMARY KEY,
            submission_id TEXT,
            status TEXT,
            jurisdiction TEXT,
            assignee TEXT,
            assigned_at TEXT,
            locked INTEGER DEFAULT 0,
            decision_json TEXT,
            first_opened_at TEXT,
            finalized_at TEXT,
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
        """
        CREATE TABLE IF NOT EXISTS verifier_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            case_id TEXT,
            event_type TEXT,
            payload_json TEXT,
            created_at TEXT
        );
        """,
        """
        CREATE TABLE IF NOT EXISTS verifier_notes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            case_id TEXT,
            note TEXT,
            actor TEXT,
            created_at TEXT
        );
        """,
        """
        CREATE TABLE IF NOT EXISTS verifier_final_packets (
            case_id TEXT PRIMARY KEY,
            packet_version TEXT,
            packet_json TEXT,
            commit_sha TEXT,
            created_at TEXT
        );
        """,
    ]
    index_statements = [
        "CREATE INDEX IF NOT EXISTS idx_cases_status ON cases(status);",
        "CREATE INDEX IF NOT EXISTS idx_cases_created_at ON cases(created_at);",
        "CREATE INDEX IF NOT EXISTS idx_cases_submission_id ON cases(submission_id);",
        "CREATE INDEX IF NOT EXISTS idx_cases_assignee ON cases(assignee);",
        "CREATE INDEX IF NOT EXISTS idx_cases_assignee_status ON cases(assignee, status);",
        "CREATE INDEX IF NOT EXISTS idx_case_events_case_id ON case_events(case_id);",
        "CREATE INDEX IF NOT EXISTS idx_verifier_events_case_id ON verifier_events(case_id);",
        "CREATE INDEX IF NOT EXISTS idx_verifier_events_created_at ON verifier_events(created_at);",
        "CREATE INDEX IF NOT EXISTS idx_verifier_notes_case_id ON verifier_notes(case_id);",
        "CREATE INDEX IF NOT EXISTS idx_verifier_notes_created_at ON verifier_notes(created_at);",
    ]
    with engine.begin() as conn:
        for statement in table_statements:
            conn.execute(text(statement))
        existing_columns = {
            row["name"]
            for row in conn.execute(text("PRAGMA table_info(cases)")).mappings().all()
        }
        if "assignee" not in existing_columns:
            conn.execute(text("ALTER TABLE cases ADD COLUMN assignee TEXT"))
        if "assigned_at" not in existing_columns:
            conn.execute(text("ALTER TABLE cases ADD COLUMN assigned_at TEXT"))
        if "locked" not in existing_columns:
            conn.execute(text("ALTER TABLE cases ADD COLUMN locked INTEGER DEFAULT 0"))
        if "decision_json" not in existing_columns:
            conn.execute(text("ALTER TABLE cases ADD COLUMN decision_json TEXT"))
        if "first_opened_at" not in existing_columns:
            conn.execute(text("ALTER TABLE cases ADD COLUMN first_opened_at TEXT"))
        if "finalized_at" not in existing_columns:
            conn.execute(text("ALTER TABLE cases ADD COLUMN finalized_at TEXT"))
        for statement in index_statements:
            conn.execute(text(statement))


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _parse_decision(payload_json: Optional[str]) -> Optional[Dict[str, Any]]:
    if not payload_json:
        return None
    try:
        return json.loads(payload_json)
    except json.JSONDecodeError:
        return None


def _normalize_case(row: Dict[str, Any]) -> Dict[str, Any]:
    row = dict(row)
    row["locked"] = bool(row.get("locked"))
    row["decision"] = _parse_decision(row.pop("decision_json", None))
    return row


def _fetch_case(conn, case_id: str) -> Optional[Dict[str, Any]]:
    row = conn.execute(
        text(
            """
                 SELECT case_id, submission_id, status, jurisdiction,
                     assignee, assigned_at, locked, decision_json,
                   first_opened_at, finalized_at,
                     created_at, updated_at, summary
            FROM cases
            WHERE case_id = :case_id
            """
        ),
        {"case_id": case_id},
    ).mappings().first()
    return _normalize_case(row) if row else None


def mark_case_first_opened(case_id: str, opened_at: Optional[str] = None) -> Optional[Dict[str, Any]]:
    ensure_schema()
    engine = get_engine()
    now = opened_at or _now_iso()

    with engine.begin() as conn:
        case_row = _fetch_case(conn, case_id)
        if not case_row:
            return None
        if case_row.get("first_opened_at"):
            return case_row
        conn.execute(
            text(
                """
                UPDATE cases
                SET first_opened_at = :first_opened_at, updated_at = :updated_at
                WHERE case_id = :case_id AND first_opened_at IS NULL
                """
            ),
            {
                "first_opened_at": now,
                "updated_at": now,
                "case_id": case_id,
            },
        )
        return _fetch_case(conn, case_id)


def mark_case_finalized(case_id: str, finalized_at: Optional[str] = None) -> Optional[Dict[str, Any]]:
    ensure_schema()
    engine = get_engine()
    now = finalized_at or _now_iso()

    with engine.begin() as conn:
        case_row = _fetch_case(conn, case_id)
        if not case_row:
            return None
        if case_row.get("finalized_at"):
            return case_row
        conn.execute(
            text(
                """
                UPDATE cases
                SET finalized_at = :finalized_at, updated_at = :updated_at
                WHERE case_id = :case_id AND finalized_at IS NULL
                """
            ),
            {
                "finalized_at": now,
                "updated_at": now,
                "case_id": case_id,
            },
        )
        return _fetch_case(conn, case_id)


def seed_cases(n: int = 10) -> Dict[str, int]:
    ensure_schema()
    engine = get_engine()
    base_time = datetime(2026, 2, 1, tzinfo=timezone.utc)
    statuses = ["open", "in_review", "needs_info"]
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
                "assignee": None,
                "assigned_at": None,
                "locked": 0,
                "decision_json": None,
                "first_opened_at": None,
                "finalized_at": None,
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
        conn.execute(text("DELETE FROM verifier_events"))
        conn.execute(text("DELETE FROM verifier_notes"))
        conn.execute(text("DELETE FROM case_events"))
        conn.execute(text("DELETE FROM cases"))
        for case in cases:
            conn.execute(
                text(
                    """
                    INSERT INTO cases (
                        case_id, submission_id, status, jurisdiction,
                        assignee, assigned_at, locked, decision_json,
                        first_opened_at, finalized_at,
                        created_at, updated_at, summary
                    ) VALUES (
                        :case_id, :submission_id, :status, :jurisdiction,
                        :assignee, :assigned_at, :locked, :decision_json,
                        :first_opened_at, :finalized_at,
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
                    INSERT INTO verifier_events (
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
    assignee: Optional[str] = None,
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
    if assignee:
        filters.append("assignee = :assignee")
        params["assignee"] = assignee

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
                        assignee, assigned_at, locked, decision_json,
                        first_opened_at, finalized_at,
                        created_at, updated_at, summary
                FROM cases
                {where_clause}
                ORDER BY created_at DESC
                LIMIT :limit OFFSET :offset
                """
            ),
            params,
        ).mappings().all()

    return [_normalize_case(row) for row in rows], count


def get_case(case_id: str) -> Optional[Dict[str, Any]]:
    ensure_schema()
    engine = get_engine()

    with engine.begin() as conn:
        case_row = _fetch_case(conn, case_id)

        if not case_row:
            return None

        events = conn.execute(
            text(
                """
                SELECT id, case_id, event_type, payload_json, created_at
                FROM verifier_events
                WHERE case_id = :case_id
                ORDER BY created_at DESC
                LIMIT 50
                """
            ),
            {"case_id": case_id},
        ).mappings().all()

        notes = conn.execute(
            text(
                """
                SELECT id, case_id, note, actor, created_at
                FROM verifier_notes
                WHERE case_id = :case_id
                ORDER BY created_at DESC
                """
            ),
            {"case_id": case_id},
        ).mappings().all()

    return {
        "case": case_row,
        "events": [dict(row) for row in events],
        "notes": [dict(row) for row in notes],
    }


def get_case_by_submission_id(submission_id: str) -> Optional[Dict[str, Any]]:
    ensure_schema()
    engine = get_engine()
    with engine.begin() as conn:
        row = conn.execute(
            text(
                """
                  SELECT case_id, submission_id, status, jurisdiction,
                      assignee, assigned_at, locked, decision_json,
                      first_opened_at, finalized_at,
                      created_at, updated_at, summary
                FROM cases
                WHERE submission_id = :submission_id
                """
            ),
            {"submission_id": submission_id},
        ).mappings().first()
    return _normalize_case(row) if row else None


def get_or_create_case_for_submission(
    submission_id: str,
    jurisdiction: Optional[str],
    summary: str,
    *,
    status: str = "in_review",
) -> Dict[str, Any]:
    ensure_schema()
    engine = get_engine()
    now = _now_iso()
    default_assignee = os.getenv("VERIFIER_DEFAULT_ASSIGNEE", "verifier-1")

    with engine.begin() as conn:
        existing = conn.execute(
            text(
                """
                  SELECT case_id, submission_id, status, jurisdiction,
                      assignee, assigned_at, locked, decision_json,
                      first_opened_at, finalized_at,
                      created_at, updated_at, summary
                FROM cases
                WHERE submission_id = :submission_id
                """
            ),
            {"submission_id": submission_id},
        ).mappings().first()
        if existing:
            return _normalize_case(existing)

        case_id = f"sub-{submission_id}"
        conn.execute(
            text(
                """
                INSERT INTO cases (
                    case_id, submission_id, status, jurisdiction,
                    assignee, assigned_at, locked, decision_json,
                    first_opened_at, finalized_at,
                    created_at, updated_at, summary
                ) VALUES (
                    :case_id, :submission_id, :status, :jurisdiction,
                    :assignee, :assigned_at, :locked, :decision_json,
                    :first_opened_at, :finalized_at,
                    :created_at, :updated_at, :summary
                )
                """
            ),
            {
                "case_id": case_id,
                "submission_id": submission_id,
                "status": status,
                "jurisdiction": jurisdiction,
                "assignee": default_assignee,
                "assigned_at": now,
                "locked": 0,
                "decision_json": None,
                "first_opened_at": None,
                "finalized_at": None,
                "created_at": now,
                "updated_at": now,
                "summary": summary,
            },
        )

        payload = json.dumps(
            {
                "submission_id": submission_id,
                "status": status,
                "summary": summary,
            }
        )
        conn.execute(
            text(
                """
                INSERT INTO verifier_events (
                    case_id, event_type, payload_json, created_at
                ) VALUES (
                    :case_id, :event_type, :payload_json, :created_at
                )
                """
            ),
            {
                "case_id": case_id,
                "event_type": "submission_received",
                "payload_json": payload,
                "created_at": now,
            },
        )
        assigned_payload = json.dumps({"assignee": default_assignee, "actor": "system"})
        conn.execute(
            text(
                """
                INSERT INTO verifier_events (
                    case_id, event_type, payload_json, created_at
                ) VALUES (
                    :case_id, :event_type, :payload_json, :created_at
                )
                """
            ),
            {
                "case_id": case_id,
                "event_type": "assigned",
                "payload_json": assigned_payload,
                "created_at": now,
            },
        )

        created = conn.execute(
            text(
                """
                  SELECT case_id, submission_id, status, jurisdiction,
                      assignee, assigned_at, locked, decision_json,
                      first_opened_at, finalized_at,
                      created_at, updated_at, summary
                FROM cases
                WHERE case_id = :case_id
                """
            ),
            {"case_id": case_id},
        ).mappings().first()

    return _normalize_case(created)


def assign_case(
    case_id: str,
    assignee: Optional[str],
    actor: Optional[str] = None,
) -> Tuple[Optional[Dict[str, Any]], Optional[Dict[str, Any]]]:
    ensure_schema()
    engine = get_engine()
    now = _now_iso()
    event_type = "assigned" if assignee else "unassigned"
    payload = json.dumps({"assignee": assignee, "actor": actor})

    with engine.begin() as conn:
        case_row = _fetch_case(conn, case_id)
        if not case_row:
            return None, None
        if case_row.get("locked"):
            raise ValueError("case locked")

        conn.execute(
            text(
                """
                UPDATE cases
                SET assignee = :assignee, assigned_at = :assigned_at, updated_at = :updated_at
                WHERE case_id = :case_id
                """
            ),
            {
                "assignee": assignee,
                "assigned_at": now if assignee else None,
                "updated_at": now,
                "case_id": case_id,
            },
        )

        conn.execute(
            text(
                """
                INSERT INTO verifier_events (
                    case_id, event_type, payload_json, created_at
                ) VALUES (
                    :case_id, :event_type, :payload_json, :created_at
                )
                """
            ),
            {
                "case_id": case_id,
                "event_type": event_type,
                "payload_json": payload,
                "created_at": now,
            },
        )
        event_id = conn.execute(text("SELECT last_insert_rowid() AS id")).mappings().first()["id"]
        updated_case = _fetch_case(conn, case_id)

    event = {
        "id": event_id,
        "case_id": case_id,
        "event_type": event_type,
        "payload_json": payload,
        "created_at": now,
    }
    return updated_case, event


def bulk_action(
    case_ids: List[str],
    action: str,
    actor: Optional[str] = None,
    reason: Optional[str] = None,
) -> Dict[str, Any]:
    if action not in {"approve", "reject", "needs_review"}:
        raise ValueError("Invalid action")

    updated = 0
    failures: List[Dict[str, Any]] = []

    for case_id in case_ids:
        try:
            case_row, _ = add_action(case_id, action, actor=actor, reason=reason)
        except ValueError as exc:
            failures.append({"case_id": case_id, "reason": str(exc)})
            continue

        if case_row:
            updated += 1
        else:
            failures.append({"case_id": case_id, "reason": "Case not found"})

    return {"updated_count": updated, "failures": failures}


def bulk_assign(
    case_ids: List[str],
    assignee: Optional[str],
    actor: Optional[str] = None,
) -> Dict[str, Any]:
    updated = 0
    failures: List[Dict[str, Any]] = []

    for case_id in case_ids:
        try:
            case_row, _ = assign_case(case_id, assignee, actor=actor)
        except ValueError as exc:
            failures.append({"case_id": case_id, "reason": str(exc)})
            continue
        if case_row:
            updated += 1
        else:
            failures.append({"case_id": case_id, "reason": "Case not found"})

    return {"updated_count": updated, "failures": failures}


def add_action(
    case_id: str,
    action: str,
    actor: Optional[str] = None,
    reason: Optional[str] = None,
    payload: Optional[Dict[str, Any]] = None,
) -> Tuple[Optional[Dict[str, Any]], Optional[Dict[str, Any]]]:
    ensure_schema()
    engine = get_engine()

    action_map = {
        "approve": "approved",
        "reject": "rejected",
        "needs_review": "in_review",
        "triage": "in_review",
    }
    if action not in action_map:
        raise ValueError("Invalid action")

    updated_status = action_map[action]
    now = _now_iso()
    payload = json.dumps(
        {
            "action": action,
            "actor": actor,
            "reason": reason,
            "status": updated_status,
            "payload": payload,
        }
    )

    with engine.begin() as conn:
        case_row = _fetch_case(conn, case_id)
        if not case_row:
            return None, None
        if case_row.get("locked"):
            raise ValueError("case locked")

        conn.execute(
            text(
                """
                UPDATE cases
                SET status = :status, updated_at = :updated_at
                WHERE case_id = :case_id
                """
            ),
            {"status": updated_status, "updated_at": now, "case_id": case_id},
        )

        conn.execute(
            text(
                """
                INSERT INTO verifier_events (
                    case_id, event_type, payload_json, created_at
                ) VALUES (
                    :case_id, :event_type, :payload_json, :created_at
                )
                """
            ),
            {
                "case_id": case_id,
                "event_type": "action",
                "payload_json": payload,
                "created_at": now,
            },
        )
        event_id = conn.execute(text("SELECT last_insert_rowid() AS id")).mappings().first()["id"]
        updated_case = _fetch_case(conn, case_id)

    event = {
        "id": event_id,
        "case_id": case_id,
        "event_type": "action",
        "payload_json": payload,
        "created_at": now,
    }
    return updated_case, event


def add_note(
    case_id: str,
    note: str,
    actor: Optional[str] = None,
    max_length: int = 2000,
) -> Tuple[Optional[Dict[str, Any]], Optional[Dict[str, Any]]]:
    ensure_schema()
    engine = get_engine()

    if len(note) > max_length:
        raise ValueError("Note too long")

    now = _now_iso()
    with engine.begin() as conn:
        case_row = _fetch_case(conn, case_id)
        if not case_row:
            return None, None
        if case_row.get("locked"):
            raise ValueError("case locked")

        conn.execute(
            text(
                """
                INSERT INTO verifier_notes (
                    case_id, note, actor, created_at
                ) VALUES (
                    :case_id, :note, :actor, :created_at
                )
                """
            ),
            {
                "case_id": case_id,
                "note": note,
                "actor": actor,
                "created_at": now,
            },
        )
        note_id = conn.execute(text("SELECT last_insert_rowid() AS id")).mappings().first()["id"]

        payload = json.dumps({"note_id": note_id, "actor": actor, "note": note})
        conn.execute(
            text(
                """
                INSERT INTO verifier_events (
                    case_id, event_type, payload_json, created_at
                ) VALUES (
                    :case_id, :event_type, :payload_json, :created_at
                )
                """
            ),
            {
                "case_id": case_id,
                "event_type": "note",
                "payload_json": payload,
                "created_at": now,
            },
        )
        event_id = conn.execute(text("SELECT last_insert_rowid() AS id")).mappings().first()["id"]

    note_row = {
        "id": note_id,
        "case_id": case_id,
        "note": note,
        "actor": actor,
        "created_at": now,
    }
    event_row = {
        "id": event_id,
        "case_id": case_id,
        "event_type": "note",
        "payload_json": payload,
        "created_at": now,
    }
    return note_row, event_row


def list_events(case_id: str, limit: int = 100) -> List[Dict[str, Any]]:
    ensure_schema()
    engine = get_engine()
    with engine.begin() as conn:
        rows = conn.execute(
            text(
                """
                SELECT id, case_id, event_type, payload_json, created_at
                FROM verifier_events
                WHERE case_id = :case_id
                ORDER BY created_at DESC
                LIMIT :limit
                """
            ),
            {"case_id": case_id, "limit": limit},
        ).mappings().all()
    return [dict(row) for row in rows]


def list_notes(case_id: str) -> List[Dict[str, Any]]:
    ensure_schema()
    engine = get_engine()
    with engine.begin() as conn:
        rows = conn.execute(
            text(
                """
                SELECT id, case_id, note, actor, created_at
                FROM verifier_notes
                WHERE case_id = :case_id
                ORDER BY created_at DESC
                """
            ),
            {"case_id": case_id},
        ).mappings().all()
    return [dict(row) for row in rows]


def set_case_decision(
    case_id: str,
    decision_type: str,
    reason: Optional[str],
    actor: Optional[str],
) -> Tuple[Optional[Dict[str, Any]], Optional[Dict[str, Any]]]:
    ensure_schema()
    engine = get_engine()

    if decision_type not in {"approve", "reject", "request_info"}:
        raise ValueError("Invalid decision type")

    status_map = {
        "approve": "approved",
        "reject": "rejected",
        "request_info": "needs_info",
    }
    locked = 1 if decision_type in {"approve", "reject"} else 0
    now = _now_iso()
    decision = {
        "type": decision_type,
        "reason": reason,
        "actor": actor,
        "timestamp": now,
        "version": "dv1",
    }

    with engine.begin() as conn:
        case_row = _fetch_case(conn, case_id)
        if not case_row:
            return None, None
        if case_row.get("locked"):
            raise ValueError("case locked")

        conn.execute(
            text(
                """
                UPDATE cases
                SET status = :status, locked = :locked, decision_json = :decision_json,
                    updated_at = :updated_at
                WHERE case_id = :case_id
                """
            ),
            {
                "status": status_map[decision_type],
                "locked": locked,
                "decision_json": json.dumps(decision),
                "updated_at": now,
                "case_id": case_id,
            },
        )

        payload = json.dumps(
            {
                "decision": decision,
                "status": status_map[decision_type],
                "locked": bool(locked),
            }
        )
        conn.execute(
            text(
                """
                INSERT INTO verifier_events (
                    case_id, event_type, payload_json, created_at
                ) VALUES (
                    :case_id, :event_type, :payload_json, :created_at
                )
                """
            ),
            {
                "case_id": case_id,
                "event_type": "decision",
                "payload_json": payload,
                "created_at": now,
            },
        )
        event_id = conn.execute(text("SELECT last_insert_rowid() AS id")).mappings().first()["id"]
        updated_case = _fetch_case(conn, case_id)

    event = {
        "id": event_id,
        "case_id": case_id,
        "event_type": "decision",
        "payload_json": payload,
        "created_at": now,
    }
    return updated_case, event


def get_final_packet(case_id: str) -> Optional[Dict[str, Any]]:
    ensure_schema()
    engine = get_engine()

    with engine.begin() as conn:
        row = conn.execute(
            text(
                """
                SELECT packet_json
                FROM verifier_final_packets
                WHERE case_id = :case_id
                """
            ),
            {"case_id": case_id},
        ).mappings().first()

    if not row:
        return None
    try:
        return json.loads(row["packet_json"])
    except json.JSONDecodeError:
        return None


def write_final_packet(case_id: str, packet: Dict[str, Any]) -> None:
    ensure_schema()
    engine = get_engine()
    now = _now_iso()
    commit_sha = (
        os.getenv("RENDER_GIT_COMMIT")
        or os.getenv("GIT_SHA")
        or os.getenv("GITHUB_SHA")
        or os.getenv("COMMIT_SHA")
    )

    with engine.begin() as conn:
        conn.execute(
            text(
                """
                INSERT OR REPLACE INTO verifier_final_packets (
                    case_id, packet_version, packet_json, commit_sha, created_at
                ) VALUES (
                    :case_id, :packet_version, :packet_json, :commit_sha, :created_at
                )
                """
            ),
            {
                "case_id": case_id,
                "packet_version": packet.get("packet_version"),
                "packet_json": json.dumps(packet),
                "commit_sha": commit_sha,
                "created_at": now,
            },
        )
