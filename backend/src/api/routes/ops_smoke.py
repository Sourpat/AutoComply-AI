from __future__ import annotations

import hashlib
import os
from datetime import datetime, timezone
import io
import zipfile
from typing import Any, Dict, List

import httpx

from fastapi import APIRouter

from app.submissions.seed import seed_demo_submissions
from src.autocomply.domain.submissions_store import get_submission_store
from src.config import get_settings
from src.core.db import execute_sql
from src.policy.contracts import get_active_contract
from src.api.routes.rag_regulatory import ExplainV1Request, build_explain_contract_v1
from src.autocomply.domain.explainability.drift import detect_drift
from src.autocomply.domain.explainability.golden_runner import run_suite
from src.autocomply.domain.explainability.maintenance import (
    count_runs,
    explain_db_size_mb,
    get_explain_db_path,
)
from src.autocomply.domain.explainability.store import diff_explain_runs, list_runs
from src.autocomply.domain.verifier_store import list_cases, seed_cases

router = APIRouter(tags=["ops"])


SIGNING_DEV_DEFAULT = "dev-insecure-audit-signing-secret-change-in-production"
REGULATORY_PHRASES = [
    "required by",
    "must comply",
    "per regulation",
    "statute",
    "cfr",
]


def _table_exists(table_name: str) -> bool:
    rows = execute_sql(
        "SELECT name FROM sqlite_master WHERE type='table' AND name = :table_name",
        {"table_name": table_name},
    )
    return bool(rows)


def _column_exists(table_name: str, column_name: str) -> bool:
    if not _table_exists(table_name):
        return False
    rows = execute_sql(f"PRAGMA table_info({table_name})")
    existing = {row.get("name") for row in rows if row.get("name")}
    return column_name in existing


def _resolve_signing_key() -> str | None:
    settings = get_settings()
    key = (settings.AUDIT_SIGNING_KEY or "").strip()
    if not key:
        return None
    if settings.is_production and key == SIGNING_DEV_DEFAULT:
        return None
    return key


def _key_fingerprint(signing_key: str) -> str:
    digest = hashlib.sha256(signing_key.encode("utf-8")).hexdigest()
    return digest[:8]


def _build_sha() -> str | None:
    return (
        os.getenv("RENDER_GIT_COMMIT")
        or os.getenv("SOURCE_VERSION")
        or os.getenv("GITHUB_SHA")
        or os.getenv("GIT_SHA")
        or os.getenv("COMMIT_SHA")
    )


def _contains_regulatory_claim(summary: str) -> bool:
    lowered = summary.lower()
    return any(phrase in lowered for phrase in REGULATORY_PHRASES)


def _truth_gate_passed(summary: str, debug: Dict[str, Any] | None) -> bool:
    if _contains_regulatory_claim(summary):
        return False
    if not debug:
        return False
    note = str(debug.get("note", "")).lower()
    return "no_supporting_evidence_found" in note


@router.get("/smoke")
async def ops_smoke() -> Dict[str, Any]:
    settings = get_settings()
    checks: Dict[str, str] = {}
    details: Dict[str, Any] = {
        "errors": [],
    }

    def record_check(name: str, ok: bool, detail: str | None = None) -> None:
        checks[name] = "ok" if ok else "fail"
        if not ok:
            details["errors"].append({"check": name, "detail": detail or "failed"})

    try:
        execute_sql("SELECT 1 AS ok")
        db_ok = True
    except Exception:
        db_ok = False

    required_tables = ["ai_decision_contract", "policy_overrides", "intelligence_history"]
    missing_tables = [table for table in required_tables if not _table_exists(table)]

    missing_columns: list[str] = []
    if _table_exists("intelligence_history") and not _column_exists("intelligence_history", "trace_id"):
        missing_columns.append("intelligence_history.trace_id")

    schema_ok = not missing_tables and not missing_columns

    signing_key = _resolve_signing_key()
    signing_enabled = bool(signing_key)
    signing_key_id = _key_fingerprint(signing_key) if signing_key else None

    active_contract_present = get_active_contract() is not None

    record_check("server", True)

    store = get_submission_store()
    existing = store.list_submissions(limit=1)
    env_marker = os.getenv("ENV", settings.APP_ENV).lower()
    should_seed = env_marker == "local" or not existing
    seeded_ids: List[str] = []
    if should_seed:
        inserted = seed_demo_submissions(store)
        seeded_ids = [item.get("id") for item in inserted if item.get("id")]
        record_check("seed", len(seeded_ids) > 0, "seed_demo_submissions returned no ids")
    else:
        record_check("seed", True)
        details["seed_skipped"] = True

    submissions = store.list_submissions(tenant="ohio", limit=20)
    if not submissions:
        record_check("recent", False, "no recent submissions")
    else:
        record_check("recent", True)

    recent_ids = [submission.submission_id for submission in submissions]
    expected_ids = ["demo-sub-1", "demo-sub-2", "demo-sub-3"]
    target_ids = expected_ids if all(id_ in recent_ids for id_ in expected_ids) else recent_ids[:3]
    details.update(
        {
            "seeded_ids": seeded_ids,
            "recent_ids": recent_ids,
            "target_ids": target_ids,
        }
    )

    explain_results: Dict[str, Any] = {}
    explain_ok = True
    for submission_id in target_ids:
        try:
            explain = await build_explain_contract_v1(ExplainV1Request(submission_id=submission_id))
            explain_results[submission_id] = explain
        except Exception as exc:
            explain_ok = False
            details["errors"].append(
                {
                    "check": "explain_v1",
                    "detail": f"explain failed for {submission_id}: {type(exc).__name__}",
                }
            )
    record_check("explain_v1", explain_ok)

    determinism_ok = True
    determinism_target = "demo-sub-3" if "demo-sub-3" in recent_ids else (target_ids[0] if target_ids else None)
    if determinism_target:
        try:
            first = await build_explain_contract_v1(ExplainV1Request(submission_id=determinism_target))
            second = await build_explain_contract_v1(ExplainV1Request(submission_id=determinism_target))
            determinism_ok = (
                first.status == second.status
                and first.submission_hash == second.submission_hash
            )
            details["determinism"] = {
                "submission_id": determinism_target,
                "status": first.status,
                "submission_hash": first.submission_hash,
            }
        except Exception as exc:
            determinism_ok = False
            details["errors"].append(
                {
                    "check": "determinism",
                    "detail": f"determinism failed for {determinism_target}: {type(exc).__name__}",
                }
            )
    else:
        determinism_ok = False
        details["errors"].append({"check": "determinism", "detail": "no submission for determinism"})
    record_check("determinism", determinism_ok)

    verifier_packet_ok = True
    verifier_final_ok = True
    submitter_flow_ok = True
    if env_marker == "ci":
        try:
            seed_cases()
            cases, _ = list_cases(limit=1, offset=0)
            if not cases:
                verifier_packet_ok = False
                details["errors"].append({"check": "verifier_audit_packet", "detail": "no cases"})
                verifier_final_ok = False
                details["errors"].append({"check": "verifier_final_decision", "detail": "no cases"})
            else:
                case_id = cases[0]["case_id"]
                async with httpx.AsyncClient() as client:
                    pdf_resp = await client.get(
                        f"http://127.0.0.1:8001/api/verifier/cases/{case_id}/packet.pdf?include_explain=0"
                    )
                    zip_resp = await client.get(
                        f"http://127.0.0.1:8001/api/verifier/cases/{case_id}/audit.zip?include_explain=0"
                    )
                    verifier_packet_ok = pdf_resp.status_code == 200 and zip_resp.status_code == 200
                    if not verifier_packet_ok:
                        details["errors"].append(
                            {
                                "check": "verifier_audit_packet",
                                "detail": f"pdf={pdf_resp.status_code}, zip={zip_resp.status_code}",
                            }
                        )

                    decision_resp = await client.post(
                        f"http://127.0.0.1:8001/api/verifier/cases/{case_id}/decision?include_explain=0",
                        json={"type": "approve", "reason": "ops smoke", "actor": "ops"},
                    )
                    final_resp = await client.get(
                        f"http://127.0.0.1:8001/api/verifier/cases/{case_id}/final-packet"
                    )
                    final_zip = await client.get(
                        f"http://127.0.0.1:8001/api/verifier/cases/{case_id}/audit.zip?include_explain=0"
                    )
                    verifier_final_ok = (
                        decision_resp.status_code == 200
                        and final_resp.status_code == 200
                        and final_zip.status_code == 200
                    )
                    if not verifier_final_ok:
                        details["errors"].append(
                            {
                                "check": "verifier_final_decision",
                                "detail": (
                                    f"decision={decision_resp.status_code}, "
                                    f"final={final_resp.status_code}, zip={final_zip.status_code}"
                                ),
                            }
                        )
        except Exception as exc:
            verifier_packet_ok = False
            details["errors"].append({"check": "verifier_audit_packet", "detail": type(exc).__name__})
            verifier_final_ok = False
            details["errors"].append({"check": "verifier_final_decision", "detail": type(exc).__name__})
    if env_marker == "ci":
        try:
            payload = {
                "client_token": "ops-smoke-submitter",
                "subject": "Ops smoke submission",
                "submitter_name": "ops",
                "jurisdiction": "OH",
                "doc_type": "csf_facility",
                "notes": "ops smoke",
                "attachments": [],
            }
            submit_status = None
            async with httpx.AsyncClient() as client:
                submit_resp = await client.post(
                    "http://127.0.0.1:8001/api/submitter/submissions",
                    json=payload,
                )
                submit_status = submit_resp.status_code
                if submit_resp.status_code != 200:
                    submitter_flow_ok = False
                else:
                    case_id = submit_resp.json().get("verifier_case_id")
                    if not case_id:
                        submitter_flow_ok = False
                    else:
                        submission_resp = await client.get(
                            f"http://127.0.0.1:8001/api/verifier/cases/{case_id}/submission"
                        )
                        submitter_flow_ok = submission_resp.status_code == 200
                if not submitter_flow_ok:
                    details["errors"].append(
                        {
                            "check": "submitter_to_verifier_flow",
                            "detail": f"status={submit_status}",
                        }
                    )
        except Exception as exc:
            submitter_flow_ok = False
            details["errors"].append({"check": "submitter_to_verifier_flow", "detail": type(exc).__name__})
    record_check("verifier_audit_packet", verifier_packet_ok)
    record_check("verifier_final_decision", verifier_final_ok)
    record_check("submitter_to_verifier_flow", submitter_flow_ok)

    attachment_flow_ok = True
    audit_zip_evidence_ok = True
    if env_marker == "ci":
        try:
            submission_payload = {
                "client_token": "ops-smoke-attach",
                "subject": "Ops smoke attachment",
                "submitter_name": "ops",
                "jurisdiction": "OH",
                "doc_type": "csf_facility",
                "notes": "ops smoke",
            }
            async with httpx.AsyncClient() as client:
                submit_resp = await client.post(
                    "http://127.0.0.1:8001/api/submitter/submissions",
                    json=submission_payload,
                )
                if submit_resp.status_code != 200:
                    attachment_flow_ok = False
                else:
                    submission_id = submit_resp.json().get("submission_id")
                    case_id = submit_resp.json().get("verifier_case_id")
                    files = {"file": ("smoke.txt", b"smoke", "text/plain")}
                    upload_resp = await client.post(
                        f"http://127.0.0.1:8001/api/submissions/{submission_id}/attachments",
                        files=files,
                    )
                    if upload_resp.status_code != 200:
                        attachment_flow_ok = False
                    else:
                        attachment_id = upload_resp.json().get("attachment_id")
                        list_resp = await client.get(
                            f"http://127.0.0.1:8001/api/verifier/cases/{case_id}/attachments"
                        )
                        download_resp = await client.get(
                            f"http://127.0.0.1:8001/api/verifier/attachments/{attachment_id}/download"
                        )
                        attachment_flow_ok = (
                            list_resp.status_code == 200
                            and download_resp.status_code == 200
                        )

                        audit_zip_resp = await client.get(
                            f"http://127.0.0.1:8001/api/verifier/cases/{case_id}/audit.zip?include_explain=0"
                        )
                        if audit_zip_resp.status_code != 200:
                            audit_zip_evidence_ok = False
                        else:
                            buffer = io.BytesIO(audit_zip_resp.content)
                            with zipfile.ZipFile(buffer) as archive:
                                names = archive.namelist()
                                manifest_ok = "manifest.json" in names
                                packet_ok = "decision_packet.json" in names
                                evidence_files = [name for name in names if name.startswith("evidence/")]
                                audit_zip_evidence_ok = (
                                    manifest_ok and packet_ok and len(evidence_files) >= 1
                                )
                if not attachment_flow_ok:
                    details["errors"].append(
                        {
                            "check": "submitter_attachment_flow",
                            "detail": f"status={submit_resp.status_code}",
                        }
                    )
                if not audit_zip_evidence_ok:
                    details["errors"].append(
                        {
                            "check": "verifier_audit_zip_evidence",
                            "detail": f"status={submit_resp.status_code}",
                        }
                    )
        except Exception as exc:
            attachment_flow_ok = False
            details["errors"].append({"check": "submitter_attachment_flow", "detail": type(exc).__name__})
            audit_zip_evidence_ok = False
            details["errors"].append({"check": "verifier_audit_zip_evidence", "detail": type(exc).__name__})
    record_check("submitter_attachment_flow", attachment_flow_ok)
    record_check("verifier_audit_zip_evidence", audit_zip_evidence_ok)

    submission_status_ok = True
    if env_marker == "ci":
        try:
            async with httpx.AsyncClient() as client:
                submit_resp = await client.post(
                    "http://127.0.0.1:8001/api/submitter/submissions",
                    json={
                        "client_token": "ops-smoke-status",
                        "subject": "Ops smoke status",
                        "submitter_name": "ops",
                        "jurisdiction": "OH",
                        "doc_type": "csf_facility",
                        "notes": "ops smoke",
                    },
                )
                if submit_resp.status_code != 200:
                    submission_status_ok = False
                else:
                    submission_id = submit_resp.json().get("submission_id")
                    case_id = submit_resp.json().get("verifier_case_id")
                    await client.get(f"http://127.0.0.1:8001/api/verifier/cases/{case_id}")

                    request_resp = await client.post(
                        f"http://127.0.0.1:8001/api/verifier/cases/{case_id}/decision",
                        json={"type": "request_info", "reason": "ops", "actor": "ops"},
                    )
                    respond_resp = await client.post(
                        f"http://127.0.0.1:8001/api/submitter/submissions/{submission_id}/respond",
                        json={"message": "response"},
                    )
                    approve_resp = await client.post(
                        f"http://127.0.0.1:8001/api/verifier/cases/{case_id}/decision",
                        json={"type": "approve", "actor": "ops"},
                    )
                    final_detail = await client.get(
                        f"http://127.0.0.1:8001/api/submitter/submissions/{submission_id}"
                    )

                    submission_status_ok = (
                        request_resp.status_code == 200
                        and respond_resp.status_code == 200
                        and approve_resp.status_code == 200
                        and final_detail.status_code == 200
                        and final_detail.json().get("status") == "approved"
                    )
            if not submission_status_ok:
                details["errors"].append(
                    {"check": "submission_status_flow", "detail": "status flow failed"}
                )
        except Exception as exc:
            submission_status_ok = False
            details["errors"].append({"check": "submission_status_flow", "detail": type(exc).__name__})
    record_check("submission_status_flow", submission_status_ok)

    submission_events_ok = True
    if env_marker == "ci":
        try:
            async with httpx.AsyncClient() as client:
                submit_resp = await client.post(
                    "http://127.0.0.1:8001/api/submitter/submissions",
                    json={
                        "client_token": "ops-smoke-events",
                        "subject": "Ops smoke events",
                        "submitter_name": "ops",
                        "jurisdiction": "OH",
                        "doc_type": "csf_facility",
                        "notes": "ops smoke",
                    },
                )
                if submit_resp.status_code != 200:
                    submission_events_ok = False
                else:
                    submission_id = submit_resp.json().get("submission_id")
                    case_id = submit_resp.json().get("verifier_case_id")
                    await client.get(f"http://127.0.0.1:8001/api/verifier/cases/{case_id}")
                    await client.post(
                        f"http://127.0.0.1:8001/api/verifier/cases/{case_id}/decision",
                        json={"type": "request_info", "reason": "ops", "actor": "ops"},
                    )
                    await client.post(
                        f"http://127.0.0.1:8001/api/submitter/submissions/{submission_id}/respond",
                        json={"message": "response"},
                    )
                    await client.post(
                        f"http://127.0.0.1:8001/api/verifier/cases/{case_id}/decision",
                        json={"type": "approve", "actor": "ops"},
                    )
                    events_resp = await client.get(
                        f"http://127.0.0.1:8001/api/submitter/submissions/{submission_id}/events?limit=50"
                    )
                    if events_resp.status_code != 200:
                        submission_events_ok = False
                    else:
                        event_types = {event.get("event_type") for event in events_resp.json()}
                        required = {
                            "submission_created",
                            "verifier_opened",
                            "verifier_requested_info",
                            "submitter_responded",
                            "verifier_approved",
                        }
                        submission_events_ok = required.issubset(event_types)
            if not submission_events_ok:
                details["errors"].append(
                    {"check": "submission_events_feed", "detail": "missing events"}
                )
        except Exception as exc:
            submission_events_ok = False
            details["errors"].append({"check": "submission_events_feed", "detail": type(exc).__name__})
    record_check("submission_events_feed", submission_events_ok)

    sla_run_ok = True
    if env_marker == "ci":
        try:
            async with httpx.AsyncClient() as client:
                submit_resp = await client.post(
                    "http://127.0.0.1:8001/api/submitter/submissions",
                    json={
                        "client_token": "ops-smoke-sla",
                        "subject": "Ops smoke SLA",
                        "submitter_name": "ops",
                        "jurisdiction": "OH",
                        "doc_type": "csf_facility",
                        "notes": "ops sla",
                    },
                )
                if submit_resp.status_code != 200:
                    sla_run_ok = False
                else:
                    run_resp = await client.post("http://127.0.0.1:8001/api/ops/sla/run")
                    if run_resp.status_code != 200:
                        sla_run_ok = False
                    else:
                        payload = run_resp.json()
                        required_keys = {"scanned_count", "emitted_count", "escalated_count", "by_type"}
                        if not required_keys.issubset(payload.keys()):
                            sla_run_ok = False
            if not sla_run_ok:
                details["errors"].append({"check": "sla_run", "detail": "missing sla keys"})
        except Exception as exc:
            sla_run_ok = False
            details["errors"].append({"check": "sla_run", "detail": type(exc).__name__})
    record_check("sla_run", sla_run_ok)

    replay_diff_ok = True
    if determinism_target:
        try:
            recent_runs = list_runs(submission_id=determinism_target, limit=2)
            if len(recent_runs) < 2:
                replay_diff_ok = False
                details["errors"].append(
                    {
                        "check": "replay_diff",
                        "detail": f"expected 2 runs for {determinism_target}",
                    }
                )
            else:
                diff = diff_explain_runs(recent_runs[1], recent_runs[0])
                changes = diff.get("changes", {})
                replay_diff_ok = not (
                    changes.get("status", {}).get("changed")
                    or changes.get("risk", {}).get("changed")
                    or changes.get("submission_hash", {}).get("changed")
                    or changes.get("missing_fields", {}).get("added")
                    or changes.get("missing_fields", {}).get("removed")
                    or changes.get("fired_rules", {}).get("added")
                    or changes.get("fired_rules", {}).get("removed")
                    or changes.get("citations", {}).get("added")
                    or changes.get("citations", {}).get("removed")
                )
                details["replay_diff"] = diff
                if not replay_diff_ok:
                    details["errors"].append(
                        {
                            "check": "replay_diff",
                            "detail": f"diff changes detected for {determinism_target}",
                        }
                    )
        except Exception as exc:
            replay_diff_ok = False
            details["errors"].append(
                {
                    "check": "replay_diff",
                    "detail": f"replay diff failed for {determinism_target}: {type(exc).__name__}",
                }
            )
    else:
        replay_diff_ok = False
        details["errors"].append({"check": "replay_diff", "detail": "no submission for replay_diff"})
    record_check("replay_diff", replay_diff_ok)

    drift_lock_ok = True
    if determinism_target:
        try:
            recent_runs = list_runs(submission_id=determinism_target, limit=2)
            if len(recent_runs) < 2:
                drift_lock_ok = False
                details["errors"].append(
                    {
                        "check": "drift_lock",
                        "detail": f"expected 2 runs for {determinism_target}",
                    }
                )
            else:
                drift = detect_drift(recent_runs[1], recent_runs[0])
                drift_lock_ok = not drift.changed
                details["drift_lock"] = {
                    "submission_id": determinism_target,
                    "changed": drift.changed,
                    "reason": drift.reason,
                    "fields_changed": drift.fields_changed,
                }
                if drift_lock_ok is False:
                    details["errors"].append(
                        {
                            "check": "drift_lock",
                            "detail": f"drift detected for {determinism_target}",
                        }
                    )
        except Exception as exc:
            drift_lock_ok = False
            details["errors"].append(
                {
                    "check": "drift_lock",
                    "detail": f"drift lock failed for {determinism_target}: {type(exc).__name__}",
                }
            )
    else:
        drift_lock_ok = False
        details["errors"].append({"check": "drift_lock", "detail": "no submission for drift lock"})
    record_check("drift_lock", drift_lock_ok)

    idempotency_ok = True
    if determinism_target:
        try:
            idempotency_key = "ops-smoke-idem"
            before = list_runs(submission_id=determinism_target, limit=100)
            first = await build_explain_contract_v1(
                ExplainV1Request(submission_id=determinism_target),
                request_id="ops-smoke-1",
                idempotency_key=idempotency_key,
            )
            second = await build_explain_contract_v1(
                ExplainV1Request(submission_id=determinism_target),
                request_id="ops-smoke-2",
                idempotency_key=idempotency_key,
            )
            after = list_runs(submission_id=determinism_target, limit=100)
            run_id_same = first.run_id == second.run_id
            debug_note = str((getattr(second, "debug", None) or {}).get("note", ""))
            reused = "idempotent_reuse" in debug_note
            count_delta = len(after) - len(before)
            idempotency_ok = (run_id_same or reused) and count_delta <= 1
            details["idempotency"] = {
                "submission_id": determinism_target,
                "run_id_same": run_id_same,
                "reused": reused,
                "count_delta": count_delta,
            }
            if not idempotency_ok:
                details["errors"].append(
                    {
                        "check": "idempotency",
                        "detail": "idempotency key did not reuse run",
                    }
                )
        except Exception as exc:
            idempotency_ok = False
            details["errors"].append(
                {
                    "check": "idempotency",
                    "detail": f"idempotency failed for {determinism_target}: {type(exc).__name__}",
                }
            )
    else:
        idempotency_ok = False
        details["errors"].append({"check": "idempotency", "detail": "no submission for idempotency"})
    record_check("idempotency", idempotency_ok)

    truth_gate_ok = True
    for submission_id, result in explain_results.items():
        fired_rules = list(getattr(result, "fired_rules", []) or [])
        citations = list(getattr(result, "citations", []) or [])
        summary = str(getattr(result, "summary", "") or "")
        debug = getattr(result, "debug", None)
        if fired_rules and not citations:
            if not _truth_gate_passed(summary, debug if isinstance(debug, dict) else None):
                truth_gate_ok = False
                details["errors"].append(
                    {
                        "check": "truth_gate",
                        "detail": f"truth gate failed for {submission_id}",
                    }
                )
    record_check("truth_gate", truth_gate_ok)

    golden_suite_ok = True
    try:
        golden_path = os.path.join(
            os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))),
            "golden_cases",
            "v1",
        )
        report = await run_suite(path=golden_path, limit=10)
        golden_suite_ok = bool(report.get("ok"))
        details["golden_suite"] = {
            "total": report.get("total", 0),
            "passed": report.get("passed", 0),
            "failed": report.get("failed", 0),
            "failures": (report.get("failures") or [])[:3],
        }
        if not golden_suite_ok:
            details["errors"].append(
                {
                    "check": "golden_suite",
                    "detail": "golden suite failed",
                }
            )
    except Exception as exc:
        golden_suite_ok = False
        details["golden_suite"] = {
            "error": f"{type(exc).__name__}",
        }
        details["errors"].append(
            {
                "check": "golden_suite",
                "detail": f"golden suite failed: {type(exc).__name__}",
            }
        )
    record_check("golden_suite", golden_suite_ok)

    storage_rows = 0
    storage_size_mb = 0.0
    storage_state = "ok"
    try:
        db_path = get_explain_db_path()
        if os.path.exists(db_path):
            storage_size_mb = explain_db_size_mb(db_path)
            storage_rows = count_runs(db_path)
        hard_row_limit = 100000
        hard_size_limit_mb = 200
        warn_row_limit = int(hard_row_limit * 0.8)
        warn_size_limit_mb = hard_size_limit_mb * 0.8
        if storage_rows >= hard_row_limit or storage_size_mb >= hard_size_limit_mb:
            storage_state = "fail"
        elif storage_rows >= warn_row_limit or storage_size_mb >= warn_size_limit_mb:
            storage_state = "warn"
    except Exception as exc:
        storage_state = "warn"
        details["errors"].append(
            {
                "check": "storage_health",
                "detail": f"storage health check failed: {type(exc).__name__}",
            }
        )

    checks["storage_health"] = storage_state
    details["storage"] = {
        "rows": storage_rows,
        "size_mb": round(storage_size_mb, 2),
    }

    ok = all(value in {"ok", "warn"} for value in checks.values())

    return {
        "ok": ok,
        "checks": checks,
        "details": details,
        "timestamp": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "db_ok": db_ok,
        "schema_ok": schema_ok,
        "missing_tables": missing_tables,
        "missing_columns": missing_columns,
        "signing_enabled": signing_enabled,
        "signing_key_id": signing_key_id,
        "active_contract_present": active_contract_present,
        "routes_ok": True,
        "env": settings.APP_ENV,
        "build_sha": _build_sha() or "unknown",
    }


