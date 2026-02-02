from __future__ import annotations

from src.policy.engine import evaluate_policy
from src.policy.models import AiDecisionContract, ContractRuleSet, DecisionContext
from src.policy.safe_failures import SafeFailureMode


def _contract_with_rules(rules: ContractRuleSet) -> AiDecisionContract:
    return AiDecisionContract(
        id=1,
        version="v-test",
        status="active",
        created_at="2026-02-02T00:00:00Z",
        created_by="tests",
        effective_from="2026-02-02T00:00:00Z",
        rules=rules,
    )


def test_safe_failure_blocked_flag_conflict_high_confidence():
    contract = _contract_with_rules(
        ContractRuleSet(
            auto_decision_allowed=True,
            confidence_threshold=0.5,
            block_on={"flags": ["conflicts"]},
        )
    )

    context = DecisionContext(
        model_confidence=0.9,
        risk_level="low",
        form_type="csf_practitioner",
        flags={"conflicts": True},
    )

    result = evaluate_policy(contract, context)

    assert result.allowed_action == "block"
    assert result.safe_failure is not None
    assert result.safe_failure.mode in {
        SafeFailureMode.POLICY_BLOCKED_FLAG_CONFLICT,
        SafeFailureMode.POLICY_BLOCKED_HIGH_CONFIDENCE,
    }


def test_safe_failure_missing_contract_failsafe():
    context = DecisionContext(model_confidence=0.8, flags={})

    result = evaluate_policy(None, context)

    assert result.fail_safe is True
    assert result.safe_failure is not None
    assert result.safe_failure.mode == SafeFailureMode.POLICY_FAILSAFE_MISSING_CONTRACT
