from fastapi import APIRouter

from src.autocomply.domain.csf_researcher import (
    ResearcherCsfDecision,
    ResearcherCsfForm,
    describe_researcher_csf_decision,
    evaluate_researcher_csf,
)
from src.utils.logger import get_logger

router = APIRouter(
    prefix="/csf/researcher",
    tags=["csf_researcher"],
)

logger = get_logger(__name__)


@router.post("/evaluate", response_model=ResearcherCsfDecision)
async def evaluate_researcher_csf_endpoint(
    form: ResearcherCsfForm,
) -> ResearcherCsfDecision:
    """
    Evaluate a Researcher Controlled Substance Form and return a decision.
    """
    decision = evaluate_researcher_csf(form)
    explanation = describe_researcher_csf_decision(form, decision)
    logger.info(
        "Researcher CSF decision explanation",
        extra={
            "decision_status": decision.status,
            "missing_fields": decision.missing_fields,
            "explanation": explanation,
        },
    )
    return decision
