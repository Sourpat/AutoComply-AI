from typing import List

from fastapi import APIRouter
from pydantic import BaseModel, Field

from src.api.models.decision import (
    DecisionOutcome,
    DecisionStatus,
    RegulatoryReference,
)
from src.api.models.compliance_models import FacilityFormCopilotResponse
from src.autocomply.domain.csf_facility import FacilityCsfForm, evaluate_facility_csf
from src.autocomply.domain.csf_copilot import run_csf_copilot
from src.utils.logger import get_logger

# NOTE: All CSF evaluate endpoints now return a shared DecisionOutcome schema
# (see src/api/models/decision.py).
router = APIRouter(
    prefix="/csf/facility",
    tags=["csf_facility"],
)

# Compatibility router so callers that expect versioned API prefixes don't hit 404s.
# The handlers delegate to the same logic as the primary router to keep behavior
# identical.
compat_router = APIRouter(
    prefix="/api/v1/csf/facility",
    tags=["csf_facility"],
)

logger = get_logger(__name__)

DEFAULT_FACILITY_COPILOT_QUESTION = (
    "Explain to a verification specialist what this Facility CSF decision "
    "means, what is missing, and what is required next."
)


class FacilityCsfEvaluateResponse(BaseModel):
    """Response wrapper for Facility CSF evaluations."""

    decision: DecisionOutcome
    status: DecisionStatus
    reason: str
    missing_fields: List[str] = Field(default_factory=list)
    regulatory_references: List[str] = Field(default_factory=list)


def _facility_success_reason(reason: str) -> str:
    """Normalize success copy to be Facility-specific."""

    if not reason:
        return reason

    return reason.replace(
        "Hospital CSF is approved to proceed.",
        "Facility CSF is approved to proceed.",
    )


@router.post("/evaluate", response_model=FacilityCsfEvaluateResponse)
async def evaluate_facility_csf_endpoint(
    form: FacilityCsfForm,
) -> FacilityCsfEvaluateResponse:
    """Evaluate a Facility Controlled Substance Form and return a decision."""

    logger.info(
        "Facility CSF evaluation request received",
        extra={
            "engine_family": "csf",
            "decision_type": "csf_facility",
        },
    )

    decision = evaluate_facility_csf(form)
    decision.reason = _facility_success_reason(decision.reason)

    status_map = {
        "ok_to_ship": DecisionStatus.OK_TO_SHIP,
        "blocked": DecisionStatus.BLOCKED,
        "manual_review": DecisionStatus.NEEDS_REVIEW,
    }
    normalized_status = status_map.get(decision.status.value, DecisionStatus.NEEDS_REVIEW)

    regulatory_references = [
        RegulatoryReference(id=ref, label=ref) for ref in decision.regulatory_references or []
    ]

    decision_outcome = DecisionOutcome(
        status=normalized_status,
        reason=decision.reason,
        regulatory_references=regulatory_references,
        debug_info={"missing_fields": decision.missing_fields} if decision.missing_fields else None,
    )

    return FacilityCsfEvaluateResponse(
        decision=decision_outcome,
        status=decision_outcome.status,
        reason=decision_outcome.reason,
        missing_fields=decision.missing_fields,
        regulatory_references=[ref.id for ref in regulatory_references],
    )


@router.post("/form-copilot", response_model=FacilityFormCopilotResponse)
async def facility_form_copilot(form: FacilityCsfForm) -> FacilityFormCopilotResponse:
    """Facility CSF Form Copilot backed by regulatory RAG."""

    copilot_request = {
        "csf_type": "facility",
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

    rag_result = await run_csf_copilot(copilot_request)

    logger.info(
        "Facility CSF copilot request received",
        extra={
            "engine_family": "csf",
            "decision_type": "csf_facility",
            "decision_status": rag_result.status,
        },
    )

    return FacilityFormCopilotResponse(
        status=rag_result.status,
        reason=rag_result.reason,
        missing_fields=rag_result.missing_fields,
        regulatory_references=rag_result.regulatory_references,
        rag_explanation=rag_result.rag_explanation,
        artifacts_used=rag_result.artifacts_used,
        rag_sources=rag_result.rag_sources,
    )


@compat_router.post("/evaluate", response_model=FacilityCsfEvaluateResponse)
async def evaluate_facility_csf_endpoint_v1(
    form: FacilityCsfForm,
) -> FacilityCsfEvaluateResponse:
    """Versioned compatibility endpoint for Facility CSF evaluation."""

    return await evaluate_facility_csf_endpoint(form)


@compat_router.post("/form-copilot", response_model=FacilityFormCopilotResponse)
async def facility_form_copilot_v1(
    form: FacilityCsfForm,
) -> FacilityFormCopilotResponse:
    """Versioned compatibility endpoint for Facility CSF Form Copilot."""

    return await facility_form_copilot(form)
