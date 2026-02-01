from __future__ import annotations

from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field

# TODO: unify with shared/contracts/agentic.ts once shared types are wired across backend/frontend.


class CaseStatus(str, Enum):
    DRAFT = "draft"
    EVALUATING = "evaluating"
    NEEDS_INPUT = "needs_input"
    QUEUED_REVIEW = "queued_review"
    APPROVED = "approved"
    BLOCKED = "blocked"
    COMPLETED = "completed"


class AgentActionIntent(str, Enum):
    RUN_CHECK = "run_check"
    ASK_USER = "ask_user"
    ROUTE_REVIEW = "route_review"
    APPLY_FIX = "apply_fix"
    OPEN_CONSOLE = "open_console"
    EXPORT_AUDIT = "export_audit"


class JSONSchema(BaseModel):
    type: str
    title: Optional[str] = None
    description: Optional[str] = None
    properties: Optional[Dict[str, "JSONSchema"]] = None
    required: Optional[List[str]] = None


class AgentAction(BaseModel):
    id: str
    label: str
    intent: AgentActionIntent
    requiresConfirmation: bool
    inputSchema: JSONSchema
    payload: Optional[Dict[str, Any]] = None


class AgentQuestion(BaseModel):
    id: str
    prompt: str
    inputSchema: JSONSchema


class RuleEvaluation(BaseModel):
    ruleId: str
    outcome: str
    evidence: Optional[List[str]] = None


class AgentTrace(BaseModel):
    traceId: str
    timestamp: str
    rulesEvaluated: List[RuleEvaluation]
    modelNotes: List[str]


class SpecRuleMeta(BaseModel):
    ruleId: str
    severity: str
    ruleVersion: int


class SpecTrace(BaseModel):
    specId: str
    specVersionUsed: int
    regulationRef: Optional[str] = None
    snippet: Optional[str] = None
    ruleIdsUsed: List[str] = Field(default_factory=list)
    rulesMeta: List[SpecRuleMeta] = Field(default_factory=list)
    parsedConditions: List[Dict[str, Any]] = Field(default_factory=list)
    ruleMappingUsed: List[Dict[str, Any]] = Field(default_factory=list)
    constraintsTriggered: List[str] = Field(default_factory=list)


class DecisionTraceMeta(BaseModel):
    spec: Optional[SpecTrace] = None


class CaseEvent(BaseModel):
    id: str
    caseId: str
    timestamp: str
    type: str
    payload: Dict[str, Any]


class AgentPlan(BaseModel):
    caseId: str
    status: CaseStatus
    summary: str
    confidence: float = Field(ge=0.0, le=1.0)
    recommendedActions: List[AgentAction]
    questions: List[AgentQuestion]
    nextState: CaseStatus
    trace: AgentTrace
    events: Optional[List[CaseEvent]] = None


class AgentActionRequest(BaseModel):
    input: Optional[Dict[str, Any]] = None


class AgentInputRequest(BaseModel):
    questionId: str
    input: Dict[str, Any]


class ReviewDecisionRequest(BaseModel):
    decision: str
    notes: Optional[str] = None


class AgentCaseSummary(BaseModel):
    caseId: str
    title: str
    summary: Optional[str] = None
    status: str
    updatedAt: str


JSONSchema.update_forward_refs()
