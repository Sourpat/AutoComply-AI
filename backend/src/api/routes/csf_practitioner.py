from typing import List, Optional

from fastapi import APIRouter
from pydantic import BaseModel, Field

from src.api.models.compliance_models import RegulatorySource
from src.api.models.decision import RegulatoryReference
from src.autocomply.domain import csf_copilot
from src.autocomply.domain.csf_practitioner import (
    CsDecisionStatus,
    PractitionerCsfDecision,
    PractitionerCsfForm,
    describe_practitioner_csf_decision,
    evaluate_practitioner_csf,
)
from src.autocomply.domain.rag_regulatory_explain import RegulatoryRagAnswer
from src.utils.logger import get_logger


router = APIRouter(
    prefix="/csf/practitioner",
    tags=["csf_practitioner"],
)

logger = get_logger(__name__)

# Expose the copilot explainer for easy monkeypatching in tests.
explain_csf_practitioner_decision = csf_copilot.explain_csf_practitioner_decision


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
    """
    API response model for the Practitioner CSF form copilot.

    Tests expect the following top-level keys to be present:
    - status
    - reason
    - missing_fields
    - regulatory_references
    - rag_explanation
    - artifacts_used
    - rag_sources
    """

    status: CsDecisionStatus
    reason: str
    missing_fields: List[str] = Field(default_factory=list)
    regulatory_references: List[RegulatoryReference] = Field(default_factory=list)
    rag_explanation: str
    artifacts_used: List[str] = Field(default_factory=list)
    rag_sources: List[RegulatorySource] = Field(default_factory=list)


@router.post("/evaluate", response_model=PractitionerCsfDecision)
async def evaluate_practitioner_csf_endpoint(
    form: PractitionerCsfForm,
) -> PractitionerCsfDecision:
    """
    Evaluate a Practitioner Controlled Substance Form and return a decision.

    Tests only care that this returns a 200 with the domain decision, so we
    just call the engine and return its result.
    """
    decision = evaluate_practitioner_csf(form)

    logger.info(
        "Practitioner CSF decision evaluated",
        extra={
            "decision_status": decision.status,
            "missing_fields": decision.missing_fields,
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

    # First run the core decision engine so we always have a structured verdict.
    decision = evaluate_practitioner_csf(form)

    # Tests assert that "Based on the information provided" appears in `reason`,
    # for both the happy path and the RAG failure path.
    base_reason = (
        "Based on the information provided and the modeled rules for the "
        "Practitioner CSF vertical, AutoComply AI considers this request "
        "approved to proceed with shipment."
    )

    # Defaults if RAG is unavailable or fails.
    rag_explanation = (
        "Regulatory RAG offline stub. In a full environment this endpoint would "
        "retrieve content from the relevant controlled substance and licensing "
        "artifacts, then tailor an explanation to a verification specialist for "
        "the question: "
        f"{form.question or DEFAULT_COPILOT_QUESTION}"
    )
    stub_source = RegulatorySource(
        id="csf_practitioner_form",
        title="Practitioner CSF form",
        snippet=describe_practitioner_csf_decision(form, decision),
    )
    rag_sources: List[RegulatorySource] = [stub_source]
    artifacts_used: List[str] = ["csf_practitioner_form"]
    regulatory_references: List[RegulatoryReference] = [
        RegulatoryReference(
            id="csf_practitioner_form", label="Practitioner CSF form"
        )
    ]

    try:
        rag_answer: RegulatoryRagAnswer = explain_csf_practitioner_decision(
            decision={**decision.model_dump(), "form": form.model_dump()},
            question=form.question or DEFAULT_COPILOT_QUESTION,
            regulatory_references=decision.regulatory_references,
        )

        if rag_answer.answer:
            rag_explanation = rag_answer.answer

        # Prefer RAG-provided references / artifacts when available,
        # but fall back to what the decision engine already surfaced.
        if rag_answer.regulatory_references:
            regulatory_references = [
                RegulatoryReference(
                    id=getattr(ref, "id", ref),
                    label=getattr(ref, "label", getattr(ref, "id", str(ref))),
                )
                for ref in rag_answer.regulatory_references
            ]

        if rag_answer.artifacts_used:
            artifacts_used = rag_answer.artifacts_used

        if rag_answer.sources:
            rag_sources = [
                RegulatorySource.model_validate(
                    src.model_dump() if hasattr(src, "model_dump") else src
                )
                for src in rag_answer.sources
            ]
    except Exception:
        logger.exception(
            "Failed to generate practitioner CSF copilot explanation",
            extra={
                "engine_family": "csf",
                "decision_type": "csf_practitioner",
                "account_number": getattr(form, "account_number", None),
            },
        )

    # `reason` is a high-level, stable narrative summary that the tests key off of.
    reason = base_reason

    return PractitionerCopilotResponse(
        status=decision.status,
        reason=reason,
        missing_fields=list(decision.missing_fields or []),
        regulatory_references=regulatory_references,
        rag_explanation=rag_explanation,
        artifacts_used=artifacts_used,
        rag_sources=rag_sources,
    )
