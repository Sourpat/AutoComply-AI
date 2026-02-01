from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any, Dict, List

from fastapi import APIRouter, HTTPException, Request

from app.audit.hash import compute_packet_hash
from app.audit.repo import get_audit_packet, init_audit_schema, list_audit_packets, upsert_audit_packet

router = APIRouter(prefix="/api/audit", tags=["audit"])

MAX_PACKET_BYTES = 2 * 1024 * 1024


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _packet_meta(row: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "packetHash": row["packet_hash"],
        "caseId": row["case_id"],
        "decisionId": row["decision_id"],
        "createdAt": row["created_at"],
        "sizeBytes": row["size_bytes"],
        "packetVersion": row.get("packet_version", "v1"),
    }


def _decision_changes(left: Dict[str, Any], right: Dict[str, Any]) -> List[Dict[str, Any]]:
    changes: List[Dict[str, Any]] = []
    left_decision = left.get("decision") or {}
    right_decision = right.get("decision") or {}
    for field in ("status", "riskLevel", "confidence"):
        left_value = left_decision.get(field)
        right_value = right_decision.get(field)
        if left_value != right_value:
            changes.append({"field": field, "left": left_value, "right": right_value})
    return changes


def _evidence_title(details: Any) -> str:
    if isinstance(details, dict):
        title = details.get("title") or details.get("name") or details.get("label")
        return str(title) if title is not None else ""
    return ""


def _evidence_signature(item: Dict[str, Any]) -> str:
    evidence_id = item.get("id")
    if evidence_id:
        return f"id:{evidence_id}"
    title = _evidence_title(item.get("details"))
    return f"sig:{item.get('type','')}|{item.get('source','')}|{item.get('timestamp','')}|{title}"


def _evidence_preview(item: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "id": item.get("id"),
        "signature": _evidence_signature(item),
        "type": item.get("type"),
        "source": item.get("source"),
        "timestamp": item.get("timestamp"),
        "title": _evidence_title(item.get("details")),
    }


def _human_signature(event: Dict[str, Any]) -> str:
    event_id = event.get("id")
    if event_id:
        return f"id:{event_id}"
    payload = event.get("payload") if isinstance(event.get("payload"), dict) else {}
    keys = ",".join(sorted(payload.keys()))
    return f"sig:{event.get('type','')}|{event.get('timestamp','')}|{keys}"


def _human_preview(event: Dict[str, Any]) -> Dict[str, Any]:
    payload = event.get("payload") if isinstance(event.get("payload"), dict) else {}
    return {
        "id": event.get("id"),
        "signature": _human_signature(event),
        "type": event.get("type"),
        "timestamp": event.get("timestamp"),
        "actor": event.get("actor"),
        "payloadKeys": sorted(payload.keys()),
    }


def _build_diff(left_packet: Dict[str, Any], right_packet: Dict[str, Any], left_row: Dict[str, Any], right_row: Dict[str, Any]) -> Dict[str, Any]:
    left_evidence = left_packet.get("evidenceIndex") or []
    right_evidence = right_packet.get("evidenceIndex") or []
    left_evidence_map = { _evidence_signature(item): _evidence_preview(item) for item in left_evidence }
    right_evidence_map = { _evidence_signature(item): _evidence_preview(item) for item in right_evidence }

    evidence_added = [right_evidence_map[key] for key in right_evidence_map.keys() if key not in left_evidence_map]
    evidence_removed = [left_evidence_map[key] for key in left_evidence_map.keys() if key not in right_evidence_map]
    evidence_changed: List[Dict[str, Any]] = []
    for key in left_evidence_map.keys() & right_evidence_map.keys():
        left_preview = left_evidence_map[key]
        right_preview = right_evidence_map[key]
        if any(
            left_preview.get(field) != right_preview.get(field)
            for field in ("type", "source", "timestamp", "title")
        ):
            evidence_changed.append({"left": left_preview, "right": right_preview})

    left_actions = (left_packet.get("humanActions") or {}).get("events") or []
    right_actions = (right_packet.get("humanActions") or {}).get("events") or []
    left_action_map = { _human_signature(event): _human_preview(event) for event in left_actions }
    right_action_map = { _human_signature(event): _human_preview(event) for event in right_actions }
    human_added = [right_action_map[key] for key in right_action_map.keys() if key not in left_action_map]
    human_removed = [left_action_map[key] for key in left_action_map.keys() if key not in right_action_map]

    left_timeline = left_packet.get("timelineEvents") or []
    right_timeline = right_packet.get("timelineEvents") or []
    left_types = {event.get("type") for event in left_timeline if event.get("type")}
    right_types = {event.get("type") for event in right_timeline if event.get("type")}
    added_types = sorted([event_type for event_type in right_types if event_type not in left_types])

    decision_changes = _decision_changes(left_packet, right_packet)
    has_changes = bool(
        decision_changes
        or evidence_added
        or evidence_removed
        or evidence_changed
        or human_added
        or human_removed
        or added_types
        or len(left_timeline) != len(right_timeline)
    )

    return {
        "left": _packet_meta(left_row),
        "right": _packet_meta(right_row),
        "summary": {
            "hasChanges": has_changes,
            "decisionChanges": len(decision_changes),
            "evidenceChanges": len(evidence_added) + len(evidence_removed) + len(evidence_changed),
            "humanActionChanges": len(human_added) + len(human_removed),
            "timelineAddedTypes": len(added_types),
        },
        "changes": {
            "decision": decision_changes,
            "evidence": {
                "added": evidence_added,
                "removed": evidence_removed,
                "changed": evidence_changed,
            },
            "humanActions": {
                "added": human_added,
                "removed": human_removed,
            },
            "timeline": {
                "addedTypes": added_types,
                "counts": {"left": len(left_timeline), "right": len(right_timeline)},
            },
        },
    }


@router.on_event("startup")
def ensure_audit_schema() -> None:
    init_audit_schema()


@router.get("/packets")
async def list_audit_packet_meta(limit: int = 50) -> List[Dict[str, Any]]:
    safe_limit = max(1, min(limit, 200))
    rows = list_audit_packets(safe_limit)
    return [_packet_meta(row) for row in rows]


@router.post("/packets")
async def store_audit_packet(request: Request) -> Dict[str, Any]:
    raw = await request.body()
    if len(raw) > MAX_PACKET_BYTES:
        raise HTTPException(status_code=413, detail="Audit packet exceeds 2MB limit")

    try:
        packet = json.loads(raw.decode("utf-8"))
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON payload")

    if not isinstance(packet, dict):
        raise HTTPException(status_code=400, detail="Audit packet must be a JSON object")

    claimed_hash = packet.get("packetHash")
    if not claimed_hash:
        raise HTTPException(status_code=400, detail="packetHash is required")

    computed = compute_packet_hash(packet)
    if claimed_hash != computed:
        raise HTTPException(
            status_code=400,
            detail={"message": "packetHash mismatch", "claimed": claimed_hash, "computed": computed},
        )

    metadata = packet.get("metadata") or {}
    case_id = metadata.get("caseId") or packet.get("caseId") or packet.get("case_id")
    decision_id = metadata.get("decisionId") or packet.get("decisionId") or packet.get("decision_id")
    if not case_id or not decision_id:
        raise HTTPException(status_code=400, detail="caseId and decisionId are required")

    payload = {
        "packet_hash": claimed_hash,
        "case_id": case_id,
        "decision_id": decision_id,
        "created_at": _now_iso(),
        "packet_version": packet.get("packetVersion", "v1"),
        "packet_json": json.dumps(packet),
        "size_bytes": len(raw),
    }

    stored = upsert_audit_packet(payload)

    return {
        "packetHash": stored["packet_hash"],
        "caseId": stored["case_id"],
        "decisionId": stored["decision_id"],
        "stored": True,
        "sizeBytes": stored["size_bytes"],
        "createdAt": stored["created_at"],
    }


@router.get("/packets/{packet_hash}")
async def fetch_audit_packet(packet_hash: str) -> Dict[str, Any]:
    row = get_audit_packet(packet_hash)
    if not row:
        raise HTTPException(status_code=404, detail="Audit packet not found")

    try:
        return json.loads(row["packet_json"])
    except json.JSONDecodeError:
        raise HTTPException(status_code=500, detail="Stored audit packet is corrupted")


@router.get("/packets/{packet_hash}/meta")
async def fetch_audit_packet_meta(packet_hash: str) -> Dict[str, Any]:
    row = get_audit_packet(packet_hash)
    if not row:
        raise HTTPException(status_code=404, detail="Audit packet not found")
    return _packet_meta(row)


@router.post("/diff")
async def diff_audit_packets(payload: Dict[str, Any]) -> Dict[str, Any]:
    left_hash = payload.get("leftHash")
    right_hash = payload.get("rightHash")

    if not left_hash or not right_hash:
        raise HTTPException(status_code=400, detail="leftHash and rightHash are required")

    left_row = get_audit_packet(left_hash)
    right_row = get_audit_packet(right_hash)
    missing: List[str] = []
    if not left_row:
        missing.append("left")
    if not right_row:
        missing.append("right")
    if missing:
        raise HTTPException(status_code=404, detail={"message": "Audit packet not found", "missing": missing})

    try:
        left_packet = json.loads(left_row["packet_json"])
        right_packet = json.loads(right_row["packet_json"])
    except json.JSONDecodeError:
        raise HTTPException(status_code=500, detail="Stored audit packet is corrupted")

    if not isinstance(left_packet, dict) or not isinstance(right_packet, dict):
        raise HTTPException(status_code=500, detail="Stored audit packet is invalid")

    return _build_diff(left_packet, right_packet, left_row, right_row)


@router.post("/verify")
async def verify_audit_packet(request: Request) -> Dict[str, Any]:
    raw = await request.body()
    if len(raw) > MAX_PACKET_BYTES:
        raise HTTPException(status_code=413, detail="Audit packet exceeds 2MB limit")

    try:
        packet = json.loads(raw.decode("utf-8"))
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON payload")

    if not isinstance(packet, dict):
        raise HTTPException(status_code=400, detail="Audit packet must be a JSON object")

    claimed = packet.get("packetHash")
    computed = compute_packet_hash(packet)

    return {
        "claimed": claimed,
        "computed": computed,
        "match": bool(claimed and claimed == computed),
    }
