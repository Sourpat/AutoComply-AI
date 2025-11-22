"""RAG retrieval layer for AutoComply AI.

This module is intentionally lightweight and framework-agnostic so that it can be
plugged into either:

- a plain FastAPI route (current setup), or
- a LangChain / LangGraph style orchestration graph in the future.

High-level responsibilities:
- Load a small set of regulatory “documents” (state rules, DEA snippets, use-case
  explanations) via the loader.
- Use a simple embedding + similarity search strategy to retrieve the most relevant
  snippets for a given (state, purchase_intent) query.
- Return a normalized list of context items shaped like:

    {
        "jurisdiction": "US-CA",
        "source": "State rules",
        "snippet": "...short explanation text..."
    }

The tests around regulatory context treat this retriever as a deterministic,
non-LLM stub. That keeps the pipeline stable and makes it easy to later swap
the internals for a vector database or a LangChain retriever without changing
the public interface.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

import numpy as np

from src.rag.embedder import Embedder
from src.rag.knowledge_base import (
    RegulationSnippet,
    get_snippets_for_jurisdiction,
    list_all_snippets,
)
from src.rag.loader import DocumentLoader
from src.rag.regulatory_context import build_regulatory_context


class Retriever:
    """
    Minimal, modular semantic retriever for AutoComply AI.
    - Loads documents
    - Embeds chunks
    - Stores vectors in-memory
    - Performs cosine similarity search
    Future-proof: easy migration to Pinecone/Chroma/LangGraph retrievers.
    """

    def __init__(self):
        self.loader = DocumentLoader()
        self.embedder = Embedder()

        # Load & embed documents at initialization
        self.documents: List[str] = self.loader.chunk_documents()
        self.vectors: List[List[float]] = (
            self.embedder.embed_texts(self.documents)
            if self.documents else []
        )

        # Convert to numpy arrays for cosine similarity
        self.vectors_np = np.array(self.vectors) if self.vectors else None

    # -------------------------------------------------------------
    # Cosine similarity utility
    # -------------------------------------------------------------
    @staticmethod
    def _cosine_similarity(a, b):
        a = np.array(a)
        b = np.array(b)
        return np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b))

    # -------------------------------------------------------------
    # Main retrieval method
    # -------------------------------------------------------------
    def retrieve(self, query: str, k: int = 3) -> List[Dict[str, Any]]:
        """
        Returns top-k semantically relevant chunks for a given query.
        Each result includes:
            - text
            - score
            - chunk index
        """
        if not self.documents or self.vectors_np is None:
            return []

        # Embed the query
        q_vec = self.embedder.embed_texts([query])[0]

        # Compute cosine similarity with all stored vectors
        scores = [
            self._cosine_similarity(q_vec, vec)
            for vec in self.vectors
        ]

        # Get top-k
        top_indices = np.argsort(scores)[-k:][::-1]

        results = [
            {
                "text": self.documents[i],
                "score": float(scores[i]),
                "index": int(i),
            }
            for i in top_indices
        ]

        return results


class RegulationRetriever:
    """Small, testable retriever for regulatory snippets.

    The intent is to encapsulate:

    - how we turn (state, purchase_intent, maybe license metadata) into a query
    - how we select the top N relevant “regulatory context” snippets
    - how we normalize them into the dictionary shape expected by the API layer.

    In a LangGraph setup, this class can be wrapped as a node/step without changing
    its public methods; the graph would simply call `retrieve(...)` with the same
    arguments used by the current FastAPI route.
    """

    def get_context_for_state(
        self,
        state_code: str,
        topic: Optional[str] = None,
    ) -> List[RegulationSnippet]:
        """
        For now, we treat state-specific rules as 'US-<STATE>' jurisdiction.

        Example:
          state_code='CA' → jurisdiction='US-CA'
        """
        jurisdiction = f"US-{state_code.upper()}"
        return get_snippets_for_jurisdiction(jurisdiction=jurisdiction, topic=topic)

    def get_dea_baseline_context(
        self,
        topic: Optional[str] = None,
    ) -> List[RegulationSnippet]:
        """
        Fetch baseline DEA-level context (e.g. Schedule II–V rules).
        """
        return get_snippets_for_jurisdiction(jurisdiction="US-DEA", topic=topic)

    def retrieve(
        self,
        state: Optional[str] = None,
        purchase_intent: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """
        Return a list of raw retrieval hits for the given inputs.

        This is intentionally simple and deterministic for tests/demos.
        """
        hits: List[RegulationSnippet] = []

        if state:
            hits.extend(self.get_context_for_state(state_code=state))

        hits.extend(self.get_dea_baseline_context())

        if purchase_intent and purchase_intent.lower().startswith("tele"):
            tele_snippets = [
                s
                for s in list_all_snippets()
                if s.topic.lower() == "telemedicine"
            ]
            hits.extend(tele_snippets)

        return [
            {
                "id": s.id,
                "jurisdiction": s.jurisdiction,
                "topic": s.topic,
                "text": s.text,
                "source": s.source,
            }
            for s in hits
        ]
