from __future__ import annotations

from typing import Any, Dict, List, Optional

import numpy as np

from src.rag.embedder import Embedder
from src.rag.knowledge_base import RegulationSnippet, get_snippets_for_jurisdiction
from src.rag.loader import DocumentLoader


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
    """
    Minimal, in-memory 'retriever' for regulatory snippets.

    This is NOT a full vector / embedding-based retriever yet.
    It exists to:
      - Demonstrate how regulatory context would be fetched.
      - Provide something concrete to attach to decisions and tests.
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
