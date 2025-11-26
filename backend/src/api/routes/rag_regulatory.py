from fastapi import APIRouter
from pydantic import BaseModel, Field, root_validator
from typing import Any, Dict, List, Optional

from autocomply.domain.rag_regulatory_explain import (
    RegulatoryRagRequestModel,
    RegulatoryRagAnswer,
    regulatory_rag_explain,
)

router = APIRouter(
    prefix="/rag",
    tags=["rag_regulatory"],
)


class RegulatoryRagRequest(BaseModel):
    """
    Public API shape for /rag/regulatory-explain.

    We accept a superset of fields used by various frontend sandboxes so that
    callers don't have to perfectly match the backend model. Only the
    question/ask field is required; other fields are optional and ignored if not
    used by the current engine.
    """

    # Core question fields
    question: Optional[str] = Field(None, min_length=1)
    ask: Optional[str] = Field(None, min_length=1)

    # Engine context
    engine_family: Optional[str] = Field(
        None, description="Decision engine family (e.g., csf, license)."
    )
    decision_type: Optional[str] = Field(
        None, description="Specific decision type (e.g., csf_practitioner)."
    )

    # Decision payload and identifiers
    decision: Optional[Dict[str, Any]] = None
    account_id: Optional[str] = None
    decision_snapshot_id: Optional[str] = None
    source_document: Optional[str] = None

    regulatory_references: List[str] = Field(default_factory=list)

    @root_validator(pre=True)
    def set_question_from_ask(cls, values: Dict[str, Any]) -> Dict[str, Any]:
        # Frontends may send either `question` or `ask`; normalize to `question`.
        if not values.get("question") and values.get("ask"):
            values["question"] = values.get("ask")
        return values

    @root_validator(skip_on_failure=True)
    def ensure_question(cls, values: Dict[str, Any]) -> Dict[str, Any]:
        question = (values.get("question") or "").strip()
        if not question:
            raise ValueError("question or ask is required")
        values["question"] = question
        return values


class RegulatoryRagResponse(RegulatoryRagAnswer):
    """
    Response model; we just reuse the domain model.
    """

    pass


@router.post("/regulatory-explain", response_model=RegulatoryRagResponse)
async def regulatory_explain_endpoint(
    payload: RegulatoryRagRequest,
) -> RegulatoryRagResponse:
    """
    Explain a regulatory decision or rule using RAG over compliance artifacts.

    In stub mode, this returns a deterministic placeholder that echoes the
    artifacts and question. In full mode, it runs the LangChain RAG pipeline.
    """

    domain_request = RegulatoryRagRequestModel(
        question=payload.question,
        regulatory_references=payload.regulatory_references,
        decision=payload.decision,
    )
    answer = regulatory_rag_explain(domain_request)
    return RegulatoryRagResponse(**answer.model_dump())
