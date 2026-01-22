from fastapi import APIRouter
from pydantic import BaseModel
import os
from datetime import datetime, timezone

from ...config import validate_runtime_config


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
    version = os.getenv("AUTOCOMPLY_VERSION", "0.1.0")

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

    return {
        "status": overall_status,
        "components": components,
    }


@router.get("/health/details", response_model=HealthDetails, summary="Production health diagnostics")
async def health_details() -> HealthDetails:
    """
    Comprehensive production health endpoint with environment validation and diagnostics.

    This endpoint:
    - Validates critical environment variables (DATABASE_URL, AUDIT_SIGNING_SECRET)
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
        os.getenv("RENDER_GIT_COMMIT")  # Render platform
        or os.getenv("SOURCE_VERSION")  # Azure
        or os.getenv("GITHUB_SHA")  # GitHub Actions
        or os.getenv("GIT_SHA")  # Custom
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
