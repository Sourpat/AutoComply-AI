from fastapi import APIRouter

from src.domain.license_ohio_tddd import (
    OhioTdddDecision,
    OhioTdddFormCopilotResponse,
    OhioTdddFormData,
)
from src.services.license_copilot_service import run_license_copilot

router = APIRouter(tags=["license_ohio_tddd"])


@router.post("/license/ohio-tddd/evaluate", response_model=OhioTdddDecision)
async def ohio_tddd_evaluate(form: OhioTdddFormData) -> OhioTdddDecision:
    """
    Minimal v1 evaluation for Ohio TDDD licenses.

    NOTE: This is intentionally simple and can be expanded later with more
    detailed rule logic.
    """
    missing = []

    if not form.tddd_number:
        missing.append("tddd_number")

    if form.ship_to_state != "OH":
        reason = "Ship-to state is not OH; Ohio TDDD may not be sufficient."
        status = "needs_review"
    elif not form.attestation_accepted:
        reason = "Attestation was not accepted."
        status = "blocked"
    elif missing:
        reason = "Missing required fields."
        status = "needs_review"
    else:
        reason = "Ohio TDDD license details appear complete for this request."
        status = "ok_to_ship"

    return OhioTdddDecision(
        status=status,
        reason=reason,
        missing_fields=missing,
    )


@router.post(
    "/license/ohio-tddd/form-copilot",
    response_model=OhioTdddFormCopilotResponse,
)
async def ohio_tddd_form_copilot(
    form: OhioTdddFormData,
) -> OhioTdddFormCopilotResponse:
    """
    RAG-based explanation for Ohio TDDD license compliance.
    """
    copilot_request = {
        "license_type": "ohio_tddd",
        "tddd_number": form.tddd_number,
        "facility_name": form.facility_name,
        "account_number": form.account_number,
        "ship_to_state": form.ship_to_state,
        "attestation_accepted": form.attestation_accepted,
        "internal_notes": form.internal_notes,
    }

    rag_result = await run_license_copilot(copilot_request)

    return OhioTdddFormCopilotResponse(
        status=rag_result.status,
        reason=rag_result.reason,
        missing_fields=rag_result.missing_fields,
        regulatory_references=rag_result.regulatory_references,
        rag_explanation=rag_result.rag_explanation,
        artifacts_used=rag_result.artifacts_used,
        rag_sources=rag_result.rag_sources,
    )
