from typing import List

from fastapi import APIRouter
from pydantic import BaseModel, Field

from src.api.models.decision import (
    DecisionOutcome,
    DecisionStatus,
    RegulatoryReference,
)
from src.autocomply.domain.decision_risk import compute_risk_for_status
from src.domain.license_ny_pharmacy import (
    NyPharmacyFormCopilotResponse,
    NyPharmacyFormData,
)
from src.services.license_copilot_service import run_license_copilot

router = APIRouter(tags=["license_ny_pharmacy"])


class NyPharmacyEvaluateResponse(BaseModel):
    """Response wrapper for NY Pharmacy evaluations using shared decision schema."""

    decision: DecisionOutcome
    status: DecisionStatus
    reason: str
    missing_fields: List[str] = Field(default_factory=list)
    regulatory_references: List[str] = Field(default_factory=list)


@router.post(
    "/license/ny-pharmacy/evaluate",
    response_model=NyPharmacyEvaluateResponse,
)
async def ny_pharmacy_evaluate(
    payload: NyPharmacyFormData,
) -> NyPharmacyEvaluateResponse:
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

    if not payload.ny_state_license_number.strip():
        missing.append("ny_state_license_number")

    if not payload.attestation_accepted:
        missing.append("attestation_accepted")

    if payload.ship_to_state != "NY":
        reason = "Ship-to state is not NY; NY pharmacy license does not apply."
        status = DecisionStatus.BLOCKED
    elif not payload.attestation_accepted:
        reason = "Attestation was not accepted."
        status = DecisionStatus.BLOCKED
    elif missing:
        reason = "NY Pharmacy license details are incomplete or inconsistent."
        status = DecisionStatus.NEEDS_REVIEW
    else:
        reason = "NY Pharmacy license details appear complete for this request."
        status = DecisionStatus.OK_TO_SHIP

    regulatory_references = [
        RegulatoryReference(
            id="ny-pharmacy-core",
            jurisdiction="US-NY",
            source="NY Pharmacy Board",
            label="NY pharmacy license required for dispensing controlled substances",
        )
    ]

    risk_level, risk_score = compute_risk_for_status(status.value)

    decision_outcome = DecisionOutcome(
        status=status,
        reason=reason,
        regulatory_references=regulatory_references,
        risk_level=risk_level,
        risk_score=risk_score,
        debug_info={"missing_fields": missing} if missing else None,
    )

    return NyPharmacyEvaluateResponse(
        decision=decision_outcome,
        status=decision_outcome.status,
        reason=decision_outcome.reason,
        missing_fields=missing,
        regulatory_references=[ref.id for ref in regulatory_references],
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
