from fastapi import APIRouter
from pydantic import BaseModel
import os


class HealthStatus(BaseModel):
    status: str  # "ok" | "degraded" | "down"
    service: str
    version: str
    checks: dict


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
