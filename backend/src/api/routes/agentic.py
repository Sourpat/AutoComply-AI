from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.workflow.repo import get_case as get_workflow_case
from app.data.agentic_cases import (
    append_case_event,
    get_case as get_agentic_case,
    list_case_events,
    list_cases as list_agentic_cases,
    upsert_case,
)
from src.core.db import execute_sql, get_raw_connection
from src.autocomply.audit.decision_log import get_decision_log
from src.autocomply.domain.submissions_store import get_submission_store
from src.api.dependencies.auth import require_override_role
from src.policy.overrides import (
    PolicyOverrideAction,
    create_policy_override,
    get_policy_override_for_submission,
    list_policy_overrides,
    override_action_to_status,
)
from src.api.models.agentic import (
    AgentAction,
    AgentActionIntent,
    AgentActionRequest,
    AgentCaseSummary,
    AgentInputRequest,
    AgentPlan,
    AgentQuestion,
    AgentTrace,
    CaseStatus,
    CaseEvent,
    JSONSchema,
    RuleEvaluation,
    ReviewDecisionRequest,
)

router = APIRouter(prefix="/api/agentic", tags=["agentic"])


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _resolve_trace_id(submission_id: str) -> Optional[str]:
    store = get_submission_store()
    submission = store.get_submission(submission_id)
    if submission and submission.trace_id:
        return submission.trace_id

    rows = execute_sql(
        "SELECT trace_id FROM cases WHERE submission_id = :submission_id LIMIT 1",
        {"submission_id": submission_id},
    )
    if rows:
        trace_id = rows[0].get("trace_id")
        if isinstance(trace_id, str) and trace_id.strip():
            return trace_id
    return None


class PolicyOverrideRequest(BaseModel):
    action: PolicyOverrideAction
    rationale: str = Field(..., min_length=15)
    reviewer: str = Field(..., min_length=1)


class PolicyOverrideResponse(BaseModel):
    override: Dict[str, str]
    before_status: Optional[str] = None
    after_status: Optional[str] = None


def _trace(case_id: str, case_exists: bool, summary_present: bool, notes: Optional[list[str]] = None) -> AgentTrace:
    return AgentTrace(
        traceId=str(uuid.uuid4()),
        timestamp=_now_iso(),
        rulesEvaluated=[
            RuleEvaluation(ruleId="rule.case.exists", outcome="pass" if case_exists else "fail"),
            RuleEvaluation(
                ruleId="rule.summary.present",
                outcome="pass" if summary_present else "fail",
            ),
            RuleEvaluation(ruleId="rule.validation.placeholder", outcome="unknown"),
        ],
        modelNotes=notes or [],
    )


def _action(
    action_id: str,
    label: str,
    intent: AgentActionIntent,
    requires_confirmation: bool,
    input_schema: Optional[Dict[str, Any]] = None,
) -> AgentAction:
    schema = JSONSchema(**(input_schema or {"type": "object", "properties": {}}))
    return AgentAction(
        id=action_id,
        label=label,
        intent=intent,
        requiresConfirmation=requires_confirmation,
        inputSchema=schema,
    )


def _actions_for_status(status: CaseStatus) -> list[AgentAction]:
    if status in {CaseStatus.DRAFT, CaseStatus.NEEDS_INPUT}:
        return [
            _action("open_console", "Open case console", AgentActionIntent.OPEN_CONSOLE, False),
        ]
    if status == CaseStatus.EVALUATING:
        return [
            _action("run_check", "Run compliance check", AgentActionIntent.RUN_CHECK, True),
            _action("open_console", "Open case console", AgentActionIntent.OPEN_CONSOLE, False),
        ]
    if status == CaseStatus.QUEUED_REVIEW:
        return [
            _action("route_review", "Route to review", AgentActionIntent.ROUTE_REVIEW, True),
        ]
    if status == CaseStatus.BLOCKED:
        return [
            _action("route_review", "Route to review", AgentActionIntent.ROUTE_REVIEW, True),
            _action("open_console", "Open case console", AgentActionIntent.OPEN_CONSOLE, False),
        ]
    return [
        _action("open_console", "Open case console", AgentActionIntent.OPEN_CONSOLE, False),
    ]


def _get_agentic_state(case_id: str) -> Optional[Dict[str, Any]]:
    with get_raw_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT status, next_state, next_required_input FROM agentic_case_state WHERE case_id = ?",
            (case_id,),
        )
        row = cursor.fetchone()
        cursor.close()

    if not row:
        return None

    next_required_input = None
    if row[2]:
        try:
            next_required_input = json.loads(row[2])
        except json.JSONDecodeError:
            next_required_input = None

    return {
        "status": row[0],
        "next_state": row[1],
        "next_required_input": next_required_input,
    }


def _save_agentic_state(
    case_id: str,
    status: CaseStatus,
    next_state: CaseStatus,
    next_required_input: Optional[Dict[str, Any]] = None,
) -> None:
    previous = _get_agentic_state(case_id)

    with get_raw_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO agentic_case_state (case_id, status, next_state, next_required_input, updated_at)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(case_id)
            DO UPDATE SET
                status = excluded.status,
                next_state = excluded.next_state,
                next_required_input = excluded.next_required_input,
                updated_at = excluded.updated_at
            """,
            (
                case_id,
                status.value,
                next_state.value,
                json.dumps(next_required_input) if next_required_input else None,
                _now_iso(),
            ),
        )
        conn.commit()
        cursor.close()

    upsert_case(
        case_id,
        {
            "status": status.value,
        },
    )

    if previous is None or previous.get("status") != status.value:
        append_case_event(
            case_id,
            "status_change",
            {"status": status.value},
        )


def _build_plan(case_id: str, note: Optional[str] = None) -> AgentPlan:
    agentic_case = get_agentic_case(case_id)
    workflow_case = get_workflow_case(case_id)
    persisted = _get_agentic_state(case_id)

    questions: list[AgentQuestion] = []
    recommended_actions: list[AgentAction] = []
    summary = "Draft plan generated for agentic workflow."
    status = CaseStatus.DRAFT
    next_state = CaseStatus.DRAFT
    confidence = 0.42
    next_required_input = None

    if agentic_case is None and workflow_case is not None:
        agentic_case = upsert_case(
            case_id,
            {
                "title": workflow_case.title,
                "summary": workflow_case.summary,
                "status": workflow_case.status.value,
            },
        )

    if persisted:
        status = CaseStatus(persisted["status"])
        next_state = CaseStatus(persisted["next_state"])
        summary = note or "Loaded persisted agentic state."
        confidence = 0.55
        if persisted["next_required_input"]:
            questions.append(
                AgentQuestion(
                    id="missing_input",
                    prompt="Provide missing case details to continue.",
                    inputSchema=JSONSchema(**persisted["next_required_input"]),
                )
            )

    if agentic_case is None and workflow_case is None and not persisted:
        upsert_case(
            case_id,
            {
                "title": "Agentic Case",
                "summary": None,
                "status": status.value,
            },
        )
        recommended_actions = [
            _action("open_console", "Open case console", AgentActionIntent.OPEN_CONSOLE, False),
        ]
        trace = _trace(case_id, False, False, [note] if note else [])
        append_case_event(
            case_id,
            "agent_plan",
            {
                "status": status.value,
                "nextState": next_state.value,
                "summary": summary,
                "confidence": confidence,
            },
        )
        events = [CaseEvent(**event) for event in list_case_events(case_id, 10)]
        return AgentPlan(
            caseId=case_id,
            status=status,
            summary=summary,
            confidence=confidence,
            recommendedActions=recommended_actions,
            questions=questions,
            nextState=next_state,
            trace=trace,
            events=events,
        )

    if (agentic_case or workflow_case) and not persisted:
        title = ((agentic_case or {}).get("title") or (workflow_case.title if workflow_case else "") or "").lower()
        summary_text = ((agentic_case or {}).get("summary") or (workflow_case.summary if workflow_case else "") or "").strip()

        if not summary_text:
            status = CaseStatus.NEEDS_INPUT
            next_state = CaseStatus.NEEDS_INPUT
            summary = "Case summary missing; request input before evaluation."
            next_required_input = {
                "type": "object",
                "properties": {
                    "summary": {"type": "string", "title": "Case summary"},
                },
                "required": ["summary"],
            }
            questions = [
                AgentQuestion(
                    id="missing_summary",
                    prompt="Please provide a brief case summary.",
                    inputSchema=JSONSchema(**next_required_input),
                )
            ]
            recommended_actions = [
                _action("open_console", "Open case console", AgentActionIntent.OPEN_CONSOLE, False),
            ]
            confidence = 0.38
        elif "fail" in title or "validation" in title:
            status = CaseStatus.QUEUED_REVIEW
            next_state = CaseStatus.QUEUED_REVIEW
            summary = "Potential validation failures detected; route to review."
            recommended_actions = [
                _action("route_review", "Route to review", AgentActionIntent.ROUTE_REVIEW, True),
            ]
            confidence = 0.62
        elif (workflow_case and workflow_case.status.value == "approved") or (
            agentic_case and agentic_case.get("status") == "approved"
        ):
            status = CaseStatus.APPROVED
            next_state = CaseStatus.COMPLETED
            summary = "Case already approved."
            recommended_actions = [
                _action("open_console", "Open case console", AgentActionIntent.OPEN_CONSOLE, False),
            ]
            confidence = 0.9
        elif (workflow_case and workflow_case.status.value == "blocked") or (
            agentic_case and agentic_case.get("status") == "blocked"
        ):
            status = CaseStatus.BLOCKED
            next_state = CaseStatus.BLOCKED
            summary = "Case is blocked."
            recommended_actions = [
                _action("send_to_human_review", "Send to human review", AgentActionIntent.ROUTE_REVIEW, True),
            ]
            confidence = 0.88
        else:
            status = CaseStatus.EVALUATING
            next_state = CaseStatus.QUEUED_REVIEW
            summary = "Ready to run deterministic checks."
            recommended_actions = [
                _action("run_check", "Run compliance check", AgentActionIntent.RUN_CHECK, True),
                _action("open_console", "Open case console", AgentActionIntent.OPEN_CONSOLE, False),
            ]
            confidence = 0.66

    if not recommended_actions:
        recommended_actions = _actions_for_status(status)

    if next_required_input:
        _save_agentic_state(case_id, status, next_state, next_required_input)
    else:
        _save_agentic_state(case_id, status, next_state, None)

    trace_notes = [note] if note else []
    trace = _trace(
        case_id,
        agentic_case is not None or workflow_case is not None,
        bool((agentic_case or {}).get("summary") or (workflow_case and workflow_case.summary)),
        trace_notes,
    )
    append_case_event(
        case_id,
        "agent_plan",
        {
            "status": status.value,
            "nextState": next_state.value,
            "summary": summary,
            "confidence": confidence,
        },
    )
    events = [CaseEvent(**event) for event in list_case_events(case_id, 10)]
    return AgentPlan(
        caseId=case_id,
        status=status,
        summary=summary,
        confidence=confidence,
        recommendedActions=recommended_actions,
        questions=questions,
        nextState=next_state,
        trace=trace,
        events=events,
    )


@router.get("/cases/{case_id}/plan", response_model=AgentPlan)
def get_agent_plan(case_id: str) -> AgentPlan:
    return _build_plan(case_id)


@router.get("/cases", response_model=list[AgentCaseSummary])
def list_agentic_case_summaries() -> list[AgentCaseSummary]:
    cases = list_agentic_cases(50)
    return [AgentCaseSummary(**case) for case in cases]


@router.get("/cases/{case_id}/events", response_model=list[CaseEvent])
def get_case_events(case_id: str) -> list[CaseEvent]:
    events = list_case_events(case_id, 10)
    return [CaseEvent(**event) for event in events]


@router.post("/cases/{case_id}/actions/{action_id}", response_model=AgentPlan)
def post_agent_action(case_id: str, action_id: str, payload: AgentActionRequest) -> AgentPlan:
    if action_id not in {"open_console", "route_review", "run_check", "send_to_human_review"}:
        raise HTTPException(status_code=400, detail=f"Unsupported action_id: {action_id}")

    if action_id == "open_console":
        append_case_event(
            case_id,
            "action",
            {"actionId": action_id, "input": payload.input},
        )
        plan = _build_plan(case_id, note="open_console invoked")
        return plan

    if action_id in {"route_review", "send_to_human_review"}:
        append_case_event(
            case_id,
            "action",
            {"actionId": action_id, "input": payload.input},
        )
        _save_agentic_state(case_id, CaseStatus.QUEUED_REVIEW, CaseStatus.QUEUED_REVIEW, None)
        return _build_plan(case_id, note="route_review invoked")

    if action_id == "run_check":
        append_case_event(
            case_id,
            "action",
            {"actionId": action_id, "input": payload.input},
        )
        result_status = CaseStatus.BLOCKED if "block" in case_id.lower() else CaseStatus.APPROVED
        _save_agentic_state(case_id, result_status, result_status, None)
        return _build_plan(case_id, note=f"run_check invoked -> {result_status.value}")

    raise HTTPException(status_code=400, detail=f"Unhandled action_id: {action_id}")


@router.post("/cases/{case_id}/inputs", response_model=AgentPlan)
def submit_case_input(case_id: str, payload: AgentInputRequest) -> AgentPlan:
    append_case_event(
        case_id,
        "user_input",
        {"questionId": payload.questionId, "input": payload.input},
    )

    if "summary" in payload.input:
        upsert_case(case_id, {"summary": payload.input.get("summary")})

    return _build_plan(case_id, note="user_input received")


@router.post("/cases/{case_id}/review/decision", response_model=AgentPlan)
def review_decision(case_id: str, payload: ReviewDecisionRequest) -> AgentPlan:
    decision = payload.decision.lower()
    if decision not in {"approve", "block"}:
        raise HTTPException(status_code=400, detail="decision must be approve or block")

    status = CaseStatus.APPROVED if decision == "approve" else CaseStatus.BLOCKED
    append_case_event(
        case_id,
        "action",
        {"actionId": "review_decision", "decision": decision, "notes": payload.notes},
    )
    _save_agentic_state(case_id, status, status, None)
    return _build_plan(case_id, note=f"review_decision -> {status.value}")


@router.post(
    "/cases/{submission_id}/policy-override",
    response_model=PolicyOverrideResponse,
)
def apply_policy_override(
    submission_id: str,
    payload: PolicyOverrideRequest,
    role: str = Depends(require_override_role),
) -> PolicyOverrideResponse:
    trace_id = _resolve_trace_id(submission_id)
    if not trace_id:
        raise HTTPException(status_code=404, detail="Trace ID not found for submission")

    action = payload.action
    rationale = payload.rationale.strip()
    reviewer = payload.reviewer.strip() or role

    if not rationale or not reviewer:
        raise HTTPException(status_code=400, detail="rationale and reviewer are required")

    decision_log = get_decision_log()
    entries = decision_log.get_entries_for_trace(trace_id)
    before_status = None
    if entries:
        before_status = entries[-1].status

    after_status = override_action_to_status(action).value

    override = create_policy_override(
        trace_id=trace_id,
        submission_id=submission_id,
        override_action=action,
        rationale=rationale,
        reviewer=reviewer,
    )

    decision_log.record_policy_override(
        trace_id=trace_id,
        override=override,
        before_status=before_status,
        after_status=after_status,
    )

    return PolicyOverrideResponse(
        override=override,
        before_status=before_status,
        after_status=after_status,
    )


@router.get(
    "/cases/{submission_id}/policy-override",
    response_model=PolicyOverrideResponse,
)
def get_policy_override(submission_id: str) -> PolicyOverrideResponse:
    override = get_policy_override_for_submission(submission_id)
    if not override:
        return PolicyOverrideResponse(override={}, before_status=None, after_status=None)

    after_status = None
    action = override.get("override_action")
    if action in {"approve", "block", "require_review"}:
        after_status = override_action_to_status(action).value

    return PolicyOverrideResponse(
        override=override,
        before_status=override.get("before_status"),
        after_status=after_status,
    )


@router.get("/policy-overrides/recent", response_model=list[Dict[str, str]])
def list_recent_policy_overrides(limit: int = 200) -> list[Dict[str, str]]:
    return list_policy_overrides(limit=limit)


@router.post("/demo/seed", response_model=list[AgentCaseSummary])
def seed_demo_cases() -> list[AgentCaseSummary]:
    demo_cases = [
        {
            "caseId": "demo-ok",
            "title": "Demo case (ok)",
            "summary": "All required fields present.",
            "status": CaseStatus.EVALUATING.value,
        },
        {
            "caseId": "demo-needs-input",
            "title": "Demo case (needs input)",
            "summary": "",
            "status": CaseStatus.NEEDS_INPUT.value,
        },
        {
            "caseId": "demo-block",
            "title": "Demo case (block)",
            "summary": "Validation failure detected.",
            "status": CaseStatus.BLOCKED.value,
        },
    ]

    summaries: list[AgentCaseSummary] = []
    for demo in demo_cases:
        case = upsert_case(
            demo["caseId"],
            {
                "title": demo["title"],
                "summary": demo["summary"],
                "status": demo["status"],
            },
        )
        summaries.append(AgentCaseSummary(**case))

    return summaries
