from __future__ import annotations

from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class SafeFailureMode(str, Enum):
    POLICY_BLOCKED_HIGH_CONFIDENCE = "POLICY_BLOCKED_HIGH_CONFIDENCE"
    POLICY_REQUIRES_REVIEW_HIGH_CONFIDENCE = "POLICY_REQUIRES_REVIEW_HIGH_CONFIDENCE"
    POLICY_ESCALATED_COMPLETE_SPEC = "POLICY_ESCALATED_COMPLETE_SPEC"
    POLICY_FAILSAFE_MISSING_CONTRACT = "POLICY_FAILSAFE_MISSING_CONTRACT"
    POLICY_FAILSAFE_ENGINE_ERROR = "POLICY_FAILSAFE_ENGINE_ERROR"
    POLICY_OVERRIDE_REQUIRED_MISSING = "POLICY_OVERRIDE_REQUIRED_MISSING"
    POLICY_BLOCKED_FLAG_CONFLICT = "POLICY_BLOCKED_FLAG_CONFLICT"


class SafeFailureDetail(BaseModel):
    mode: SafeFailureMode
    summary: str
    ai_intent: Optional[str] = None
    policy_action: str
    confidence: Optional[float] = None
    contract_version: str
    reason_codes: List[str] = Field(default_factory=list)
    recommended_next_step: str
    metadata: Optional[Dict[str, Any]] = None
