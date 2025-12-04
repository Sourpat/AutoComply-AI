from datetime import date
from typing import List, Optional

from fastapi import APIRouter
from pydantic import BaseModel, Field

from src.api.models.decision import DecisionOutcome, DecisionStatus, RegulatoryReference
from src.autocomply.domain.decision_risk import compute_risk_for_status
from src.autocomply.regulations.knowledge import get_regulatory_knowledge
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
    knowledge = get_regulatory_knowledge()
    missing: list[str] = []

    license_number = (payload.ny_state_license_number or "").strip() or (
        payload.license_number or ""
    ).strip()
    if not license_number:
        missing.append("ny_state_license_number")

    if not payload.attestation_accepted:
        missing.append("attestation_accepted")

    ship_to_state = payload.ship_to_state
    parsed_expiration: Optional[date] = None
    if payload.expiration_date:
        parsed_expiration = payload.expiration_date

    is_in_ny = ship_to_state == "NY"
    is_expired = bool(parsed_expiration and parsed_expiration < date.today())

    if not is_in_ny:
        status = DecisionStatus.NEEDS_REVIEW
        reason = (
            "Ship-to state is not New York; NY pharmacy license may not be sufficient. "
            "Confirm appropriate licensing for the destination state."
        )
    elif is_expired:
        status = DecisionStatus.BLOCKED
        reason = "NY pharmacy license is expired and cannot be used for controlled substances."
    elif missing:
        status = DecisionStatus.NEEDS_REVIEW
        reason = "NY Pharmacy license details are incomplete or inconsistent."
    else:
        status = DecisionStatus.OK_TO_SHIP
        reason = "NY pharmacy license is active and matches the ship-to location."

    evidence_items = knowledge.get_regulatory_evidence(
        decision_type="license_ny_pharmacy",
        jurisdiction="US-NY",
        doc_ids=None,
        context={
            "license_number": license_number,
            "ship_to_state": ship_to_state,
        },
    )

    regulatory_references = [item.reference for item in evidence_items]

    risk_level, risk_score = compute_risk_for_status(status.value)

    debug_info = {
        "missing_fields": missing,
        "regulatory_evidence_count": len(evidence_items),
    }

    if not missing:
        # Preserve prior behavior of omitting missing_fields when empty
        debug_info.pop("missing_fields")

    decision_outcome = DecisionOutcome(
        status=status,
        reason=reason,
        regulatory_references=regulatory_references,
        risk_level=risk_level,
        risk_score=risk_score,
        debug_info=debug_info or None,
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
