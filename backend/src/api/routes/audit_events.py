from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException

from src.core.db import get_raw_connection, row_to_dict

router = APIRouter(prefix="/api/audit", tags=["audit"])


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _fetch_event_by_client_id(
    case_id: str, event_type: str, client_event_id: str
) -> Optional[Dict[str, Any]]:
    with get_raw_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT * FROM audit_events
            WHERE case_id = ? AND event_type = ? AND client_event_id = ?
            LIMIT 1
            """,
            (case_id, event_type, client_event_id),
        )
        row = cursor.fetchone()
        cursor.close()

    return row_to_dict(row) if row else None


@router.post("/events")
async def create_audit_event(payload: Dict[str, Any]) -> Dict[str, Any]:
    case_id = payload.get("caseId")
    event_type = payload.get("eventType")
    actor = payload.get("actor", "verifier")
    packet_hash = payload.get("packetHash")
    client_event_id = payload.get("clientEventId")
    event_payload = payload.get("payload")

    if not case_id or not event_type:
        raise HTTPException(status_code=400, detail="caseId and eventType are required")

    if event_payload is None or not isinstance(event_payload, dict):
        raise HTTPException(status_code=400, detail="payload must be a JSON object")

    if client_event_id:
        existing = _fetch_event_by_client_id(case_id, event_type, client_event_id)
        if existing:
            return {
                "id": existing["id"],
                "caseId": existing["case_id"],
                "packetHash": existing.get("packet_hash"),
                "actor": existing.get("actor_role") or actor,
                "eventType": existing["event_type"],
                "payload": json.loads(existing["payload_json"]) if existing.get("payload_json") else {},
                "createdAt": existing["created_at"],
                "clientEventId": existing.get("client_event_id"),
            }

    event_id = str(uuid.uuid4())
    created_at = _now_iso()

    with get_raw_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO audit_events (
                id,
                case_id,
                packet_hash,
                actor_role,
                event_type,
                payload_json,
                created_at,
                client_event_id,
                message
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                event_id,
                case_id,
                packet_hash,
                actor,
                event_type,
                json.dumps(event_payload),
                created_at,
                client_event_id,
                payload.get("message", "human_action"),
            ),
        )
        conn.commit()
        cursor.close()

    return {
        "id": event_id,
        "caseId": case_id,
        "packetHash": packet_hash,
        "actor": actor,
        "eventType": event_type,
        "payload": event_payload,
        "createdAt": created_at,
        "clientEventId": client_event_id,
    }


@router.get("/events")
async def list_audit_events(caseId: Optional[str] = None, packetHash: Optional[str] = None) -> Dict[str, Any]:
    if not caseId and not packetHash:
        raise HTTPException(status_code=400, detail="caseId or packetHash is required")

    where_clauses: List[str] = []
    params: List[Any] = []

    if caseId:
        where_clauses.append("case_id = ?")
        params.append(caseId)
    if packetHash:
        where_clauses.append("packet_hash = ?")
        params.append(packetHash)

    where_sql = " AND ".join(where_clauses) if where_clauses else "1=1"

    with get_raw_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            f"SELECT * FROM audit_events WHERE {where_sql} ORDER BY created_at ASC",
            tuple(params),
        )
        rows = cursor.fetchall()
        cursor.close()

    events = []
    for row in rows:
        event = row_to_dict(row)
        payload_json = event.get("payload_json")
        parsed_payload = {}
        if payload_json:
            try:
                parsed_payload = json.loads(payload_json)
            except json.JSONDecodeError:
                parsed_payload = {}
        events.append(
            {
                "id": event["id"],
                "caseId": event["case_id"],
                "packetHash": event.get("packet_hash"),
                "actor": event.get("actor_role", "verifier"),
                "eventType": event["event_type"],
                "payload": parsed_payload,
                "createdAt": event["created_at"],
                "clientEventId": event.get("client_event_id"),
            }
        )

    return {"items": events}
