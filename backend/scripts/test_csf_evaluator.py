"""
Test script for CSF Practitioner Deterministic Evaluator

Validates that the evaluator correctly processes the 3 mock scenarios:
1. BLOCKED - Missing DEA
2. NEEDS_REVIEW - Expiring credentials + missing attestation
3. APPROVED - All requirements met
"""

import sys
import os
from pathlib import Path

# Add backend/src to PYTHONPATH so src.* imports work
backend_src = Path(__file__).parent.parent / "src"
sys.path.insert(0, str(backend_src))
os.environ["PYTHONPATH"] = str(backend_src)

from src.autocomply.domain.csf_practitioner_evaluator import (
    evaluate_csf_practitioner_decision,
    get_mock_scenarios,
)


def test_scenario(scenario_id: str, scenario_data: dict):
    """Test a single scenario."""
    print(f"\n{'='*60}")
    print(f"Scenario: {scenario_data['name']}")
    print(f"{'='*60}")
    print(f"Description: {scenario_data['description']}\n")
    
    result = evaluate_csf_practitioner_decision(
        evidence=scenario_data['evidence'],
        decision_type="csf_practitioner"
    )
    
    # Display outcome
    outcome_emoji = {
        "approved": "✅",
        "needs_review": "⚠️",
        "blocked": "❌"
    }
    print(f"Outcome: {outcome_emoji.get(result.outcome, '❓')} {result.outcome.upper()}")
    print(f"Explanation: {result.explanation}\n")
    
    # Display fired rules by severity
    if result.fired_rules:
        print(f"Fired Rules ({len(result.fired_rules)} total):")
        
        for severity in ["block", "review", "info"]:
            rules_of_severity = [r for r in result.fired_rules if r.severity == severity]
            if rules_of_severity:
                severity_label = {
                    "block": "🚫 BLOCK",
                    "review": "⚠️  REVIEW",
                    "info": "ℹ️  INFO"
                }
                print(f"\n  {severity_label[severity]} ({len(rules_of_severity)} rules):")
                for rule in rules_of_severity:
                    print(f"    - [{rule.citation}] {rule.title}")
                    print(f"      {rule.requirement[:100]}...")
    
    # Display missing evidence
    if result.missing_evidence:
        print(f"\nMissing Evidence ({len(result.missing_evidence)} items):")
        for item in result.missing_evidence:
            print(f"  ❗ {item}")
    
    # Display next steps
    if result.next_steps:
        print(f"\nNext Steps ({len(result.next_steps)} items):")
        for step in result.next_steps:
            print(f"  → {step}")
    
    print()
    
    # Validate expected outcome
    expected_outcome_map = {
        "blocked": "blocked",
        "needs_review": "needs_review",
        "approved": "approved",
    }
    expected = expected_outcome_map.get(scenario_id)
    if expected and result.outcome != expected:
        print(f"❌ ERROR: Expected outcome '{expected}' but got '{result.outcome}'")
        return False
    
    print(f"✅ Scenario '{scenario_id}' validation PASSED")
    return True


def main():
    print("="*60)
    print("CSF Practitioner Evaluator Test Suite")
    print("="*60)
    
    scenarios = get_mock_scenarios()
    passed = 0
    failed = 0
    
    for scenario_id, scenario_data in scenarios.items():
        try:
            if test_scenario(scenario_id, scenario_data):
                passed += 1
            else:
                failed += 1
        except Exception as e:
            print(f"\n❌ ERROR in scenario '{scenario_id}': {e}")
            import traceback
            traceback.print_exc()
            failed += 1
    
    print("\n" + "="*60)
    print("Test Summary")
    print("="*60)
    print(f"Total Scenarios: {len(scenarios)}")
    print(f"✅ Passed: {passed}")
    print(f"❌ Failed: {failed}")
    
    if failed > 0:
        print("\n❌ SOME TESTS FAILED")
        sys.exit(1)
    else:
        print("\n✅ ALL TESTS PASSED")
        sys.exit(0)


if __name__ == "__main__":
    main()
