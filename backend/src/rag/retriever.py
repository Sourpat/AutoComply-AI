from typing import List, Dict, Any
import numpy as np

from src.rag.loader import DocumentLoader
from src.rag.embedder import Embedder


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
