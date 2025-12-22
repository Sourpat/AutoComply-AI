from fastapi import APIRouter
from pydantic import BaseModel, ConfigDict, Field

from src.autocomply.domain.csf_explain import (
    CsfDecisionSummary,
    CsfExplanation,
    CsfType,
    explain_csf_decision,
)
from src.autocomply.domain.csf_practitioner import CsDecisionStatus

router = APIRouter(
    prefix="/csf",
    tags=["csf_explain"],
)


class CsfExplainRequest(BaseModel):
    """
    FastAPI request body for CSF explanation supporting legacy and new shapes.

    Legacy shape uses flat fields (decision_status, decision_reason, etc.).
    New shape nests decision as a CsfDecisionSummary.
    """

    model_config = ConfigDict(extra="allow")

    csf_type: CsfType
    decision: CsfDecisionSummary | None = None
    decision_status: CsDecisionStatus | None = None
    decision_reason: str | None = None
    missing_fields: list[str] = Field(default_factory=list)
    regulatory_references: list = Field(default_factory=list)


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

    decision_summary = payload.decision

    if not decision_summary:
        regulatory_references = []
        for ref in payload.regulatory_references or []:
            if isinstance(ref, str):
                regulatory_references.append(ref)
            elif isinstance(ref, dict) and "id" in ref:
                regulatory_references.append(ref.get("id"))
            else:
                regulatory_references.append(str(ref))

        decision_summary = CsfDecisionSummary(
            status=payload.decision_status or CsDecisionStatus.MANUAL_REVIEW,
            reason=payload.decision_reason or "",
            missing_fields=list(payload.missing_fields or []),
            regulatory_references=regulatory_references,
        )

    explanation = explain_csf_decision(
        csf_type=payload.csf_type,
        decision=decision_summary,
    )

    # CsfExplanation is compatible with CsfExplainResponse
    return CsfExplainResponse(**explanation.model_dump())
