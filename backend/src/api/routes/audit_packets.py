from __future__ import annotations

import json
import os
import hmac
import hashlib
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List

from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel

from app.audit.execution_preview import build_execution_preview
from app.audit.hash import compute_packet_hash, compute_packet_signature
from src.config import get_settings
from app.audit.repo import get_audit_packet, init_audit_schema, list_audit_packets, upsert_audit_packet
from app.audit.spec_registry import resolve_spec_for_packet

router = APIRouter(prefix="/api", tags=["audit"])

MAX_PACKET_BYTES = 2 * 1024 * 1024
SIGNATURE_ALG = "HMAC-SHA256"


class AuditPacketMeta(BaseModel):
    packetHash: str
    caseId: str
    decisionId: str
    createdAt: str
    sizeBytes: int
    packetVersion: str
    previousPacketHash: str | None = None
    execution_preview: Dict[str, Any] | None = None
    decision_trace: Dict[str, Any] | None = None


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


def _iso(ts: datetime) -> str:
    return ts.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def _spec_trace_enabled() -> bool:
    flag = os.getenv("FEATURE_SPEC_TRACE", "0").strip().lower()
    return flag in {"1", "true", "yes", "on"}


def _exec_preview_enabled() -> bool:
    flag = os.getenv("FEATURE_EXEC_PREVIEW", "0").strip().lower()
    return flag in {"1", "true", "yes", "on"}


def _attach_spec_trace(packet: Dict[str, Any]) -> Dict[str, Any]:
    if not _spec_trace_enabled():
        return packet
    if not isinstance(packet, dict):
        return packet

    decision_trace = packet.get("decision_trace")
    if isinstance(decision_trace, dict) and decision_trace.get("spec"):
        return packet

    spec = resolve_spec_for_packet(packet)
    if not spec:
        return packet

    if not isinstance(decision_trace, dict):
        decision_trace = {}
    decision_trace["spec"] = spec
    packet["decision_trace"] = decision_trace
    return packet


def _attach_execution_preview(packet: Dict[str, Any]) -> Dict[str, Any]:
    if not _exec_preview_enabled():
        return packet
    if not isinstance(packet, dict):
        return packet
    if packet.get("execution_preview") is not None:
        return packet
    packet["execution_preview"] = build_execution_preview(packet)
    return packet


def _resolve_signing_key(settings) -> str | None:
    key = (settings.AUDIT_SIGNING_KEY or "").strip()
    dev_default = "dev-insecure-audit-signing-secret-change-in-production"
    if not key:
        return None
    if settings.is_production and key == dev_default:
        return None
    return key


def _key_fingerprint(signing_key: str) -> str:
    digest = hashlib.sha256(signing_key.encode("utf-8")).hexdigest()
    return digest[:8]


def _attach_signature(packet: Dict[str, Any]) -> Dict[str, Any]:
    settings = get_settings()
    signing_key = _resolve_signing_key(settings)
    if not signing_key:
        return packet

    packet_hash = compute_packet_hash(packet)
    signature = compute_packet_signature(packet, signing_key)
    packet["packetHash"] = packet_hash
    packet["packet_hash"] = packet_hash
    packet["packetSignature"] = signature
    packet["packet_signature"] = signature
    packet["signatureAlg"] = SIGNATURE_ALG
    packet["signature_alg"] = SIGNATURE_ALG
    return packet


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


@router.get("/audit/packets", response_model=List[AuditPacketMeta])
async def list_audit_packet_meta(limit: int = Query(50, ge=1, le=200)) -> List[Dict[str, Any]]:
    rows = list_audit_packets(limit)
    previous_by_hash: Dict[str, str | None] = {}
    last_by_case: Dict[str, str] = {}
    for row in reversed(rows):
        case_id = row.get("case_id")
        packet_hash = row.get("packet_hash")
        if isinstance(case_id, str) and isinstance(packet_hash, str):
            previous_by_hash[packet_hash] = last_by_case.get(case_id)
            last_by_case[case_id] = packet_hash

    results: List[Dict[str, Any]] = []
    include_preview = _exec_preview_enabled()
    for row in rows:
        meta = _packet_meta(row)
        meta["previousPacketHash"] = previous_by_hash.get(row.get("packet_hash"))
        if include_preview:
            try:
                packet = json.loads(row.get("packet_json") or "{}")
            except json.JSONDecodeError:
                packet = {}
            if isinstance(packet, dict):
                packet = _attach_spec_trace(packet)
                packet = _attach_execution_preview(packet)
                meta["decision_trace"] = packet.get("decision_trace")
                meta["execution_preview"] = packet.get("execution_preview")
        results.append(meta)
    return results


@router.post("/audit/packets")
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

    packet = _attach_signature(packet)
    signature = packet.get("packet_signature")
    signature_alg = packet.get("signature_alg")

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
        "packet_hash": stored["packet_hash"],
        "packetSignature": signature,
        "packet_signature": signature,
        "signatureAlg": signature_alg,
        "signature_alg": signature_alg,
        "caseId": stored["case_id"],
        "decisionId": stored["decision_id"],
        "stored": True,
        "sizeBytes": stored["size_bytes"],
        "createdAt": stored["created_at"],
    }


@router.post("/audit/demo/seed")
async def seed_demo_packets(payload: Dict[str, Any]) -> Dict[str, Any]:
    case_id = payload.get("caseId") or "CASE-DEMO"
    count = payload.get("count") or 3
    try:
        count = int(count)
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail="count must be an integer")

    count = max(1, min(count, 10))
    base_ts = datetime.now(timezone.utc).replace(second=0, microsecond=0)

    statuses = ["submitted", "needs_review", "rejected", "approved"]
    confidences = [0.62, 0.78, 0.54, 0.91]

    evidence_base = [
        {
            "id": "evidence-01",
            "type": "doc",
            "source": "Demo Form",
            "details": {"title": "Application Form"},
        },
        {
            "id": "evidence-02",
            "type": "external_check",
            "source": "License Registry",
            "details": {"title": "License Lookup"},
        },
        {
            "id": "evidence-03",
            "type": "user_attestation",
            "source": "User Attestation",
            "details": {"title": "Applicant Statement"},
        },
        {
            "id": "evidence-04",
            "type": "doc",
            "source": "Supporting Docs",
            "details": {"title": "Supporting Document"},
        },
        {
            "id": "evidence-05",
            "type": "external_check",
            "source": "Sanctions List",
            "details": {"title": "Sanctions Screening"},
        },
    ]

    timeline_base = [
        {"id": "evt-01", "type": "case_created", "payload": {"status": "submitted"}},
        {"id": "evt-02", "type": "agent_plan", "payload": {"summary": "Initial plan"}},
        {"id": "evt-03", "type": "evidence_collected", "payload": {"count": 2}},
        {"id": "evt-04", "type": "risk_scored", "payload": {"risk": "medium"}},
        {"id": "evt-05", "type": "decision_proposed", "payload": {"status": "needs_review"}},
    ]

    packet_hashes: List[str] = []

    for index in range(count):
        ts = base_ts + timedelta(minutes=5 * index)
        decision_id = f"DECISION-{case_id}-{index + 1:02d}"
        status = statuses[min(index, len(statuses) - 1)]
        confidence = confidences[min(index, len(confidences) - 1)]

        evidence_items = []
        for item in evidence_base[: max(3, 3 + index)]:
            evidence_items.append({
                **item,
                "timestamp": _iso(ts),
            })

        timeline_events = []
        for event in timeline_base:
            timeline_events.append({
                "id": event["id"],
                "type": event["type"],
                "timestamp": _iso(ts),
                "payload": event["payload"],
            })

        if index > 0:
            timeline_events.append({
                "id": f"evt-extra-{index:02d}",
                "type": "decision_updated",
                "timestamp": _iso(ts),
                "payload": {"status": status},
            })

        human_events: List[Dict[str, Any]] = []
        if index >= 1:
            human_events.append({
                "id": f"note-{index:02d}",
                "caseId": case_id,
                "type": "NOTE_ADDED",
                "actor": "verifier",
                "timestamp": _iso(ts),
                "payload": {"note": f"Verifier note {index:02d}"},
            })
        if index >= 2:
            human_events.append({
                "id": f"export-{index:02d}",
                "caseId": case_id,
                "type": "EXPORT_JSON",
                "actor": "verifier",
                "timestamp": _iso(ts),
                "payload": {"fileName": f"audit_packet_{case_id}_{index:02d}.json"},
            })
            human_events.append({
                "id": f"override-{index:02d}",
                "caseId": case_id,
                "type": "override_feedback",
                "actor": "verifier",
                "timestamp": _iso(ts),
                "payload": {"reason": "Demo override feedback", "note": f"Override note {index:02d}"},
            })

        packet: Dict[str, Any] = {
            "metadata": {
                "caseId": case_id,
                "decisionId": decision_id,
                "generatedAt": _iso(ts),
                "tenant": "demo",
            },
            "caseSnapshot": {
                "submissionId": case_id,
                "tenant": "demo",
                "formType": "csf",
                "status": status,
                "riskLevel": "medium",
                "createdAt": _iso(base_ts),
                "updatedAt": _iso(ts),
                "title": f"Demo Case {case_id}",
                "subtitle": "Audit demo packet",
                "summary": f"Demo decision {index + 1} for {case_id}",
                "traceId": "trace_demo_1",
            },
            "decision": {
                "status": status,
                "confidence": confidence,
                "riskLevel": "medium",
                "decisionId": decision_id,
                "updatedAt": _iso(ts),
            },
            "explainability": {
                "summary": f"Demo summary {index + 1}",
                "traceId": "trace_demo_1",
                "timestamp": _iso(ts),
                "rulesEvaluated": [],
                "modelNotes": [],
            },
            "timelineEvents": timeline_events,
            "evidenceIndex": evidence_items,
            "humanActions": {
                "auditNotes": "",
                "evidenceNotes": {},
                "events": human_events,
            },
            "packetVersion": "v1",
        }

        spec_trace = resolve_spec_for_packet(packet)
        if spec_trace:
            packet["decision_trace"] = {"spec": spec_trace}

        packet = _attach_signature(packet)
        packet_hash = packet.get("packetHash") or compute_packet_hash(packet)
        packet_hashes.append(packet_hash)

        payload_row = {
            "packet_hash": packet_hash,
            "case_id": case_id,
            "decision_id": decision_id,
            "created_at": _iso(ts),
            "packet_version": packet.get("packetVersion", "v1"),
            "packet_json": json.dumps(packet),
            "size_bytes": len(json.dumps(packet).encode("utf-8")),
        }

        upsert_audit_packet(payload_row)

    return {
        "caseId": case_id,
        "seeded": count,
        "packetHashes": packet_hashes,
        "createdAt": _iso(base_ts),
    }


@router.get("/audit/packets/{packet_hash}")
async def fetch_audit_packet(packet_hash: str) -> Dict[str, Any]:
    row = get_audit_packet(packet_hash)
    if not row:
        raise HTTPException(status_code=404, detail="Audit packet not found")

    try:
        packet = json.loads(row["packet_json"])
        if isinstance(packet, dict):
            packet = _attach_spec_trace(packet)
            return _attach_execution_preview(packet)
        return packet
    except json.JSONDecodeError:
        raise HTTPException(status_code=500, detail="Stored audit packet is corrupted")


@router.get("/audit/packets/{packet_hash}/meta")
async def fetch_audit_packet_meta(packet_hash: str) -> Dict[str, Any]:
    row = get_audit_packet(packet_hash)
    if not row:
        raise HTTPException(status_code=404, detail="Audit packet not found")
    return _packet_meta(row)


@router.post("/audit/diff")
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


@router.post("/audit/verify")
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

    settings = get_settings()
    signing_key = _resolve_signing_key(settings)
    if not signing_key and settings.is_production:
        raise HTTPException(
            status_code=400,
            detail="AUDIT_SIGNING_KEY is required in production",
        )

    claimed = packet.get("packetHash") or packet.get("packet_hash")
    provided_signature = packet.get("packet_signature") or packet.get("packetSignature")

    computed = compute_packet_hash(packet)
    if not claimed:
        return {"valid": False, "reason": "missing_packet_hash", "expected_hash": computed}

    if claimed != computed:
        return {"valid": False, "reason": "hash_mismatch", "expected_hash": computed}

    if not signing_key:
        return {"valid": False, "reason": "signing_key_missing", "expected_hash": computed}

    if not provided_signature:
        return {"valid": False, "reason": "missing_signature", "expected_hash": computed}

    expected_signature = compute_packet_signature(packet, signing_key)
    if not hmac.compare_digest(provided_signature, expected_signature):
        return {"valid": False, "reason": "signature_mismatch", "expected_hash": computed}

    return {"valid": True, "expected_hash": computed}


@router.get("/audit/signing/status")
async def audit_signing_status() -> Dict[str, Any]:
    settings = get_settings()
    signing_key = _resolve_signing_key(settings)
    key_present = bool(signing_key)
    enabled = key_present
    fingerprint = _key_fingerprint(signing_key) if signing_key else None

    return {
        "enabled": enabled,
        "key_present": key_present,
        "key_fingerprint": fingerprint,
        "last_rotated": None,
        "environment": settings.APP_ENV,
    }
