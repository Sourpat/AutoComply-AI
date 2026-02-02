from __future__ import annotations

from typing import Any, Dict, Optional

from src.api.models.decision import DecisionOutcome, DecisionStatus
from src.config import get_settings
from src.policy.contracts import get_active_contract
from src.policy.engine import evaluate_policy
from src.policy.models import DecisionContext, PolicyResult


def _compute_model_confidence(risk_score: Optional[float]) -> Optional[float]:
    if risk_score is None:
        return None
    return max(0.0, min(1.0, 1.0 - risk_score))


def apply_policy(
    decision: DecisionOutcome,
    *,
    decision_type: str,
    user_role: Optional[str] = None,
    jurisdiction: Optional[str] = None,
    flags: Optional[Dict[str, Any]] = None,
) -> DecisionOutcome:
    settings = get_settings()
    enforcement_mode = (settings.POLICY_ENFORCEMENT_MODE or "enforce").lower()

    debug_info = decision.debug_info or {}
    context_flags: Dict[str, Any] = {}
    if isinstance(debug_info, dict):
        debug_flags = debug_info.get("flags")
        if isinstance(debug_flags, dict):
            context_flags.update(debug_flags)
        if "missing_fields" in debug_info:
            context_flags["missing_fields"] = bool(debug_info.get("missing_fields"))
        if "conflicts" in debug_info:
            context_flags["conflicts"] = bool(debug_info.get("conflicts"))

    if flags:
        context_flags.update(flags)

    contract = get_active_contract()
    context = DecisionContext(
        model_confidence=_compute_model_confidence(decision.risk_score),
        risk_level=decision.risk_level,
        form_type=decision_type,
        user_role=user_role or (debug_info.get("user_role") if isinstance(debug_info, dict) else None),
        jurisdiction=jurisdiction
        or (debug_info.get("jurisdiction") if isinstance(debug_info, dict) else None)
        or (debug_info.get("ship_to_state") if isinstance(debug_info, dict) else None),
        flags=context_flags,
    )

    policy_result: PolicyResult = evaluate_policy(contract, context)
    decision.policy_trace = policy_result.model_dump(by_alias=True)

    if enforcement_mode == "off":
        return decision

    if enforcement_mode != "enforce":
        return decision

    if decision.status == DecisionStatus.BLOCKED and policy_result.allowed_action != "block":
        return decision

    if policy_result.allowed_action == "block":
        decision.status = DecisionStatus.BLOCKED
    elif policy_result.fail_safe or policy_result.allowed_action in {
        "require_human",
        "escalate",
    }:
        decision.status = DecisionStatus.NEEDS_REVIEW

    return decision
