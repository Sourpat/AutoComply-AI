from fastapi import APIRouter
from pydantic import BaseModel, Field, root_validator
from typing import Any, Dict, List, Optional

from autocomply.domain.rag_regulatory_explain import (
    RegulatoryRagAnswer,
    RegulatoryRagRequestModel,
    explain_csf_practitioner_decision,
    regulatory_rag_explain,
)
from src.api.models.decision import RegulatoryReference
from src.api.models.compliance_models import RegulatoryExplainResponse, RegulatorySource
from src.autocomply.regulations.knowledge import get_regulatory_knowledge

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


class RegulatoryRagResponse(RegulatoryExplainResponse):
    """
    Response model; we just reuse the domain model.
    """

    pass


class RegulatoryPreviewRequest(BaseModel):
    """
    Request body for the regulatory preview endpoint.

    All fields are optional; you can:
    - provide doc_ids explicitly, or
    - rely on decision_type + jurisdiction fallback logic.
    """

    decision_type: Optional[str] = None
    jurisdiction: Optional[str] = None
    doc_ids: Optional[List[str]] = None


class RegulatoryPreviewItem(BaseModel):
    """
    Flattened version of RegulatoryEvidenceItem for public API.
    """

    id: str
    jurisdiction: Optional[str] = None
    source: Optional[str] = None
    citation: Optional[str] = None
    label: Optional[str] = None
    snippet: Optional[str] = None


class RegulatoryPreviewResponse(BaseModel):
    items: List[RegulatoryPreviewItem]


@router.post("/regulatory/preview", response_model=RegulatoryPreviewResponse)
async def regulatory_preview(
    payload: RegulatoryPreviewRequest,
) -> RegulatoryPreviewResponse:
    """
    Return a preview of regulatory evidence available for a given decision type /
    jurisdiction / doc_ids.

    This is a read-only endpoint intended for:
    - debugging
    - integrations (n8n, agents)
    - future UI cards to show the underlying regulatory basis.
    """

    knowledge = get_regulatory_knowledge()

    sources: List[RegulatorySource] = []
    doc_ids: List[str] = payload.doc_ids or []

    if not doc_ids and payload.decision_type:
        inferred_engine_family = (payload.decision_type or "").split("_", 1)[0]
        sources = knowledge.get_context_for_engine(
            engine_family=inferred_engine_family, decision_type=payload.decision_type
        )
    elif doc_ids:
        sources = knowledge.get_sources_for_doc_ids(doc_ids)
    else:
        sources = []

    items: List[RegulatoryPreviewItem] = []
    for src in sources:
        items.append(
            RegulatoryPreviewItem(
                id=src.id or "",
                jurisdiction=src.jurisdiction,
                source=src.title,
                citation=getattr(src, "citation", None),
                label=src.title or (src.id or ""),
                snippet=src.snippet,
            )
        )

    return RegulatoryPreviewResponse(items=items)


@router.post("/regulatory-explain", response_model=RegulatoryRagResponse)
async def regulatory_explain_endpoint(
    payload: RegulatoryRagRequest,
) -> RegulatoryRagResponse:
    """
    Explain a regulatory decision or rule using RAG over compliance artifacts.

    In stub mode, this returns a deterministic placeholder that echoes the
    artifacts and question. In full mode, it runs the LangChain RAG pipeline.
    """

    knowledge = get_regulatory_knowledge()
    fallback_sources: List[RegulatorySource] = []

    if payload.engine_family and payload.decision_type:
        fallback_sources = knowledge.get_context_for_engine(
            engine_family=payload.engine_family,
            decision_type=payload.decision_type,
        )

    answer: RegulatoryRagAnswer

    if (
        payload.engine_family == "csf"
        and payload.decision_type == "csf_practitioner"
    ):
        answer = explain_csf_practitioner_decision(
            decision=payload.decision,
            question=payload.question,
            regulatory_references=payload.regulatory_references,
        )
    else:
        domain_request = RegulatoryRagRequestModel(
            question=payload.question,
            regulatory_references=payload.regulatory_references,
            decision=payload.decision,
        )
        answer = regulatory_rag_explain(domain_request)

    if not answer.sources and fallback_sources:
        answer.sources = fallback_sources
    if not answer.artifacts_used and fallback_sources:
        answer.artifacts_used = [src.id for src in fallback_sources if src.id]
    if not answer.regulatory_references and fallback_sources:
        answer.regulatory_references = [src.id for src in fallback_sources if src.id]

    return RegulatoryRagResponse(**answer.model_dump())
