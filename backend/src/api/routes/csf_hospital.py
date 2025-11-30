from fastapi import APIRouter

from autocomply.domain.rag_regulatory_explain import (
    RegulatoryRagAnswer,
    explain_csf_hospital_decision,
)
from src.api.models.compliance_models import HospitalFormCopilotResponse
from src.autocomply.domain.csf_hospital import (
    HospitalCsfDecision,
    HospitalCsfForm,
    evaluate_hospital_csf,
)
from src.utils.logger import get_logger

router = APIRouter(
    prefix="/csf/hospital",
    tags=["csf_hospital"],
)

logger = get_logger(__name__)


DEFAULT_HOSPITAL_COPILOT_QUESTION = (
    "Explain to a verification specialist what this Hospital CSF decision "
    "means, what is missing, and what is required next."
)


@router.post("/evaluate", response_model=HospitalCsfDecision)
async def evaluate_hospital_csf_endpoint(
    form: HospitalCsfForm,
) -> HospitalCsfDecision:
    """
    Evaluate a Hospital Pharmacy Controlled Substance Form and return a decision.
    """
    decision = evaluate_hospital_csf(form)
    return decision


@router.post("/form-copilot", response_model=HospitalFormCopilotResponse)
async def hospital_form_copilot(form: HospitalCsfForm) -> HospitalFormCopilotResponse:
    """Hospital CSF Form Copilot backed by regulatory RAG."""

    decision = evaluate_hospital_csf(form)
    references = decision.regulatory_references or ["csf_hospital_form"]
    question = DEFAULT_HOSPITAL_COPILOT_QUESTION
    rag_explanation = decision.reason
    rag_sources = []
    artifacts_used = []

    logger.info(
        "Hospital CSF copilot request received",
        extra={
            "engine_family": "csf",
            "decision_type": "csf_hospital",
            "decision_status": decision.status,
        },
    )

    try:
        rag_answer: RegulatoryRagAnswer = explain_csf_hospital_decision(
            decision=decision.model_dump(),
            question=question,
            regulatory_references=references,
        )
        rag_explanation = rag_answer.answer or rag_explanation
        rag_sources = rag_answer.sources
        artifacts_used = rag_answer.artifacts_used

        if rag_answer.debug.get("mode") == "stub":
            rag_explanation = (
                "RAG pipeline is not yet enabled for Hospital CSF (using stub mode). "
                f"Decision summary: {decision.reason}"
            )
    except Exception:
        logger.exception(
            "Failed to generate hospital CSF copilot explanation",
            extra={
                "engine_family": "csf",
                "decision_type": "csf_hospital",
            },
        )
        rag_explanation = (
            "RAG pipeline is not yet enabled for Hospital CSF (using stub mode). "
            f"Decision summary: {decision.reason}"
        )

    return HospitalFormCopilotResponse(
        status=decision.status,
        reason=decision.reason,
        missing_fields=decision.missing_fields,
        regulatory_references=references,
        rag_explanation=rag_explanation,
        artifacts_used=artifacts_used,
        rag_sources=rag_sources,
    )
