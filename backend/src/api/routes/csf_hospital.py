from typing import List

from fastapi import APIRouter
from pydantic import BaseModel, Field

from src.api.models.copilot import CsfCopilotResponse, CsfCopilotSuggestion
from src.api.models.decision import (
    DecisionOutcome,
    DecisionStatus,
    RegulatoryReference,
)
from src.autocomply.domain.csf_copilot import CsfCopilotResult, run_csf_copilot
from src.autocomply.domain.csf_hospital import HospitalCsfForm, evaluate_hospital_csf
from src.autocomply.domain.decision_risk import compute_risk_for_status
from src.utils.logger import get_logger

router = APIRouter(
    prefix="/csf/hospital",
    tags=["csf_hospital"],
)

logger = get_logger(__name__)


class HospitalCsfEvaluateResponse(BaseModel):
    """Response wrapper for Hospital CSF evaluations.

    Maintains legacy root-level fields for backward compatibility while also
    exposing the unified ``decision`` payload for new consumers.
    """

    decision: DecisionOutcome
    status: DecisionStatus
    reason: str
    missing_fields: List[str] = Field(default_factory=list)
    regulatory_references: List[str] = Field(default_factory=list)


@router.post("/evaluate", response_model=HospitalCsfEvaluateResponse)
async def evaluate_hospital_csf_endpoint(
    form: HospitalCsfForm,
) -> HospitalCsfEvaluateResponse:
    """
    Evaluate a Hospital Pharmacy Controlled Substance Form and return a decision.
    """
    decision = evaluate_hospital_csf(form)

    status_map = {
        "ok_to_ship": DecisionStatus.OK_TO_SHIP,
        "blocked": DecisionStatus.BLOCKED,
        "manual_review": DecisionStatus.NEEDS_REVIEW,
    }
    normalized_status = status_map.get(decision.status.value, DecisionStatus.NEEDS_REVIEW)

    regulatory_references = [
        RegulatoryReference(id=ref, label=ref) for ref in decision.regulatory_references or []
    ]

    risk_level, risk_score = compute_risk_for_status(normalized_status.value)

    decision_outcome = DecisionOutcome(
        status=normalized_status,
        reason=decision.reason,
        risk_level=risk_level,
        risk_score=risk_score,
        regulatory_references=regulatory_references,
        debug_info={"missing_fields": decision.missing_fields} if decision.missing_fields else None,
    )

    return HospitalCsfEvaluateResponse(
        decision=decision_outcome,
        status=decision_outcome.status,
        reason=decision_outcome.reason,
        missing_fields=decision.missing_fields,
        regulatory_references=[ref.id for ref in regulatory_references],
    )


@router.post("/form-copilot", response_model=CsfCopilotResponse)
async def hospital_form_copilot(form: HospitalCsfForm) -> CsfCopilotResponse:
    """Hospital CSF Form Copilot backed by regulatory RAG."""

    copilot_request = {
        "csf_type": "hospital",
        "name": form.facility_name,
        "facility_type": form.facility_type,
        "account_number": form.account_number,
        "pharmacy_license_number": form.pharmacy_license_number,
        "dea_number": form.dea_number,
        "pharmacist_in_charge_name": form.pharmacist_in_charge_name,
        "pharmacist_contact_phone": form.pharmacist_contact_phone,
        "ship_to_state": form.ship_to_state,
        "attestation_accepted": form.attestation_accepted,
        "internal_notes": form.internal_notes,
        "controlled_substances": form.controlled_substances,
    }

    rag_result: CsfCopilotResult = await run_csf_copilot(copilot_request)

    logger.info(
        "Hospital CSF copilot request received",
        extra={
            "engine_family": "csf",
            "decision_type": "csf_hospital",
            "decision_status": rag_result.status,
        },
    )

    suggestions = [CsfCopilotSuggestion(field_name=field) for field in rag_result.missing_fields]
    regulatory_references = [
        RegulatoryReference(id=ref, label=ref) for ref in rag_result.regulatory_references or []
    ]

    rag_sources_serialized = []
    for source in rag_result.rag_sources or []:
        if hasattr(source, "model_dump"):
            rag_sources_serialized.append(source.model_dump())
        elif hasattr(source, "dict"):
            rag_sources_serialized.append(source.dict())
        else:
            rag_sources_serialized.append(source)

    debug_info = {
        "status": rag_result.status.value if hasattr(rag_result.status, "value") else rag_result.status,
        "reason": rag_result.reason,
        "artifacts_used": rag_result.artifacts_used,
        "rag_sources": rag_sources_serialized,
    }

    return CsfCopilotResponse(
        status=rag_result.status.value if hasattr(rag_result.status, "value") else rag_result.status,
        reason=rag_result.reason,
        rag_explanation=rag_result.rag_explanation,
        artifacts_used=rag_result.artifacts_used or [],
        rag_sources=rag_sources_serialized,
        missing_fields=rag_result.missing_fields,
        suggestions=suggestions,
        message=rag_result.reason,
        regulatory_references=regulatory_references,
        debug_info=debug_info,
        trace_id=None,
    )
