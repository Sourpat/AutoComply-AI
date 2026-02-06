from fastapi import APIRouter
from pydantic import BaseModel
import os
from datetime import datetime, timezone

from ...config import validate_runtime_config
from ...core.db import execute_sql


class HealthStatus(BaseModel):
    status: str  # "ok" | "degraded" | "down"
    service: str
    version: str
    checks: dict


class HealthDetails(BaseModel):
    """Comprehensive production health diagnostics."""

    ok: bool
    version: str
    environment: str
    commit_sha: str | None
    build_time: str | None
    config: dict
    missing_env: list[str]
    warnings: list[str]


router = APIRouter(tags=["health"])


@router.get("/healthz")
async def healthz() -> dict:
    """
    Ultra-fast health check endpoint for load balancers and orchestrators.
    
    - Does NOT touch database
    - Does NOT check RAG features
    - Does NOT call external services
    - Returns immediately with 200 OK
    
    Use this for:
    - Render.com health checks
    - Kubernetes liveness/readiness probes
    - Load balancer health monitoring
    
    For detailed health status, use /health or /health/full instead.
    """
    return {"status": "ok"}


@router.get("/health", response_model=HealthStatus)
async def health_check() -> HealthStatus:
    """
    Simple health endpoint for AutoComply AI.

    For this prototype, we:
    - Always report status="ok" if the app is reachable.
    - Include minimal metadata (service name, version).
    - Provide a 'checks' dict that can be extended later
      (e.g., to include RAG, DB, external LLM provider, etc.).
    """
    version = os.getenv("APP_VERSION") or os.getenv("AUTOCOMPLY_VERSION", "0.1.0")

    checks = {
        "fastapi": "ok",
        "csf_suite": "ok",  # future: deeper checks
        "license_suite": "ok",  # future: deeper checks
        "rag_layer": "ok",  # future: deeper checks
    }

    return HealthStatus(
        status="ok",
        service="autocomply-ai",
        version=version,
        checks=checks,
    )


@router.get("/health/full", summary="System health (aggregated)")
async def health_full() -> dict:
    """
    Returns a lightweight, high-level health summary for major engine families.

    This is intentionally cheap: no calls to OpenAI or external systems.
    """

    components = {
        "csf_engine": {
            "status": "ok",
            "details": "CSF routers and domain types imported successfully.",
        },
        "license_engine": {
            "status": "ok",
            "details": "License evaluation routes wired and importable.",
        },
        "mock_orders": {
            "status": "ok",
            "details": "Mock order approval endpoints are registered.",
        },
    }

    overall_status = (
        "ok"
        if all(c.get("status") == "ok" for c in components.values())
        else "degraded"
    )

    build_sha = os.getenv("GIT_SHA", "unknown")

    return {
        "status": overall_status,
        "build_sha": build_sha,
        "components": components,
    }


@router.get("/health/db", summary="Database schema health")
async def health_db() -> dict:
    required_tables = [
        "cases",
        "submissions",
        "audit_events",
        "intelligence_history",
        "policy_overrides",
        "ai_decision_contract",
    ]

    required_columns = {
        "cases": ["trace_id", "submission_id"],
        "audit_events": ["payload_json"],
        "intelligence_history": [
            "trace_id",
            "span_id",
            "parent_span_id",
            "span_name",
            "span_kind",
            "duration_ms",
            "error_text",
            "trace_metadata_json",
        ],
        "policy_overrides": [
            "trace_id",
            "submission_id",
            "override_action",
            "rationale",
            "reviewer",
            "created_at",
        ],
        "ai_decision_contract": [
            "version",
            "status",
            "effective_from",
            "rules_json",
        ],
    }

    existing_tables = execute_sql(
        "SELECT name FROM sqlite_master WHERE type='table'"
    )
    table_names = {row.get("name") for row in existing_tables if row.get("name")}
    missing_tables = [table for table in required_tables if table not in table_names]

    missing_columns: list[str] = []
    for table, columns in required_columns.items():
        if table in missing_tables:
            continue
        rows = execute_sql(f"PRAGMA table_info({table})")
        existing_columns = {row.get("name") for row in rows if row.get("name")}
        for column in columns:
            if column not in existing_columns:
                missing_columns.append(f"{table}.{column}")

    ok = not missing_tables and not missing_columns
    return {
        "ok": ok,
        "missing_tables": missing_tables,
        "missing_columns": missing_columns,
    }


@router.get("/health/details", response_model=HealthDetails, summary="Production health diagnostics")
async def health_details() -> HealthDetails:
    """
    Comprehensive production health endpoint with environment validation and diagnostics.

    This endpoint:
    - Validates critical environment variables (DATABASE_URL, AUDIT_SIGNING_KEY)
    - Reports configuration status without leaking secrets (boolean flags only)
    - Always returns 200 status code if service is up
    - Sets ok=false when critical env vars are missing or invalid
    - Provides warnings for non-critical issues

    Use this for:
    - Production readiness checks
    - Deployment guardrails and validation
    - Automated smoke testing
    - Monitoring configuration drift

    Never returns:
    - Actual secret values
    - API keys or tokens
    - Database connection strings

    Always returns:
    - Boolean flags for feature status
    - List of missing critical env vars (names only)
    - List of warnings for non-critical issues
    - Version, environment, and build metadata
    """
    # Get validation results
    validation = validate_runtime_config()

    # Get version and build metadata
    version = os.getenv("AUTOCOMPLY_VERSION", "0.1.0")
    environment = os.getenv("APP_ENV", "dev")
    
    # Check multiple env var sources for commit SHA (platform-specific)
    commit_sha = (
        os.getenv("GIT_SHA")  # Custom
        or os.getenv("GITHUB_SHA")  # GitHub Actions
        or os.getenv("RENDER_GIT_COMMIT")  # Render platform
        or os.getenv("SOURCE_VERSION")  # Azure
        or os.getenv("COMMIT_SHA")  # Generic
    )
    
    # Check multiple env var sources for build time
    build_time = (
        os.getenv("BUILD_TIME")  # Custom
        or os.getenv("RENDER_BUILD_TIME")  # Render (if they provide it)
        or os.getenv("BUILD_TIMESTAMP")  # Generic
    )

    return HealthDetails(
        ok=validation["ok"],
        version=version,
        environment=environment,
        commit_sha=commit_sha,
        build_time=build_time,
        config=validation["config"],
        missing_env=validation["missing_env"],
        warnings=validation["warnings"],
    )
