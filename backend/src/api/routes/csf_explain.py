from fastapi import APIRouter
from pydantic import BaseModel

from src.autocomply.domain.csf_explain import (
    CsfDecisionSummary,
    CsfExplanation,
    CsfType,
    explain_csf_decision,
)

router = APIRouter(
    prefix="/csf",
    tags=["csf_explain"],
)


class CsfExplainRequest(BaseModel):
    """
    FastAPI request body for CSF explanation.

    Request shape:
    {
      "csf_type": "practitioner" | "hospital" | ...,
      "decision": { ... CsfDecisionSummary ... }
    }
    """

    csf_type: CsfType
    decision: CsfDecisionSummary


class CsfExplainResponse(CsfExplanation):
    """
    Response model for CSF explanation requests.
    """

    pass


@router.post("/explain", response_model=CsfExplainResponse)
async def explain_csf_endpoint(payload: CsfExplainRequest) -> CsfExplainResponse:
    """
    Explain a CSF decision (Practitioner, Hospital, Researcher, Surgery, EMS).

    The caller sends the decision JSON (status, reason, missing_fields,
    regulatory_references) and the engine will return a narrative explanation,
    enriched with references to compliance artifacts.
    """

    explanation = explain_csf_decision(
        csf_type=payload.csf_type,
        decision=payload.decision,
    )

    # CsfExplanation is compatible with CsfExplainResponse
    return CsfExplainResponse(**explanation.model_dump())
