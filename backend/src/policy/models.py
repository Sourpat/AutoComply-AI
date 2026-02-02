from __future__ import annotations

from typing import Any, Dict, List, Optional, Literal

from pydantic import BaseModel, Field, field_validator
from pydantic.config import ConfigDict


class ContractRuleSet(BaseModel):
    model_config = ConfigDict(extra="forbid")

    auto_decision_allowed: bool = True
    human_review_required: bool = False
    confidence_threshold: Optional[float] = Field(default=None, ge=0.0, le=1.0)
    override_mandatory: bool = False
    audit_level: Literal["standard", "strict"] = "standard"
    escalate_on: Optional[Dict[str, Any]] = None
    block_on: Optional[Dict[str, Any]] = None


class AiDecisionContract(BaseModel):
    id: Optional[int] = None
    version: str
    status: Literal["active", "inactive", "deprecated"]
    created_at: str
    created_by: str
    effective_from: str
    rules: ContractRuleSet


class DecisionContext(BaseModel):
    model_confidence: Optional[float] = None
    risk_level: Optional[str] = None
    form_type: Optional[str] = None
    user_role: Optional[str] = None
    jurisdiction: Optional[str] = None
    flags: Dict[str, Any] = Field(default_factory=dict)

    @field_validator("risk_level", mode="before")
    @classmethod
    def _normalize_risk_level(cls, value: Any) -> Optional[str]:
        if value is None:
            return None
        return str(value).lower()


class PolicyGate(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    gate_name: str
    input: Any
    pass_: bool = Field(alias="pass")
    explanation: str


class PolicyResult(BaseModel):
    allowed_action: Literal["auto_decide", "require_human", "escalate", "block"]
    contract_version_used: str
    reason_codes: List[str] = Field(default_factory=list)
    gates: List[PolicyGate] = Field(default_factory=list)
    fail_safe: bool = False
