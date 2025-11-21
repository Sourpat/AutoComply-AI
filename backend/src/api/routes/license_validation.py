# backend/src/api/routes/license_validation.py

from __future__ import annotations

import asyncio
from datetime import date, timedelta

from fastapi import APIRouter, File, HTTPException, UploadFile

from src.api.models.compliance_models import (
    LicenseValidationRequest,
    LicenseValidationResponse,
)
from src.compliance.decision_engine import ComplianceEngine
from src.ocr.extract import extract_text_from_pdf
from src.utils.events import get_event_publisher

router = APIRouter(
    prefix="/api/v1/licenses",
    tags=["license-validation"],
)


@router.post(
    "/validate/license",
    response_model=LicenseValidationResponse,
    summary="Validate a license via JSON/manual payload",
)
async def validate_license(payload: LicenseValidationRequest) -> dict:
    """
    Validate a license based on JSON/manual input from the frontend.

    This is the primary endpoint used by the manual entry form.
    It delegates to the ComplianceEngine for deterministic decisions
    and also emits a non-blocking event that can be consumed by n8n
    or other automation tools.
    """
    engine = ComplianceEngine()
    verdict = engine.evaluate(payload)
    verdict_dict = verdict.dict()

    response: dict = {
        "success": True,
        "verdict": verdict_dict,
    }

    # --- Fire-and-forget event to n8n (optional) ---
    publisher = get_event_publisher()

    if isinstance(response, dict):
        v = response.get("verdict") or {}
        event_payload = {
            "event": "license_validation",
            "success": bool(response.get("success", True)),
            "license_id": v.get("license_id"),
            "state": v.get("state"),
            "allow_checkout": v.get("allow_checkout"),
        }

        # Do not block the API on alert errors
        try:
            asyncio.create_task(publisher.send_slack_alert(event_payload))
        except Exception:
            # In demo/CI, we never want alert failures to break validation.
            # Logging is handled inside EventPublisher.
            pass

    return response


@router.post(
    "/validate-pdf",
    summary="Validate a license from an uploaded PDF",
)
async def validate_license_pdf(file: UploadFile = File(...)) -> dict:
    """
    Validate a license based on an uploaded PDF.

    For now this endpoint:
    - Uses the OCR stub to extract raw text from the PDF.
    - Builds a best-effort LicenseValidationRequest with safe defaults.
    - Runs the same ComplianceEngine used by the JSON/manual path.
    - Returns the engine verdict plus an `extracted_fields` block
      that the frontend can show under “Extracted from document”.

    This keeps the pipeline realistic for demos without requiring
    a fully production OCR/NLP stack.
    """
    if not file:
        raise HTTPException(status_code=400, detail="PDF file is required.")

    # Basic content-type guard. We keep it permissive for tests/demos.
    if file.content_type not in (
        "application/pdf",
        "application/octet-stream",
        "binary/octet-stream",
        "",
        None,
    ):
        raise HTTPException(status_code=400, detail="Only PDF uploads are supported.")

    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    # --- OCR stub: get raw text from PDF bytes ---
    try:
        raw_text = extract_text_from_pdf(file_bytes)
    except Exception as exc:
        # In a real system we'd log + return a structured error.
        # For this demo we keep it simple but still return 200 with a safe verdict.
        raw_text = f"OCR_ERROR: {exc}"

    text_preview = (raw_text or "").strip()
    if len(text_preview) > 400:
        text_preview = text_preview[:400] + "…"

    # Minimal extracted info we expose to the frontend.
    extracted_fields = {
        "file_name": file.filename or "uploaded.pdf",
        "text_preview": text_preview or "[no text extracted]",
        "character_count": len(raw_text or ""),
    }

    # --- Build a safe default LicenseValidationRequest ---
    # For now we do not attempt full field parsing from the PDF.
    # Instead we route everything through the same engine using
    # deterministic, demo-friendly defaults.
    today = date.today()
    default_expiry = today + timedelta(days=365)

    license_payload = LicenseValidationRequest(
        practice_type="Standard",
        state="CA",
        state_permit="AUTO-PDF-PERMIT",
        state_expiry=default_expiry,
        purchase_intent="GeneralMedicalUse",
        quantity=1,
    )

    engine = ComplianceEngine()
    verdict = engine.evaluate(license_payload)
    verdict_dict = verdict.dict()

    return {
        "success": True,
        "verdict": verdict_dict,
        "extracted_fields": extracted_fields,
    }
