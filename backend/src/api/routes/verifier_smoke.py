from __future__ import annotations

import os
from typing import Any, Dict, List

from fastapi import APIRouter, HTTPException

from src.api.routes.verifier_cases import _resolve_packet_for_case
from src.autocomply.domain.decision_packet import build_decision_packet
from src.autocomply.domain.audit_zip import build_audit_zip_bundle
from src.autocomply.domain.packet_pdf import render_decision_packet_pdf
from src.autocomply.domain.verifier_store import (
    add_action,
    add_note,
    get_case,
    get_final_packet,
    list_cases,
    seed_cases,
    set_case_decision,
    write_final_packet,
)
from src.config import get_settings

router = APIRouter(prefix="/api/ops/verifier-smoke", tags=["ops"])


def _ensure_allowed() -> None:
    settings = get_settings()
    env_marker = os.getenv("ENV", "").lower()
    if env_marker == "ci":
        return
    if settings.APP_ENV.lower() == "dev":
        return
    raise HTTPException(status_code=403, detail="Verifier smoke runner disabled")


def _build_audit_zip(packet: Dict[str, Any], case_id: str) -> bytes:
    case_payload = get_case(case_id)
    submission_id = None
    locked = False
    if case_payload:
        case_row = case_payload.get("case", {})
        submission_id = case_row.get("submission_id")
        locked = bool(case_row.get("locked"))

    zip_bytes, _manifest = build_audit_zip_bundle(
        packet,
        case_id=case_id,
        submission_id=submission_id,
        locked=locked,
    )
    return zip_bytes


@router.get("/run")
async def run_verifier_smoke() -> Dict[str, Any]:
    _ensure_allowed()

    steps: List[Dict[str, Any]] = []
    ok = True
    case_id = None

    def record(name: str, success: bool, detail: Any | None = None) -> None:
        nonlocal ok
        step: Dict[str, Any] = {"name": name, "ok": success}
        if detail:
            step["detail"] = detail
        steps.append(step)
        if not success:
            ok = False

    try:
        seed_cases()
        record("seed", True)
    except Exception as exc:
        record("seed", False, f"{type(exc).__name__}: {exc}")
        return {"ok": False, "case_id": case_id, "steps": steps}

    try:
        cases, _ = list_cases(limit=1, offset=0)
        if not cases:
            raise ValueError("no cases")
        case_id = cases[0]["case_id"]
        record("list_cases", True)
    except Exception as exc:
        record("list_cases", False, f"{type(exc).__name__}: {exc}")
        return {"ok": False, "case_id": case_id, "steps": steps}

    try:
        add_note(case_id, "smoke note", actor="smoke")
        record("add_note", True)
    except Exception as exc:
        record("add_note", False, f"{type(exc).__name__}: {exc}")
        return {"ok": False, "case_id": case_id, "steps": steps}

    try:
        add_action(
            case_id,
            "triage",
            actor="smoke",
            reason="triage",
            payload={"severity": "low"},
        )
        record("add_action", True)
    except Exception as exc:
        record("add_action", False, f"{type(exc).__name__}: {exc}")
        return {"ok": False, "case_id": case_id, "steps": steps}

    try:
        packet = await build_decision_packet(case_id, actor="smoke", include_explain=False)
        if not packet:
            raise ValueError("packet empty")
        record("packet_json", True)
    except Exception as exc:
        record("packet_json", False, f"{type(exc).__name__}: {exc}")
        return {"ok": False, "case_id": case_id, "steps": steps}

    try:
        pdf_bytes = render_decision_packet_pdf(packet)
        if not pdf_bytes or len(pdf_bytes) < 100:
            raise ValueError("pdf too small")
        record("packet_pdf", True, {"content_type": "application/pdf", "bytes": len(pdf_bytes)})
    except Exception as exc:
        record("packet_pdf", False, f"{type(exc).__name__}: {exc}")
        return {"ok": False, "case_id": case_id, "steps": steps}

    try:
        zip_bytes = _build_audit_zip(packet, case_id)
        if not zip_bytes or len(zip_bytes) < 100:
            raise ValueError("zip too small")
        record("audit_zip", True, {"content_type": "application/zip", "bytes": len(zip_bytes)})
    except Exception as exc:
        record("audit_zip", False, f"{type(exc).__name__}: {exc}")
        return {"ok": False, "case_id": case_id, "steps": steps}

    try:
        case_row, _ = set_case_decision(case_id, "approve", reason="smoke", actor="smoke")
        if not case_row or not case_row.get("locked"):
            raise ValueError("decision did not lock case")
        packet_final = await build_decision_packet(case_id, actor="smoke", include_explain=False)
        packet_final.setdefault("finalization", {})
        packet_final["finalization"]["is_final"] = True
        packet_final["finalization"]["decision"] = case_row.get("decision")
        write_final_packet(case_id, packet_final)
        record("decision_approve", True)
    except Exception as exc:
        record("decision_approve", False, f"{type(exc).__name__}: {exc}")
        return {"ok": False, "case_id": case_id, "steps": steps}

    try:
        final_packet = get_final_packet(case_id)
        if not final_packet:
            raise ValueError("final packet missing")
        if not final_packet.get("finalization", {}).get("is_final"):
            raise ValueError("final packet not marked final")
        record("final_packet", True)
    except Exception as exc:
        record("final_packet", False, f"{type(exc).__name__}: {exc}")
        return {"ok": False, "case_id": case_id, "steps": steps}

    try:
        packet_after = await _resolve_packet_for_case(case_id, include_explain=False)
        final_signature = final_packet.get("verifier", {}).get("generated_at")
        after_signature = packet_after.get("verifier", {}).get("generated_at")
        if final_signature != after_signature:
            raise ValueError("packet did not use final snapshot")
        record("packet_final_signature", True)
    except Exception as exc:
        record("packet_final_signature", False, f"{type(exc).__name__}: {exc}")
        return {"ok": False, "case_id": case_id, "steps": steps}

    return {"ok": ok, "case_id": case_id, "steps": steps}
