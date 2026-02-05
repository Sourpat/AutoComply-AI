from __future__ import annotations

from typing import Dict, List, Optional
from pydantic import BaseModel, Field


class CanonicalSubmission(BaseModel):
    submission_id: str
    kind: str
    jurisdiction: Optional[str] = None
    entity_type: Optional[str] = None
    identifiers: Dict[str, Optional[str]] = Field(default_factory=dict)
    expirations: Dict[str, Optional[str]] = Field(default_factory=dict)
    schedules: List[str] = Field(default_factory=list)
    attestations: Dict[str, Optional[str]] = Field(default_factory=dict)
    documents: List[Dict[str, str]] = Field(default_factory=list)
    raw: Dict[str, object] = Field(default_factory=dict)
