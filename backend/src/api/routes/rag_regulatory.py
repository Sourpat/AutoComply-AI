from fastapi import APIRouter
from pydantic import BaseModel, Field
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

    - question: what the caller wants explained.
    - regulatory_references: artifact IDs to focus on, usually taken from a decision.
    - decision: optional raw decision JSON (CSF or Ohio TDDD).
    """

    question: str = Field(..., min_length=1)
    regulatory_references: List[str] = Field(default_factory=list)
    decision: Optional[Dict[str, Any]] = None


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
