from src.policy.engine import evaluate_policy
from src.policy.models import AiDecisionContract, ContractRuleSet, DecisionContext


def _contract(**overrides) -> AiDecisionContract:
    rules = ContractRuleSet(**overrides)
    return AiDecisionContract(
        id=1,
        version="v1",
        status="active",
        created_at="2026-02-02T00:00:00Z",
        created_by="system",
        effective_from="2026-02-02T00:00:00Z",
        rules=rules,
    )


def test_confidence_threshold_gate_blocks_low_confidence():
    contract = _contract(confidence_threshold=0.8)
    context = DecisionContext(model_confidence=0.5, risk_level="low")
    result = evaluate_policy(contract, context)

    assert result.allowed_action == "require_human"
    assert "confidence_below_threshold" in result.reason_codes
    assert any(g.gate_name == "confidence_threshold" and g.pass_ is False for g in result.gates)


def test_auto_decision_disabled_overrides_high_confidence():
    contract = _contract(auto_decision_allowed=False, confidence_threshold=0.1)
    context = DecisionContext(model_confidence=0.99, risk_level="low")
    result = evaluate_policy(contract, context)

    assert result.allowed_action == "require_human"
    assert "auto_decision_disabled" in result.reason_codes


def test_missing_contract_triggers_fail_safe():
    context = DecisionContext(model_confidence=0.9, risk_level="low")
    result = evaluate_policy(None, context)

    assert result.fail_safe is True
    assert result.allowed_action == "require_human"
    assert result.contract_version_used == "missing"


def test_block_on_flags_blocks_auto_decision():
    contract = _contract(block_on={"flags": ["conflicts"]})
    context = DecisionContext(model_confidence=0.9, risk_level="low", flags={"conflicts": True})
    result = evaluate_policy(contract, context)

    assert result.allowed_action == "block"
    assert "blocked_by_policy" in result.reason_codes


def test_escalate_on_risk_level_escalates():
    contract = _contract(escalate_on={"risk_level": ["high"]})
    context = DecisionContext(model_confidence=0.9, risk_level="high")
    result = evaluate_policy(contract, context)

    assert result.allowed_action == "escalate"
    assert "escalate_by_policy" in result.reason_codes
