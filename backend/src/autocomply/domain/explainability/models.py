from __future__ import annotations

from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, Field

ExplainStatus = Literal["approved", "needs_review", "blocked"]
RiskLevel = Literal["low", "medium", "high"]
FieldCategory = Literal["BLOCK", "REVIEW", "INFO"]


class MissingField(BaseModel):
    key: str
    label: str
    category: FieldCategory
    path: Optional[str] = None
    reason: Optional[str] = None


class FiredRule(BaseModel):
    id: str
    name: str
    severity: FieldCategory
    rationale: str
    inputs: Dict[str, str]
    conditions: Optional[Dict[str, str]] = None


class Citation(BaseModel):
    doc_id: str
    chunk_id: str
    snippet: str
    jurisdiction: Optional[str] = None
    confidence: Optional[float] = None
    source_title: Optional[str] = None
    url: Optional[str] = None


class NextStep(BaseModel):
    action: str
    blocking: bool
    rationale: Optional[str] = None


class ExplainResult(BaseModel):
    run_id: str
    submission_id: str
    submission_hash: str
    policy_version: str
    knowledge_version: str
    status: ExplainStatus
    risk: RiskLevel
    summary: str
    missing_fields: List[MissingField] = Field(default_factory=list)
    fired_rules: List[FiredRule] = Field(default_factory=list)
    citations: List[Citation] = Field(default_factory=list)
    next_steps: List[NextStep] = Field(default_factory=list)
    debug: Optional[Dict[str, Any]] = None
