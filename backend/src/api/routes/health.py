from fastapi import APIRouter
from pydantic import BaseModel
import os


class HealthStatus(BaseModel):
    status: str  # "ok" | "degraded" | "down"
    service: str
    version: str
    checks: dict


router = APIRouter(tags=["health"])


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
