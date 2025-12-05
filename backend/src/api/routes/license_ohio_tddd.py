from datetime import date
from typing import List, Optional

from fastapi import APIRouter, Request
from pydantic import BaseModel, Field

from src.api.models.decision import DecisionOutcome, DecisionStatus
from src.autocomply.audit.decision_log import get_decision_log
from src.autocomply.domain.decision_risk import compute_risk_for_status
from src.autocomply.domain.ohio_tddd_decision import build_ohio_tddd_decision
from src.autocomply.domain.trace import TRACE_HEADER_NAME, ensure_trace_id
from src.autocomply.regulations.knowledge import get_regulatory_knowledge
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
async def ohio_tddd_evaluate(
    form: OhioTdddFormData, request: Request
) -> OhioTdddEvaluateResponse:
    """
    Minimal v1 evaluation for Ohio TDDD licenses.

    NOTE: This is intentionally simple and can be expanded later with more
    detailed rule logic.
    """
    incoming_trace_id = request.headers.get(TRACE_HEADER_NAME)
    trace_id = ensure_trace_id(incoming_trace_id)

    missing = []

    license_number = form.normalized_license_number
    if not license_number:
        missing.append("tddd_number")

    parsed_expiration: Optional[date] = None
    if form.expiration_date:
        try:
            parsed_expiration = (
                form.expiration_date
                if isinstance(form.expiration_date, date)
                else date.fromisoformat(str(form.expiration_date))
            )
        except ValueError:
            missing.append("expiration_date")
    else:
        missing.append("expiration_date")

    today = date.today()
    is_in_state = form.ship_to_state.strip().upper() == "OH"

    if not is_in_state:
        status = DecisionStatus.NEEDS_REVIEW
        reason = "Ship-to state is not Ohio; TDDD logic may not fully apply."
    elif not form.attestation_accepted:
        reason = "Attestation was not accepted."
        status = DecisionStatus.BLOCKED
    elif missing and "expiration_date" in missing:
        reason = "Expiration date not provided for Ohio TDDD license; manual review required."
        status = DecisionStatus.NEEDS_REVIEW
    elif missing:
        reason = "Missing required fields."
        status = DecisionStatus.NEEDS_REVIEW
    elif parsed_expiration and parsed_expiration < today:
        reason = (
            "Ohio TDDD license is expired and cannot be used for controlled substances."
        )
        status = DecisionStatus.BLOCKED
    else:
        reason = "License active and matches Ohio TDDD requirements."
        status = DecisionStatus.OK_TO_SHIP

    risk_level, risk_score = compute_risk_for_status(status.value)

    knowledge = get_regulatory_knowledge()

    evidence_items = knowledge.get_regulatory_evidence(
        decision_type="license_ohio_tddd",
        jurisdiction="US-OH",
        doc_ids=["ohio-tddd-core"],
        context={
            "license_number": license_number,
            "ship_to_state": form.ship_to_state,
        },
    )

    regulatory_references = [item.reference for item in evidence_items]

    if not missing and form.attestation_accepted:
        decision_outcome = build_ohio_tddd_decision(
            is_expired=bool(parsed_expiration and parsed_expiration < today),
            is_ohio_ship_to=is_in_state,
            base_reason="Ohio TDDD check completed.",
            regulatory_references=regulatory_references,
            trace_id=trace_id,
            debug_info={
                "missing_fields": None,
                "engine_family": "license",
                "decision_type": "license_ohio_tddd",
                "regulatory_evidence_count": len(evidence_items),
            },
        )
    else:
        decision_outcome = DecisionOutcome(
            status=status,
            reason=reason,
            regulatory_references=regulatory_references,
            risk_level=risk_level,
            risk_score=risk_score,
            trace_id=trace_id,
            debug_info={
                "missing_fields": missing or None,
                "engine_family": "license",
                "decision_type": "license_ohio_tddd",
                "regulatory_evidence_count": len(evidence_items),
            },
        )

    decision_log = get_decision_log()
    decision_log.record(
        trace_id=decision_outcome.trace_id or trace_id,
        engine_family="license",
        decision_type="license_ohio_tddd",
        decision=decision_outcome,
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
