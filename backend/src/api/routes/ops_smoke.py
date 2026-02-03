from __future__ import annotations

import hashlib
import os
from typing import Any, Dict

from fastapi import APIRouter

from src.config import get_settings
from src.core.db import execute_sql
from src.policy.contracts import get_active_contract

router = APIRouter(prefix="/api/ops", tags=["ops"])


SIGNING_DEV_DEFAULT = "dev-insecure-audit-signing-secret-change-in-production"


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


@router.get("/smoke")
async def ops_smoke() -> Dict[str, Any]:
    settings = get_settings()

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

    return {
        "ok": db_ok and schema_ok,
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
