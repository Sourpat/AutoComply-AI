from __future__ import annotations

from typing import Any, Dict, Optional, Tuple

from src.api.models.decision import DecisionStatus
from src.autocomply.domain.csf_practitioner import CsDecisionStatus
from src.policy.contracts import get_active_contract
from src.policy.engine import evaluate_policy
from src.policy.models import DecisionContext, PolicyResult


def _compute_model_confidence(risk_score: Optional[float]) -> Optional[float]:
    if risk_score is None:
        return None
    return max(0.0, min(1.0, 1.0 - risk_score))


def apply_policy_to_decision(
    *,
    status: DecisionStatus,
    risk_level: Optional[str],
    risk_score: Optional[float],
    form_type: Optional[str],
    user_role: Optional[str],
    jurisdiction: Optional[str],
    flags: Optional[Dict[str, Any]] = None,
) -> Tuple[DecisionStatus, PolicyResult]:
    contract = get_active_contract()
    context = DecisionContext(
        model_confidence=_compute_model_confidence(risk_score),
        risk_level=risk_level,
        form_type=form_type,
        user_role=user_role,
        jurisdiction=jurisdiction,
        flags=flags or {},
    )

    policy_result = evaluate_policy(contract, context)

    if policy_result.allowed_action == "block":
        return DecisionStatus.BLOCKED, policy_result
    if policy_result.allowed_action in {"require_human", "escalate"}:
        return DecisionStatus.NEEDS_REVIEW, policy_result

    return status, policy_result


def map_policy_status_to_csf(status: DecisionStatus) -> CsDecisionStatus:
    if status == DecisionStatus.BLOCKED:
        return CsDecisionStatus.BLOCKED
    if status == DecisionStatus.NEEDS_REVIEW:
        return CsDecisionStatus.NEEDS_REVIEW
    return CsDecisionStatus.OK_TO_SHIP
