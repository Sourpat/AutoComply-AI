"""REST endpoints for license validation flows."""
import asyncio
from typing import Optional

from fastapi import APIRouter, Request

from src.api.models.compliance_models import LicenseValidationRequest, LicenseValidationResponse
from src.compliance.decision_engine import ComplianceEngine
from src.utils.events import get_event_publisher
from src.ocr.extract import extract_license_fields_from_pdf

router = APIRouter(prefix="/licenses", tags=["licenses"])
singular_router = APIRouter(prefix="/license", tags=["licenses"])


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
async def validate_license_pdf(request: Request):
    """
    Endpoint for PDF-based license validation.

    Contract:
    - Accepts a single PDF file upload.
    - Uses the OCR layer to extract license-like fields.
    - Returns a structured response compatible with the JSON validation endpoint.
    """

    pdf_bytes = await _extract_file_bytes(request)
    return await _build_pdf_validation_response(pdf_bytes)


@singular_router.post("/validate-pdf")
async def validate_license_pdf_singular(request: Request):
    """Fallback parser for environments without python-multipart installed."""

    pdf_bytes = await _extract_file_bytes(request)
    return await _build_pdf_validation_response(pdf_bytes)


async def _extract_file_bytes(request: Request) -> Optional[bytes]:
    content_type = request.headers.get("content-type", "")
    if "boundary=" not in content_type:
        return None

    boundary = content_type.split("boundary=")[-1]
    delimiter = f"--{boundary}".encode()

    body = await request.body()
    parts = [part for part in body.split(delimiter) if part.strip() not in (b"", b"--")]

    for part in parts:
        cleaned = part.strip()
        if b"\r\n\r\n" not in cleaned:
            continue

        headers_raw, content = cleaned.split(b"\r\n\r\n", 1)
        if b"content-disposition" not in headers_raw.lower():
            continue

        return content.rstrip(b"\r\n--")

    return None


async def _build_pdf_validation_response(pdf_bytes: Optional[bytes]):
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
