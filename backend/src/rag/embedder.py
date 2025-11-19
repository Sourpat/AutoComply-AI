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
        """
        Embeds a list of text chunks and returns a list of vectors.
        Each vector corresponds to one text chunk.
        """
        if not texts:
            return []

        response = self.client.embeddings.create(
            model=self.model,
            input=texts
        )

        return [item.embedding for item in response.data]
