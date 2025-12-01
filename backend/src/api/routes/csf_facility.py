from fastapi import APIRouter

from autocomply.domain.rag_regulatory_explain import (
    RegulatoryRagAnswer,
    explain_csf_facility_decision,
)
from src.api.models.compliance_models import FacilityFormCopilotResponse
from src.autocomply.domain.csf_facility import (
    FacilityCsfDecision,
    FacilityCsfForm,
    evaluate_facility_csf,
)
from src.utils.logger import get_logger

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


def _facility_success_reason(reason: str) -> str:
    """Normalize success copy to be Facility-specific."""

    if not reason:
        return reason

    return reason.replace(
        "Hospital CSF is approved to proceed.",
        "Facility CSF is approved to proceed.",
    )


@router.post("/evaluate", response_model=FacilityCsfDecision)
async def evaluate_facility_csf_endpoint(
    form: FacilityCsfForm,
) -> FacilityCsfDecision:
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
    return decision


@router.post("/form-copilot", response_model=FacilityFormCopilotResponse)
async def facility_form_copilot(form: FacilityCsfForm) -> FacilityFormCopilotResponse:
    """Facility CSF Form Copilot backed by regulatory RAG."""

    decision = evaluate_facility_csf(form)
    decision.reason = _facility_success_reason(decision.reason)
    references = decision.regulatory_references or ["csf_facility_form"]
    question = DEFAULT_FACILITY_COPILOT_QUESTION
    rag_explanation = decision.reason
    rag_sources = []
    artifacts_used = []

    logger.info(
        "Facility CSF copilot request received",
        extra={
            "engine_family": "csf",
            "decision_type": "csf_facility",
            "decision_status": decision.status,
        },
    )

    try:
        rag_answer: RegulatoryRagAnswer = explain_csf_facility_decision(
            decision=decision.model_dump(),
            question=question,
            regulatory_references=references,
        )
        rag_explanation = _facility_success_reason(
            rag_answer.answer or rag_explanation
        )
        rag_sources = rag_answer.sources
        artifacts_used = rag_answer.artifacts_used

        if rag_answer.debug.get("mode") == "stub":
            rag_explanation = (
                "RAG pipeline is not yet enabled for Facility CSF (using stub mode). "
                f"Decision summary: {decision.reason}"
            )
    except Exception:
        logger.exception(
            "Failed to generate facility CSF copilot explanation",
            extra={
                "engine_family": "csf",
                "decision_type": "csf_facility",
            },
        )
        rag_explanation = (
            "RAG pipeline is not yet enabled for Facility CSF (using stub mode). "
            f"Decision summary: {_facility_success_reason(decision.reason)}"
        )

    return FacilityFormCopilotResponse(
        status=decision.status,
        reason=decision.reason,
        missing_fields=decision.missing_fields,
        regulatory_references=references,
        rag_explanation=rag_explanation,
        artifacts_used=artifacts_used,
        rag_sources=rag_sources,
    )


@compat_router.post("/evaluate", response_model=FacilityCsfDecision)
async def evaluate_facility_csf_endpoint_v1(
    form: FacilityCsfForm,
) -> FacilityCsfDecision:
    """Versioned compatibility endpoint for Facility CSF evaluation."""

    return await evaluate_facility_csf_endpoint(form)


@compat_router.post("/form-copilot", response_model=FacilityFormCopilotResponse)
async def facility_form_copilot_v1(
    form: FacilityCsfForm,
) -> FacilityFormCopilotResponse:
    """Versioned compatibility endpoint for Facility CSF Form Copilot."""

    return await facility_form_copilot(form)
