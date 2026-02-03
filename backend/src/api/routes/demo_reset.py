from __future__ import annotations

import logging
import os
from typing import Any, Dict

from fastapi import APIRouter, HTTPException, Request

from app.middleware.request_id import get_request_id
from src.autocomply.audit.decision_log import get_decision_log
from src.config import get_settings
from src.api.dependencies.auth import DEV_SEED_HEADER
from src.core.db import execute_sql, execute_update

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["demo"])


def _table_exists(table_name: str) -> bool:
    rows = execute_sql(
        "SELECT name FROM sqlite_master WHERE type='table' AND name = :table_name",
        {"table_name": table_name},
    )
    return bool(rows)


def _count_rows(table_name: str) -> int:
    rows = execute_sql(f"SELECT COUNT(1) AS count FROM {table_name}")
    if not rows:
        return 0
    return int(rows[0].get("count") or 0)


def _delete_table(table_name: str) -> int:
    if not _table_exists(table_name):
        return 0

    count = _count_rows(table_name)
    if count == 0:
        return 0

    execute_update(f"DELETE FROM {table_name}")
    return count


def _build_sha() -> str | None:
    return (
        os.getenv("RENDER_GIT_COMMIT")
        or os.getenv("SOURCE_VERSION")
        or os.getenv("GITHUB_SHA")
        or os.getenv("GIT_SHA")
        or os.getenv("COMMIT_SHA")
    )


@router.post("/demo/reset")
async def reset_demo(request: Request) -> Dict[str, Any]:
    """
    DEV-ONLY demo reset for recruiter demos.

    Clears workflow data while preserving policy contracts and schema.
    In production, requires X-Dev-Seed-Token to match DEV_SEED_TOKEN.
    """
    settings = get_settings()
    token_header = request.headers.get(DEV_SEED_HEADER)

    if settings.is_production:
        if not settings.DEV_SEED_TOKEN or token_header != settings.DEV_SEED_TOKEN:
            raise HTTPException(status_code=403, detail="Demo reset disabled in production")

    tables_to_clear = [
        "audit_events",
        "audit_packets",
        "case_decisions",
        "case_events",
        "case_notes",
        "cases",
        "evidence_items",
        "intelligence_history",
        "policy_overrides",
        "request_info_responses",
        "submissions",
        "agentic_case_events",
        "agentic_case_state",
        "agentic_cases",
        "attachments",
    ]

    counts: Dict[str, int] = {}
    for table in tables_to_clear:
        try:
            counts[table] = _delete_table(table)
        except Exception as exc:
            logger.warning("Demo reset skip table %s: %s", table, exc)
            counts[table] = 0

    # Clear in-memory decision audit log (non-persistent)
    try:
        get_decision_log().clear()
        counts["decision_log_entries"] = 0
    except Exception as exc:
        logger.warning("Demo reset failed to clear decision log: %s", exc)

    # Re-seed demo baseline cases if available
    seeded_cases = 0
    try:
        from app.dev.seed_demo import seed_demo_data

        seeded_cases = seed_demo_data()
    except Exception as exc:
        logger.warning("Demo reset seed skipped: %s", exc)

    counts["seeded_cases"] = seeded_cases

    return {
        "ok": True,
        "mode": "cleared",
        "counts": counts,
        "request_id": get_request_id(request),
        "env": settings.APP_ENV,
        "build_sha": _build_sha() or "unknown",
    }
