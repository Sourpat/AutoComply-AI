from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class RagSource(BaseModel):
    """
    Canonical representation of a single RAG source.

    Used across /rag/* endpoints and decision contracts.
    """

    model_config = ConfigDict(populate_by_name=True)

    id: Optional[str] = None
    label: Optional[str] = Field(default=None, alias="title")
    jurisdiction: Optional[str] = None
    citation: Optional[str] = None
    snippet: str
    score: float
    raw_score: Optional[float] = None
    url: Optional[str] = None
    source_type: Optional[str] = None

    @property
    def title(self) -> Optional[str]:
        """Backwards-compatible accessor for legacy `title` field."""

        return self.label
