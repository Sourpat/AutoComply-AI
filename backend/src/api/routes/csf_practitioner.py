from typing import List, Optional

from fastapi import APIRouter
from pydantic import BaseModel, Field

from src.autocomply.domain.csf_practitioner import (
    CsDecisionStatus,
    PractitionerCsfDecision,
    PractitionerCsfForm,
    describe_practitioner_csf_decision,
    evaluate_practitioner_csf,
)
from src.autocomply.domain.rag_regulatory_explain import (
    RegulatoryRagAnswer,
    explain_csf_practitioner_decision,
)
from src.api.models.compliance_models import RegulatorySource
from src.utils.logger import get_logger

router = APIRouter(
    prefix="/csf/practitioner",
    tags=["csf_practitioner"],
)

logger = get_logger(__name__)


DEFAULT_COPILOT_QUESTION = (
    "Explain to a verification specialist what this Practitioner CSF decision "
    "means, what is missing, and what is required next."
)


class PractitionerCopilotRequest(PractitionerCsfForm):
    question: Optional[str] = Field(
        default=None,
        description="Optional custom question for the copilot explanation.",
    )


class PractitionerCopilotResponse(BaseModel):
    status: CsDecisionStatus
    reason: str
    rag_sources: List[RegulatorySource] = Field(default_factory=list)
    raw_decision: PractitionerCsfDecision


@router.post("/evaluate", response_model=PractitionerCsfDecision)
async def evaluate_practitioner_csf_endpoint(
    form: PractitionerCsfForm,
) -> PractitionerCsfDecision:
    """
    Evaluate a Practitioner Controlled Substance Form and return a decision.
    """
    decision = evaluate_practitioner_csf(form)
    explanation = describe_practitioner_csf_decision(form, decision)
    logger.info(
        "Practitioner CSF decision explanation",
        extra={
            "decision_status": decision.status,
            "missing_fields": decision.missing_fields,
            "explanation": explanation,
        },
    )
    return decision


@router.post("/form-copilot", response_model=PractitionerCopilotResponse)
async def practitioner_form_copilot(
    form: PractitionerCopilotRequest,
) -> PractitionerCopilotResponse:
    """
    Practitioner Form Copilot endpoint backed by regulatory RAG.
    """

    decision = evaluate_practitioner_csf(form)
    fallback_reason = (
        decision.reason
        or "All required facility, practitioner, licensing, jurisdiction, and "
        "attestation details are present. Practitioner CSF is approved to proceed."
    )
    rag_reason = fallback_reason
    rag_sources: List[RegulatorySource] = []

    try:
        rag_answer: RegulatoryRagAnswer = explain_csf_practitioner_decision(
            decision={**decision.model_dump(), "form": form.model_dump()},
            question=form.question or DEFAULT_COPILOT_QUESTION,
            regulatory_references=decision.regulatory_references,
        )
        rag_reason = rag_answer.answer or fallback_reason
        rag_sources = rag_answer.sources
    except Exception:
        logger.exception(
            "Failed to generate practitioner CSF copilot explanation",
            extra={
                "engine_family": "csf",
                "decision_type": "csf_practitioner",
                "account_number": form.account_number,
            },
        )

    return PractitionerCopilotResponse(
        status=decision.status,
        reason=rag_reason,
        rag_sources=rag_sources,
        raw_decision=decision,
    )
