from fastapi import APIRouter

from src.domain.license_ny_pharmacy import (
    NyPharmacyDecision,
    NyPharmacyFormCopilotResponse,
    NyPharmacyFormData,
)
from src.services.license_copilot_service import run_license_copilot

router = APIRouter(tags=["license_ny_pharmacy"])


@router.post(
    "/license/ny-pharmacy/evaluate",
    response_model=NyPharmacyDecision,
)
async def ny_pharmacy_evaluate(
    payload: NyPharmacyFormData,
) -> NyPharmacyDecision:
    """
    Simple NY Pharmacy license evaluation.

    Rules (for prototype):
    - ship_to_state must be "NY"
    - ny_state_license_number must be non-empty
    - attestation_accepted must be True

    If any required condition fails → needs_review.
    In a real system, additional checks would look up license registries, expirations, etc.
    """
    missing: list[str] = []

    if payload.ship_to_state != "NY":
        missing.append("ship_to_state must be NY for ny_pharmacy engine")

    if not payload.ny_state_license_number.strip():
        missing.append("ny_state_license_number")

    if not payload.attestation_accepted:
        missing.append("attestation_accepted")

    if missing:
        return NyPharmacyDecision(
            status="needs_review",
            reason="NY Pharmacy license details are incomplete or inconsistent.",
            missing_fields=missing,
        )

    # Prototype: if the basic fields are present, we consider this ok_to_ship.
    return NyPharmacyDecision(
        status="ok_to_ship",
        reason="NY Pharmacy license details appear complete for this request.",
        missing_fields=[],
    )


@router.post(
    "/license/ny-pharmacy/form-copilot",
    response_model=NyPharmacyFormCopilotResponse,
)
async def ny_pharmacy_form_copilot(
    payload: NyPharmacyFormData,
) -> NyPharmacyFormCopilotResponse:
    """
    RAG-based copilot for NY Pharmacy licenses.

    Uses the shared run_license_copilot helper with:
    - license_type = "ny_pharmacy"
    - doc_id = "ny_pharmacy_rules" (placeholder RAG document ID)
    """
    copilot_request = {
        "license_type": "ny_pharmacy",
        "doc_id": "ny_pharmacy_rules",
        "pharmacy_name": payload.pharmacy_name,
        "account_number": payload.account_number,
        "ship_to_state": payload.ship_to_state,
        "dea_number": payload.dea_number,
        "ny_state_license_number": payload.ny_state_license_number,
        "attestation_accepted": payload.attestation_accepted,
        "internal_notes": payload.internal_notes,
    }

    rag_result = await run_license_copilot(copilot_request)

    return NyPharmacyFormCopilotResponse(
        status=rag_result.status,
        reason=rag_result.reason,
        missing_fields=rag_result.missing_fields,
        regulatory_references=rag_result.regulatory_references,
        rag_explanation=rag_result.rag_explanation,
        artifacts_used=rag_result.artifacts_used,
        rag_sources=rag_result.rag_sources,
    )
