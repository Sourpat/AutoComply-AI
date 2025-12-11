from datetime import date
from types import SimpleNamespace
from typing import List, Optional

from fastapi import APIRouter, Request
from pydantic import BaseModel, Field

from src.api.models.compliance_models import RegulatorySource
from src.api.models.decision import DecisionOutcome, DecisionStatus, RegulatoryReference
from src.autocomply.audit.decision_log import get_decision_log
from src.autocomply.domain.decision_risk import compute_risk_for_status
from src.autocomply.domain.ny_pharmacy_decision import (
    build_ny_pharmacy_decision,
    is_license_expired,
)
from src.autocomply.domain.trace import TRACE_HEADER_NAME, ensure_trace_id
from src.explanations.builder import build_explanation
from src.autocomply.regulations.knowledge import (
    get_regulatory_knowledge,
    sources_to_regulatory_references,
)
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
    artifacts_used: List[str] = Field(default_factory=list)
    rag_sources: List[RegulatorySource] = Field(default_factory=list)


@router.post(
    "/license/ny-pharmacy/evaluate",
    response_model=NyPharmacyEvaluateResponse,
)
async def ny_pharmacy_evaluate(
    payload: NyPharmacyFormData,
    request: Request,
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
    incoming_trace_id = request.headers.get(TRACE_HEADER_NAME)
    trace_id = ensure_trace_id(incoming_trace_id)

    missing: list[str] = []

    license_number = (payload.ny_state_license_number or "").strip() or (
        payload.license_number or ""
    ).strip()
    if not license_number:
        missing.append("ny_state_license_number")

    if not payload.attestation_accepted:
        missing.append("attestation_accepted")

    ship_to_state = payload.ship_to_state
    parsed_expiration: Optional[date] = payload.expiration_date

    is_in_ny = (ship_to_state or "").upper() == "NY"
    is_expired = is_license_expired(parsed_expiration)

    base_reason = "NY pharmacy license check completed."
    decision_outcome = build_ny_pharmacy_decision(
        is_expired=is_expired,
        is_ny_ship_to=is_in_ny,
        base_reason=base_reason,
        trace_id=trace_id,
    )

    if missing:
        status = DecisionStatus.NEEDS_REVIEW
        risk_level, risk_score = compute_risk_for_status(status.value)
        decision_outcome.status = status
        decision_outcome.reason = "NY Pharmacy license details are incomplete or inconsistent."
        decision_outcome.risk_level = risk_level
        decision_outcome.risk_score = risk_score

    status = decision_outcome.status
    reason = decision_outcome.reason
    risk_level, risk_score = decision_outcome.risk_level, decision_outcome.risk_score
    knowledge = get_regulatory_knowledge()

    rag_sources = knowledge.get_context_for_engine(
        engine_family="license", decision_type="license_ny_pharmacy"
    )
    if not rag_sources:
        rag_sources = knowledge.get_sources_for_doc_ids(["ny_pharmacy_core"])

    regulatory_references = sources_to_regulatory_references(rag_sources)
    regulatory_reference_ids = [ref.id for ref in regulatory_references]
    artifacts_used = list(regulatory_reference_ids)

    debug_info = {
        "missing_fields": missing,
        "engine_family": "license",
        "decision_type": "license_ny_pharmacy",
        "regulatory_evidence_count": len(rag_sources),
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
        rag_sources=rag_sources,
        trace_id=trace_id,
        debug_info=debug_info or None,
    )

    explanation_context = SimpleNamespace(
        status=status.value if hasattr(status, "value") else status,
        missing_fields=missing,
        rag_sources=rag_sources,
        debug_info=debug_info,
        reason=decision_outcome.reason,
    )

    decision_reason = build_explanation(
        decision=explanation_context,
        jurisdiction="New York",
        vertical_name="NY Pharmacy vertical",
        rag_sources=rag_sources,
    )
    decision_outcome.reason = decision_reason
    reason = decision_reason

    decision_log = get_decision_log()
    decision_log.record(
        trace_id=decision_outcome.trace_id or trace_id,
        engine_family="license",
        decision_type="license_ny_pharmacy",
        decision=decision_outcome,
    )

    return NyPharmacyEvaluateResponse(
        decision=decision_outcome,
        status=decision_outcome.status,
        reason=decision_outcome.reason,
        missing_fields=missing,
        regulatory_references=regulatory_reference_ids,
        artifacts_used=artifacts_used,
        rag_sources=rag_sources,
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
