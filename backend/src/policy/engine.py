from __future__ import annotations

from typing import Any, Dict, Optional

from src.policy.models import DecisionContext, PolicyGate, PolicyResult, AiDecisionContract
from src.policy.safe_failures import SafeFailureDetail, SafeFailureMode


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
    try:
        if not contract:
            safe_failure = SafeFailureDetail(
                mode=SafeFailureMode.POLICY_FAILSAFE_MISSING_CONTRACT,
                summary="Policy contract missing. Safe fallback to human review.",
                ai_intent="AI would auto-decide ok_to_ship",
                policy_action="require_human",
                confidence=decision_context.model_confidence,
                contract_version="missing",
                reason_codes=["missing_contract"],
                recommended_next_step="Send to human review queue",
            )
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
                safe_failure=safe_failure,
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

        confidence_threshold = rules.confidence_threshold or 0.75
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
        override_present = False
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

        high_confidence = (
            decision_context.model_confidence is not None
            and decision_context.model_confidence >= confidence_threshold
        )
        missing_fields_flag = decision_context.flags.get("missing_fields", None)
        spec_complete = None if missing_fields_flag is None else not bool(missing_fields_flag)

        safe_failure: Optional[SafeFailureDetail] = None
        if allowed_action != "auto_decide":
            if block_match and rules.block_on and rules.block_on.get("flags"):
                safe_failure = SafeFailureDetail(
                    mode=SafeFailureMode.POLICY_BLOCKED_FLAG_CONFLICT,
                    summary="Policy blocked auto-decision due to flagged conflict.",
                    ai_intent="AI would auto-decide ok_to_ship",
                    policy_action=allowed_action,
                    confidence=decision_context.model_confidence,
                    contract_version=contract.version,
                    reason_codes=reason_codes,
                    recommended_next_step="Escalate to compliance review",
                )
            elif block_match and high_confidence:
                safe_failure = SafeFailureDetail(
                    mode=SafeFailureMode.POLICY_BLOCKED_HIGH_CONFIDENCE,
                    summary="Policy blocked a high-confidence auto-decision.",
                    ai_intent="AI would auto-decide ok_to_ship",
                    policy_action=allowed_action,
                    confidence=decision_context.model_confidence,
                    contract_version=contract.version,
                    reason_codes=reason_codes,
                    recommended_next_step="Send to human review queue",
                )
            elif not override_gate_passed:
                safe_failure = SafeFailureDetail(
                    mode=SafeFailureMode.POLICY_OVERRIDE_REQUIRED_MISSING,
                    summary="Policy requires a human override before auto-decision.",
                    ai_intent="AI would auto-decide ok_to_ship",
                    policy_action=allowed_action,
                    confidence=decision_context.model_confidence,
                    contract_version=contract.version,
                    reason_codes=reason_codes,
                    recommended_next_step="Capture required override and re-run review",
                )
            elif allowed_action == "require_human" and high_confidence:
                safe_failure = SafeFailureDetail(
                    mode=SafeFailureMode.POLICY_REQUIRES_REVIEW_HIGH_CONFIDENCE,
                    summary="Policy routed a high-confidence decision to human review.",
                    ai_intent="AI would auto-decide ok_to_ship",
                    policy_action=allowed_action,
                    confidence=decision_context.model_confidence,
                    contract_version=contract.version,
                    reason_codes=reason_codes,
                    recommended_next_step="Send to human review queue",
                )
            elif allowed_action == "escalate" and spec_complete is True:
                safe_failure = SafeFailureDetail(
                    mode=SafeFailureMode.POLICY_ESCALATED_COMPLETE_SPEC,
                    summary="Spec complete, but policy requires escalation.",
                    ai_intent="AI would auto-decide ok_to_ship",
                    policy_action=allowed_action,
                    confidence=decision_context.model_confidence,
                    contract_version=contract.version,
                    reason_codes=reason_codes,
                    recommended_next_step="Escalate to compliance lead",
                )

        return PolicyResult(
            allowed_action=allowed_action,
            contract_version_used=contract.version,
            reason_codes=reason_codes,
            gates=gates,
            fail_safe=False,
            safe_failure=safe_failure,
        )
    except Exception:
        return PolicyResult(
            allowed_action="require_human",
            contract_version_used=contract.version if contract else "missing",
            reason_codes=["policy_engine_error"],
            gates=[
                PolicyGate(
                    gate_name="engine_error",
                    input=None,
                    pass_=False,
                    explanation="Policy engine error; defaulting to human review.",
                )
            ],
            fail_safe=True,
            safe_failure=SafeFailureDetail(
                mode=SafeFailureMode.POLICY_FAILSAFE_ENGINE_ERROR,
                summary="Policy engine error. Safe fallback to human review.",
                ai_intent="AI would auto-decide ok_to_ship",
                policy_action="require_human",
                confidence=decision_context.model_confidence,
                contract_version=contract.version if contract else "missing",
                reason_codes=["policy_engine_error"],
                recommended_next_step="Send to human review queue",
            ),
        )
