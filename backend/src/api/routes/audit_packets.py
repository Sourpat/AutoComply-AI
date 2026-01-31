from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any, Dict

from fastapi import APIRouter, HTTPException, Request

from app.audit.hash import compute_packet_hash
from app.audit.repo import get_audit_packet, init_audit_schema, upsert_audit_packet

router = APIRouter(prefix="/api/audit", tags=["audit"])

MAX_PACKET_BYTES = 2 * 1024 * 1024


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


@router.on_event("startup")
def ensure_audit_schema() -> None:
    init_audit_schema()


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
