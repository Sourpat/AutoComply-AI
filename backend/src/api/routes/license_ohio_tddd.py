from typing import List

from fastapi import APIRouter
from pydantic import BaseModel, Field

from src.api.models.decision import (
    DecisionOutcome,
    DecisionStatus,
    RegulatoryReference,
)
from src.domain.license_ohio_tddd import (
    OhioTdddFormCopilotResponse,
    OhioTdddFormData,
)
from src.services.license_copilot_service import run_license_copilot

router = APIRouter(tags=["license_ohio_tddd"])


class OhioTdddEvaluateResponse(BaseModel):
    """Response wrapper for Ohio TDDD evaluations using shared decision schema."""

    decision: DecisionOutcome
    status: DecisionStatus
    reason: str
    missing_fields: List[str] = Field(default_factory=list)
    regulatory_references: List[str] = Field(default_factory=list)


@router.post(
    "/license/ohio-tddd/evaluate", response_model=OhioTdddEvaluateResponse
)
async def ohio_tddd_evaluate(form: OhioTdddFormData) -> OhioTdddEvaluateResponse:
    """
    Minimal v1 evaluation for Ohio TDDD licenses.

    NOTE: This is intentionally simple and can be expanded later with more
    detailed rule logic.
    """
    missing = []

    if not form.tddd_number:
        missing.append("tddd_number")

    if form.ship_to_state != "OH":
        reason = "Ship-to state is not OH; Ohio TDDD license does not apply."
        status = DecisionStatus.BLOCKED
    elif not form.attestation_accepted:
        reason = "Attestation was not accepted."
        status = DecisionStatus.BLOCKED
    elif missing:
        reason = "Missing required fields."
        status = DecisionStatus.NEEDS_REVIEW
    else:
        reason = "Ohio TDDD license details appear complete for this request."
        status = DecisionStatus.OK_TO_SHIP

    regulatory_references = [
        RegulatoryReference(
            id="ohio-tddd-core",
            jurisdiction="US-OH",
            source="Ohio Board of Pharmacy",
            citation="OH ST § 4729.54",
            label="Ohio TDDD license required for controlled substances",
        )
    ]

    risk_level_map = {
        DecisionStatus.OK_TO_SHIP: "low",
        DecisionStatus.NEEDS_REVIEW: "medium",
        DecisionStatus.BLOCKED: "high",
    }

    decision_outcome = DecisionOutcome(
        status=status,
        reason=reason,
        regulatory_references=regulatory_references,
        risk_level=risk_level_map.get(status),
        debug_info={"missing_fields": missing} if missing else None,
    )

    return OhioTdddEvaluateResponse(
        decision=decision_outcome,
        status=decision_outcome.status,
        reason=decision_outcome.reason,
        missing_fields=missing,
        regulatory_references=[ref.id for ref in regulatory_references],
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
