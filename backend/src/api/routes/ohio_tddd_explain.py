from fastapi import APIRouter
from pydantic import BaseModel

from src.autocomply.domain.ohio_tddd_explain import (
    OhioTdddDecisionSummary,
    OhioTdddExplanation,
    explain_ohio_tddd_decision,
)

router = APIRouter(
    prefix="/ohio-tddd",
    tags=["ohio_tddd_explain"],
)


class OhioTdddExplainRequest(BaseModel):
    """
    Request body for explaining an Ohio TDDD decision.

    Shape:
    {
      "decision": { ... OhioTdddDecisionSummary ... }
    }
    """

    decision: OhioTdddDecisionSummary


class OhioTdddExplainResponse(OhioTdddExplanation):
    """
    Response model for the explain endpoint.
    """

    pass


@router.post("/explain", response_model=OhioTdddExplainResponse)
async def explain_ohio_tddd_endpoint(
    payload: OhioTdddExplainRequest,
) -> OhioTdddExplainResponse:
    """
    Explain an Ohio TDDD decision.

    The caller sends the decision JSON (status, reason, missing_fields,
    regulatory_references) and the engine returns a narrative, artifact-aware
    explanation.
    """

    explanation = explain_ohio_tddd_decision(decision=payload.decision)
    return OhioTdddExplainResponse(**explanation.model_dump())
