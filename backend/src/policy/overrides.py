from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Dict, List, Literal, Optional

from src.api.models.decision import DecisionOutcome, DecisionStatus
from src.core.db import execute_insert, execute_sql

PolicyOverrideAction = Literal["approve", "block", "require_review"]


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _map_override_status(action: PolicyOverrideAction) -> DecisionStatus:
    if action == "approve":
        return DecisionStatus.OK_TO_SHIP
    if action == "block":
        return DecisionStatus.BLOCKED
    return DecisionStatus.NEEDS_REVIEW


def override_action_to_status(action: PolicyOverrideAction) -> DecisionStatus:
    return _map_override_status(action)


def apply_policy_override(decision: DecisionOutcome, override: Dict[str, str]) -> DecisionOutcome:
    """Apply override to a decision and attach override metadata."""
    action = override.get("override_action")
    if action in {"approve", "block", "require_review"}:
        decision.status = _map_override_status(action)
    decision.policy_override = override
    return decision


def create_policy_override(
    *,
    trace_id: str,
    submission_id: str,
    override_action: PolicyOverrideAction,
    rationale: str,
    reviewer: str,
) -> Dict[str, str]:
    override_id = str(uuid.uuid4())
    created_at = _now_iso()

    execute_insert(
        """
        INSERT INTO policy_overrides (
            id, trace_id, submission_id, override_action, rationale, reviewer, created_at
        ) VALUES (
            :id, :trace_id, :submission_id, :override_action, :rationale, :reviewer, :created_at
        )
        """,
        {
            "id": override_id,
            "trace_id": trace_id,
            "submission_id": submission_id,
            "override_action": override_action,
            "rationale": rationale,
            "reviewer": reviewer,
            "created_at": created_at,
        },
    )

    return {
        "id": override_id,
        "trace_id": trace_id,
        "submission_id": submission_id,
        "override_action": override_action,
        "rationale": rationale,
        "reviewer": reviewer,
        "created_at": created_at,
    }


def get_policy_override_for_trace(trace_id: str) -> Optional[Dict[str, str]]:
    rows = execute_sql(
        """
        SELECT * FROM policy_overrides
        WHERE trace_id = :trace_id
        ORDER BY created_at DESC
        LIMIT 1
        """,
        {"trace_id": trace_id},
    )
    if not rows:
        return None
    return dict(rows[0])


def get_policy_override_for_submission(submission_id: str) -> Optional[Dict[str, str]]:
    rows = execute_sql(
        """
        SELECT * FROM policy_overrides
        WHERE submission_id = :submission_id
        ORDER BY created_at DESC
        LIMIT 1
        """,
        {"submission_id": submission_id},
    )
    if not rows:
        return None
    return dict(rows[0])


def list_policy_overrides(limit: int = 100) -> List[Dict[str, str]]:
    rows = execute_sql(
        """
        SELECT * FROM policy_overrides
        ORDER BY created_at DESC
        LIMIT :limit
        """,
        {"limit": limit},
    )
    return [dict(row) for row in rows]
