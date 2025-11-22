from fastapi import APIRouter

from src.autocomply.domain.csf_practitioner import (
    PractitionerCsfDecision,
    PractitionerCsfForm,
    evaluate_practitioner_csf,
)

router = APIRouter(
    prefix="/csf/practitioner",
    tags=["csf_practitioner"],
)


@router.post("/evaluate", response_model=PractitionerCsfDecision)
async def evaluate_practitioner_csf_endpoint(
    form: PractitionerCsfForm,
) -> PractitionerCsfDecision:
    """
    Evaluate a Practitioner Controlled Substance Form and return a decision.
    """
    decision = evaluate_practitioner_csf(form)
    return decision
