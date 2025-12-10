from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from src.autocomply.regulations.knowledge import get_regulatory_knowledge
from src.api.models.compliance_models import RegulatorySource


class RegulatorySearchRequest(BaseModel):
    query: str
    limit: int | None = 5


class RegulatorySearchResponse(BaseModel):
    query: str
    results: list[RegulatorySource]


router = APIRouter(prefix="/rag/regulatory", tags=["rag-regulatory"])


@router.post("/search", response_model=RegulatorySearchResponse)
async def search_regulatory_knowledge(
    payload: RegulatorySearchRequest,
) -> RegulatorySearchResponse:
    q = payload.query.strip()
    if not q:
        raise HTTPException(status_code=400, detail="Query must not be empty")

    knowledge = get_regulatory_knowledge()
    results = knowledge.search_sources(q, limit=payload.limit or 5)

    return RegulatorySearchResponse(query=q, results=results)
