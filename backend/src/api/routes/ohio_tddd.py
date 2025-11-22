from fastapi import APIRouter

from src.autocomply.domain.ohio_tddd import (
    OhioTdddDecision,
    OhioTdddForm,
    evaluate_ohio_tddd_attestation,
)

router = APIRouter(
    prefix="/ohio-tddd",
    tags=["ohio_tddd"],
)


@router.post("/evaluate", response_model=OhioTdddDecision)
async def evaluate_ohio_tddd(form: OhioTdddForm) -> OhioTdddDecision:
    """
    Evaluate an Ohio TDDD attestation form and return the decision.
    """
    decision = evaluate_ohio_tddd_attestation(form)
    return decision
