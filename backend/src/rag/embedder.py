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

RAG DEPENDENCY: This module requires openai library which is excluded from
production builds. Import openai only when needed (lazy import).
"""

from typing import List, TYPE_CHECKING

from src.config import get_settings

if TYPE_CHECKING:
    from openai import OpenAI


class Embedder:
    """
    Lightweight wrapper around OpenAI embeddings.
    Future-proof: can later plug into Pinecone/Chroma without refactoring.
    
    Raises ImportError if RAG is disabled or openai not installed.
    """

    def __init__(self):
        settings = get_settings()
        if not settings.rag_enabled:
            raise ImportError(
                "RAG features are disabled. Set RAG_ENABLED=true and install "
                "openai library to use embedding functionality."
            )
        
        if not settings.OPENAI_API_KEY:
            raise ValueError("AUTOCOMPLY_OPENAI_KEY is not set.")

        try:
            from openai import OpenAI
            self.client = OpenAI(api_key=settings.OPENAI_API_KEY)
        except ImportError as e:
            raise ImportError(
                "openai library not installed. Install with: pip install openai"
            ) from e
        
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
