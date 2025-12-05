"""
Shared decision output models for AutoComply engines.

These Pydantic models are intended to be reused across Controlled Substance
Forms (CSF), license engines, and order decision workflows so the frontend can
consume a consistent schema.
"""
from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class RegulatoryReference(BaseModel):
    """
    Reference to a regulatory artifact or source that influenced a decision.

    Examples include internal compliance artifacts (csf_hospital_form), state
    board requirements, or DEA guidance docs. Fields other than `id` and
    `label` are optional to allow lightweight references when details are not
    available.
    """

    id: str
    jurisdiction: Optional[str] = None
    source: Optional[str] = None
    citation: Optional[str] = None
    label: str


class DecisionStatus(str, Enum):
    OK_TO_SHIP = "ok_to_ship"
    NEEDS_REVIEW = "needs_review"
    BLOCKED = "blocked"


class DecisionOutcome(BaseModel):
    """
    Unified decision output used by CSF, license, and order engines.

    `risk_score` can be normalized to either a 0–1 or 0–100 scale depending on
    the engine; consumers should rely on accompanying documentation or
    `risk_level` for interpretation.
    """

    status: DecisionStatus
    reason: str
    risk_level: Optional[str] = None
    risk_score: Optional[float] = None
    regulatory_references: List[RegulatoryReference] = Field(default_factory=list)
    trace_id: Optional[str] = None
    debug_info: Optional[Dict[str, Any]] = None


class DecisionAuditEntryModel(BaseModel):
    trace_id: str
    engine_family: str
    decision_type: str
    status: str
    reason: str
    risk_level: Optional[str] = None
    created_at: str
    decision: DecisionOutcome
