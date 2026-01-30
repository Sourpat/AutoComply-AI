from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from src.core.db import get_raw_connection


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def get_case(case_id: str) -> Optional[Dict[str, Any]]:
    with get_raw_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT case_id, title, summary, status, metadata, updated_at FROM agentic_cases WHERE case_id = ?",
            (case_id,),
        )
        row = cursor.fetchone()
        cursor.close()

    if not row:
        return None

    metadata = {}
    if row[4]:
        try:
            metadata = json.loads(row[4])
        except json.JSONDecodeError:
            metadata = {}

    return {
        "caseId": row[0],
        "title": row[1],
        "summary": row[2],
        "status": row[3],
        "metadata": metadata,
        "updatedAt": row[5],
    }


def list_cases(limit: int = 50) -> List[Dict[str, Any]]:
    with get_raw_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT case_id, title, summary, status, metadata, updated_at
            FROM agentic_cases
            ORDER BY updated_at DESC
            LIMIT ?
            """,
            (limit,),
        )
        rows = cursor.fetchall()
        cursor.close()

    cases: List[Dict[str, Any]] = []
    for row in rows:
        metadata = {}
        if row[4]:
            try:
                metadata = json.loads(row[4])
            except json.JSONDecodeError:
                metadata = {}
        cases.append(
            {
                "caseId": row[0],
                "title": row[1],
                "summary": row[2],
                "status": row[3],
                "metadata": metadata,
                "updatedAt": row[5],
            }
        )
    return cases


def upsert_case(case_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
    title = data.get("title") or "Agentic Case"
    summary = data.get("summary")
    status = data.get("status") or "draft"
    metadata = data.get("metadata") or {}
    updated_at = _now_iso()

    with get_raw_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO agentic_cases (case_id, title, summary, status, metadata, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(case_id)
            DO UPDATE SET
                title = excluded.title,
                summary = excluded.summary,
                status = excluded.status,
                metadata = excluded.metadata,
                updated_at = excluded.updated_at
            """,
            (
                case_id,
                title,
                summary,
                status,
                json.dumps(metadata) if metadata else None,
                updated_at,
            ),
        )
        conn.commit()
        cursor.close()

    return {
        "caseId": case_id,
        "title": title,
        "summary": summary,
        "status": status,
        "metadata": metadata,
        "updatedAt": updated_at,
    }


def append_case_event(case_id: str, event_type: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    event_id = str(uuid.uuid4())
    timestamp = _now_iso()

    with get_raw_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO agentic_case_events (id, case_id, timestamp, type, payload)
            VALUES (?, ?, ?, ?, ?)
            """,
            (event_id, case_id, timestamp, event_type, json.dumps(payload)),
        )
        conn.commit()
        cursor.close()

    return {
        "id": event_id,
        "caseId": case_id,
        "timestamp": timestamp,
        "type": event_type,
        "payload": payload,
    }


def list_case_events(case_id: str, limit: int = 10) -> List[Dict[str, Any]]:
    with get_raw_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT id, timestamp, type, payload
            FROM agentic_case_events
            WHERE case_id = ?
            ORDER BY timestamp DESC
            LIMIT ?
            """,
            (case_id, limit),
        )
        rows = cursor.fetchall()
        cursor.close()

    events: List[Dict[str, Any]] = []
    for row in rows:
        payload = {}
        if row[3]:
            try:
                payload = json.loads(row[3])
            except json.JSONDecodeError:
                payload = {}
        events.append(
            {
                "id": row[0],
                "caseId": case_id,
                "timestamp": row[1],
                "type": row[2],
                "payload": payload,
            }
        )
    return events
