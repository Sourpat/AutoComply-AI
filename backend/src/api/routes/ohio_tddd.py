from fastapi import APIRouter

from src.autocomply.domain.ohio_tddd import (
    OhioTdddDecision,
    OhioTdddForm,
    evaluate_ohio_tddd as evaluate_ohio_tddd_engine,
)

router = APIRouter(
    prefix="/ohio-tddd",
    tags=["ohio_tddd"],
)


@router.post("/evaluate", response_model=OhioTdddDecision)
async def evaluate_ohio_tddd(form: OhioTdddForm) -> OhioTdddDecision:
    """
    Evaluate an Ohio TDDD application and return the decision.
    """
    decision = evaluate_ohio_tddd_engine(form)
    return decision
