from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from fastapi import APIRouter, HTTPException

from app.workflow.repo import get_case
from src.core.db import get_raw_connection
from src.api.models.agentic import (
    AgentAction,
    AgentActionIntent,
    AgentActionRequest,
    AgentPlan,
    AgentQuestion,
    AgentTrace,
    CaseStatus,
    JSONSchema,
    RuleEvaluation,
)

router = APIRouter(prefix="/api/agentic", tags=["agentic"])


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


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


def _build_plan(case_id: str, note: Optional[str] = None) -> AgentPlan:
    case = get_case(case_id)
    persisted = _get_agentic_state(case_id)

    questions: list[AgentQuestion] = []
    recommended_actions: list[AgentAction] = []
    summary = "Draft plan generated for agentic workflow."
    status = CaseStatus.DRAFT
    next_state = CaseStatus.DRAFT
    confidence = 0.42
    next_required_input = None

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

    if case is None and not persisted:
        recommended_actions = [
            _action("open_console", "Open case console", AgentActionIntent.OPEN_CONSOLE, False),
        ]
        trace = _trace(case_id, False, False, [note] if note else [])
        return AgentPlan(
            caseId=case_id,
            status=status,
            summary=summary,
            confidence=confidence,
            recommendedActions=recommended_actions,
            questions=questions,
            nextState=next_state,
            trace=trace,
        )

    if case and not persisted:
        title = (case.title or "").lower()
        summary_text = (case.summary or "").strip()

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
        elif case.status.value == "approved":
            status = CaseStatus.APPROVED
            next_state = CaseStatus.COMPLETED
            summary = "Case already approved."
            recommended_actions = [
                _action("open_console", "Open case console", AgentActionIntent.OPEN_CONSOLE, False),
            ]
            confidence = 0.9
        elif case.status.value == "blocked":
            status = CaseStatus.BLOCKED
            next_state = CaseStatus.BLOCKED
            summary = "Case is blocked."
            recommended_actions = [
                _action("route_review", "Route to review", AgentActionIntent.ROUTE_REVIEW, True),
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
    trace = _trace(case_id, case is not None, bool(case and case.summary), trace_notes)
    return AgentPlan(
        caseId=case_id,
        status=status,
        summary=summary,
        confidence=confidence,
        recommendedActions=recommended_actions,
        questions=questions,
        nextState=next_state,
        trace=trace,
    )


@router.get("/cases/{case_id}/plan", response_model=AgentPlan)
def get_agent_plan(case_id: str) -> AgentPlan:
    return _build_plan(case_id)


@router.post("/cases/{case_id}/actions/{action_id}", response_model=AgentPlan)
def post_agent_action(case_id: str, action_id: str, payload: AgentActionRequest) -> AgentPlan:
    if action_id not in {"open_console", "route_review", "run_check"}:
        raise HTTPException(status_code=400, detail=f"Unsupported action_id: {action_id}")

    if action_id == "open_console":
        plan = _build_plan(case_id, note="open_console invoked")
        return plan

    if action_id == "route_review":
        _save_agentic_state(case_id, CaseStatus.QUEUED_REVIEW, CaseStatus.QUEUED_REVIEW, None)
        return _build_plan(case_id, note="route_review invoked")

    if action_id == "run_check":
        result_status = CaseStatus.BLOCKED if "block" in case_id.lower() else CaseStatus.APPROVED
        _save_agentic_state(case_id, result_status, result_status, None)
        return _build_plan(case_id, note=f"run_check invoked -> {result_status.value}")

    raise HTTPException(status_code=400, detail=f"Unhandled action_id: {action_id}")
