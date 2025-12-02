from dataclasses import dataclass
from typing import Any, Dict, List, Optional


@dataclass
class RagExplainerResponse:
    status: str
    reason: str
    missing_fields: List[str]
    regulatory_references: List[str]
    rag_explanation: str
    artifacts_used: List[str]
    rag_sources: List[Dict[str, Any]]


class RagEngine:
    """Lightweight stub RAG engine for deterministic test runs."""

    async def run_explainer(
        self,
        prompt: str,
        context_filters: Optional[Dict[str, Any]] = None,
    ) -> RagExplainerResponse:
        doc_id = context_filters.get("doc_id") if context_filters else None
        regulatory_references = [doc_id] if doc_id else []

        explanation = (
            "RAG pipeline stubbed. Returning deterministic license copilot "
            "explanation until vector search is configured."
        )

        return RagExplainerResponse(
            status="needs_review",
            reason="RAG explainer stub response for license copilot.",
            missing_fields=[],
            regulatory_references=regulatory_references,
            rag_explanation=explanation,
            artifacts_used=regulatory_references,
            rag_sources=
            [
                {
                    "id": doc_id,
                    "source": "regulatory_docs",
                    "snippet": explanation,
                }
            ]
            if doc_id
            else [],
        )


rag_engine = RagEngine()
