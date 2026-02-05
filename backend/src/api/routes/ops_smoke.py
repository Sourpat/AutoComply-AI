from __future__ import annotations

import hashlib
import os
from datetime import datetime, timezone
from typing import Any, Dict, List

from fastapi import APIRouter

from app.submissions.seed import seed_demo_submissions
from src.autocomply.domain.submissions_store import get_submission_store
from src.config import get_settings
from src.core.db import execute_sql
from src.policy.contracts import get_active_contract
from src.api.routes.rag_regulatory import ExplainV1Request, explain_contract_v1

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
            explain = await explain_contract_v1(ExplainV1Request(submission_id=submission_id))
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
            first = await explain_contract_v1(ExplainV1Request(submission_id=determinism_target))
            second = await explain_contract_v1(ExplainV1Request(submission_id=determinism_target))
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

    ok = all(value == "ok" for value in checks.values())

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
