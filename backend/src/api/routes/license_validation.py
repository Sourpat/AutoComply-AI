"""REST endpoints for license validation flows."""
import asyncio

from fastapi import APIRouter, File, UploadFile

from src.api.models.compliance_models import LicenseValidationRequest, LicenseValidationResponse
from src.compliance.decision_engine import ComplianceEngine
from src.utils.events import get_event_publisher
from src.ocr.extract import extract_license_fields_from_pdf

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


@router.post("/validate-pdf")
async def validate_license_pdf(file: UploadFile = File(...)):
    """
    Endpoint for PDF-based license validation.

    Contract:
    - Accepts a single PDF file upload.
    - Uses the OCR layer to extract license-like fields.
    - Returns a structured response compatible with the JSON validation endpoint.
    """

    pdf_bytes = await file.read()
    if not pdf_bytes:
        return {
            "success": False,
            "verdict": {
                "allow_checkout": False,
                "reason": "Empty file received.",
            },
        }

    extracted = extract_license_fields_from_pdf(pdf_bytes)

    if not extracted:
        return {
            "success": False,
            "verdict": {
                "allow_checkout": False,
                "reason": "Unable to extract license details from PDF.",
            },
        }

    dummy_verdict = {
        "license_id": extracted.get("license_id"),
        "state": extracted.get("state"),
        "allow_checkout": True,
        "reason": "Stubbed PDF validation – replace with real OCR + compliance engine.",
        "practitioner_name": extracted.get("practitioner_name"),
        "expiry": extracted.get("expiry"),
    }

    response = {
        "success": True,
        "verdict": dummy_verdict,
    }

    return response
