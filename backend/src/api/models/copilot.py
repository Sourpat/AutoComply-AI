"""
Canonical CSF form copilot response schemas shared across all CSF endpoints.

These models ensure that hospital, facility, and practitioner copilot flows
speak the same schema and reuse the shared ``RegulatoryReference`` type used by
decision outcomes.
"""
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field

from src.api.models.decision import RegulatoryReference


class CsfCopilotSuggestion(BaseModel):
    """Represents a suggested value to complete a CSF form field."""

    field_name: str
    suggested_value: Optional[Any] = None
    rationale: Optional[str] = None  # short explanation for the suggestion


class CsfCopilotResponse(BaseModel):
    """
    Unified CSF form copilot response model.

    This schema is the canonical shape for all CSF form copilot endpoints
    (hospital, facility, practitioner). ``regulatory_references`` reuse the
    shared ``RegulatoryReference`` model so copilot responses align with decision
    outputs.
    """

    # Legacy / contract fields expected by existing clients and tests
    status: Optional[str] = None  # e.g. "ok_to_ship"
    reason: Optional[str] = None
    rag_explanation: Optional[str] = None
    artifacts_used: List[str] = Field(default_factory=list)
    rag_sources: List[Dict[str, Any]] = Field(default_factory=list)

    # Core guidance / schema
    missing_fields: List[str] = Field(default_factory=list)
    suggestions: List[CsfCopilotSuggestion] = Field(default_factory=list)
    message: Optional[str] = None  # general guidance / summary

    # Unified regulatory model
    regulatory_references: List[RegulatoryReference] = Field(default_factory=list)

    # Debug / tracing
    debug_info: Optional[Dict[str, Any]] = None  # used when AI / RAG debug is ON
    trace_id: Optional[str] = None
