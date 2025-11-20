"""REST endpoints for license validation flows."""
import asyncio

from fastapi import APIRouter

from src.api.models.compliance_models import LicenseValidationRequest, LicenseValidationResponse
from src.compliance.decision_engine import ComplianceEngine
from src.utils.events import get_event_publisher

router = APIRouter(prefix="/licenses", tags=["licenses"])


@router.get("/{license_id}")
def get_license_status(license_id: str) -> dict[str, str]:
    """Stubbed endpoint that will eventually surface validation decisions."""
    return {"license_id": license_id, "status": "pending"}


@router.post(
    "/validate/license",
    response_model=LicenseValidationResponse,
    summary="Validate a license via JSON payload",
)
async def validate_license(payload: LicenseValidationRequest) -> dict:
    """Validate a license based on JSON/manual input from the frontend."""
    engine = ComplianceEngine()
    verdict = engine.evaluate(payload)
    verdict_dict = verdict.dict()

    response = {
        "success": True,
        "verdict": verdict_dict,
    }

    # --- Fire-and-forget event to n8n (optional) ---
    publisher = get_event_publisher()

    if isinstance(response, dict):
        verdict = response.get("verdict") or {}
        payload = {
            "event": "license_validation",
            "success": bool(response.get("success", True)),
            "license_id": verdict.get("license_id"),
            "state": verdict.get("state"),
            "allow_checkout": verdict.get("allow_checkout"),
        }

        # Do not block the API on alert errors
        asyncio.create_task(publisher.send_slack_alert(payload))

    return response
