from __future__ import annotations

from typing import Any, Dict, Optional

from src.policy.models import DecisionContext, PolicyGate, PolicyResult, AiDecisionContract


def _matches_conditions(conditions: Optional[Dict[str, Any]], context: DecisionContext) -> bool:
    if not conditions:
        return False

    risk_levels = conditions.get("risk_level")
    if risk_levels:
        if context.risk_level not in {str(level).lower() for level in risk_levels}:
            return False

    form_types = conditions.get("form_type")
    if form_types:
        if context.form_type not in {str(value) for value in form_types}:
            return False

    jurisdictions = conditions.get("jurisdiction")
    if jurisdictions:
        if context.jurisdiction not in {str(value) for value in jurisdictions}:
            return False

    flags = conditions.get("flags")
    if flags:
        for flag in flags:
            if not context.flags.get(flag):
                return False

    return True


def evaluate_policy(
    contract: Optional[AiDecisionContract],
    decision_context: DecisionContext,
) -> PolicyResult:
    if not contract:
        return PolicyResult(
            allowed_action="require_human",
            contract_version_used="missing",
            reason_codes=["missing_contract"],
            gates=[
                PolicyGate(
                    gate_name="contract_present",
                    input=None,
                    pass_=False,
                    explanation="No active AI decision contract found.",
                )
            ],
            fail_safe=True,
        )

    rules = contract.rules
    gates: list[PolicyGate] = []
    reason_codes: list[str] = []

    gates.append(
        PolicyGate(
            gate_name="auto_decision_allowed",
            input=rules.auto_decision_allowed,
            pass_=rules.auto_decision_allowed,
            explanation="Auto-decision allowed by contract.",
        )
    )
    if not rules.auto_decision_allowed:
        reason_codes.append("auto_decision_disabled")

    gates.append(
        PolicyGate(
            gate_name="human_review_required",
            input=rules.human_review_required,
            pass_=not rules.human_review_required,
            explanation="Human review required by contract.",
        )
    )
    if rules.human_review_required:
        reason_codes.append("human_review_required")

    confidence_passed = True
    if rules.confidence_threshold is not None:
        confidence_passed = (
            decision_context.model_confidence is not None
            and decision_context.model_confidence >= rules.confidence_threshold
        )
        gates.append(
            PolicyGate(
                gate_name="confidence_threshold",
                input={
                    "threshold": rules.confidence_threshold,
                    "confidence": decision_context.model_confidence,
                },
                pass_=confidence_passed,
                explanation="Model confidence meets contract threshold.",
            )
        )
        if not confidence_passed:
            reason_codes.append("confidence_below_threshold")

    override_gate_passed = not rules.override_mandatory
    if rules.override_mandatory:
        override_present = bool(decision_context.flags.get("override_present"))
        override_gate_passed = override_present
        gates.append(
            PolicyGate(
                gate_name="override_mandatory",
                input={"override_present": override_present},
                pass_=override_gate_passed,
                explanation="Override required before auto-decision.",
            )
        )
        if not override_gate_passed:
            reason_codes.append("override_required")

    block_match = _matches_conditions(rules.block_on, decision_context)
    if rules.block_on:
        gates.append(
            PolicyGate(
                gate_name="block_on",
                input=rules.block_on,
                pass_=not block_match,
                explanation="Block conditions evaluated.",
            )
        )
        if block_match:
            reason_codes.append("blocked_by_policy")

    escalate_match = _matches_conditions(rules.escalate_on, decision_context)
    if rules.escalate_on:
        gates.append(
            PolicyGate(
                gate_name="escalate_on",
                input=rules.escalate_on,
                pass_=not escalate_match,
                explanation="Escalation conditions evaluated.",
            )
        )
        if escalate_match:
            reason_codes.append("escalate_by_policy")

    allowed_action = "auto_decide"
    if block_match:
        allowed_action = "block"
    elif escalate_match:
        allowed_action = "escalate"
    elif not (rules.auto_decision_allowed and not rules.human_review_required and confidence_passed and override_gate_passed):
        allowed_action = "require_human"

    return PolicyResult(
        allowed_action=allowed_action,
        contract_version_used=contract.version,
        reason_codes=reason_codes,
        gates=gates,
        fail_safe=False,
    )
