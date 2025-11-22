"""Embedding utilities for the RAG layer.

The current implementation uses a minimal, test-friendly embedding strategy:
it may rely on a local numeric stub or a small, deterministic model rather than
a large remote service.

Design goals:
- Keep the interface extremely small: e.g., `embed_text_batch(texts: list[str]) -> list[list[float]]`.
- Make it trivial to swap implementation:
    - for local demos: cheap / stub embeddings
    - for production: OpenAI embeddings, HuggingFace, or any LangChain embedding class.

By keeping this module thin and side-effect free, we can later wrap the underlying
functions into LangChain Embeddings or LangGraph nodes without touching callers.
"""

from typing import List
from openai import OpenAI

from src.config import get_settings


class Embedder:
    """
    Lightweight wrapper around OpenAI embeddings.
    Future-proof: can later plug into Pinecone/Chroma without refactoring.
    """

    def __init__(self):
        settings = get_settings()
        if not settings.OPENAI_API_KEY:
            raise ValueError("AUTOCOMPLY_OPENAI_KEY is not set.")

        self.client = OpenAI(api_key=settings.OPENAI_API_KEY)
        self.model = "text-embedding-3-small"

    def embed_texts(self, texts: List[str]) -> List[List[float]]:
        """Embed a list of raw text snippets into numeric vectors.

        Parameters
        ----------
        texts : list[str]
            The input snippets (e.g., regulatory rule texts) to embed.

        Returns
        -------
        list[list[float]]
            A list of numeric vectors, one per input text. The exact dimension and
            embedding model are implementation details and can change without
            impacting callers, as long as the output is a list of equal-length vectors.
        """
        if not texts:
            return []

        response = self.client.embeddings.create(
            model=self.model,
            input=texts
        )

        return [item.embedding for item in response.data]
