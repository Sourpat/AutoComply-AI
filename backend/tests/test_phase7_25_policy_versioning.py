"""
Phase 7.25: Policy Versioning + Rulepack Traceability Tests

Tests for:
- Policy hash determinism
- Policy metadata retrieval
- History stores policy version
- Policy diff computation

Author: AutoComply AI
Date: 2026-01-17
"""

import pytest
from app.policy import (
    get_current_policy,
    compute_policy_hash,
    list_policy_versions,
    diff_policy_versions,
    get_policy_by_version,
)
from app.policy.registry import (
    serialize_rulepack,
    get_current_policy_definition,
)
from app.intelligence.rules_engine import get_rule_pack


def test_policy_hash_deterministic():
    """Test that policy hash is deterministic across multiple calls."""
    policy_def = get_current_policy_definition()
    
    hash1 = compute_policy_hash(policy_def)
    hash2 = compute_policy_hash(policy_def)
    
    assert hash1 == hash2, "Policy hash should be deterministic"
    assert len(hash1) == 64, "SHA256 hash should be 64 characters"
    assert hash1.isalnum(), "Hash should be alphanumeric"


def test_current_policy_metadata():
    """Test that get_current_policy returns valid metadata."""
    policy = get_current_policy()
    
    assert policy.policy_id == "autocomply-rules-v1"
    assert policy.version == "1.0.0"
    assert policy.policy_hash, "Policy hash should be present"
    assert len(policy.policy_hash) == 64, "Policy hash should be SHA256"
    assert policy.rules_count > 0, "Should have rules"
    assert "AutoComply" in policy.summary, "Summary should mention AutoComply"
    assert policy.created_at.endswith("Z"), "Timestamp should be UTC"


def test_serialize_rulepack():
    """Test that RulePack serialization is deterministic."""
    # Get a rule pack
    pack = get_rule_pack("csf")
    
    # Serialize it twice
    serialized1 = serialize_rulepack(pack)
    serialized2 = serialize_rulepack(pack)
    
    assert serialized1 == serialized2, "Serialization should be deterministic"
    
    # Check structure
    assert "case_type" in serialized1
    assert "rules" in serialized1
    assert isinstance(serialized1["rules"], list)
    
    # Check rule structure
    if serialized1["rules"]:
        rule = serialized1["rules"][0]
        assert "id" in rule
        assert "title" in rule
        assert "severity" in rule
        assert "weight" in rule


def test_list_policy_versions():
    """Test that list_policy_versions returns current version."""
    versions = list_policy_versions()
    
    assert len(versions) >= 1, "Should have at least current version"
    
    current = versions[0]
    assert current.policy_id == "autocomply-rules-v1"
    assert current.version == "1.0.0"


def test_get_policy_by_version():
    """Test retrieving policy by specific version."""
    # Get current version
    current_policy = get_current_policy()
    
    # Retrieve by version
    retrieved = get_policy_by_version("1.0.0")
    
    assert retrieved is not None
    assert retrieved.version == current_policy.version
    assert retrieved.policy_hash == current_policy.policy_hash
    
    # Test non-existent version
    non_existent = get_policy_by_version("9.9.9")
    assert non_existent is None


def test_diff_same_version():
    """Test diffing same version returns empty diff."""
    diff = diff_policy_versions("1.0.0", "1.0.0")
    
    assert diff["from_version"] == "1.0.0"
    assert diff["to_version"] == "1.0.0"
    assert len(diff["added_rules"]) == 0
    assert len(diff["removed_rules"]) == 0
    assert len(diff["changed_rules"]) == 0
    assert "No changes" in diff["summary"]


def test_policy_definition_structure():
    """Test that policy definition has expected structure."""
    policy_def = get_current_policy_definition()
    
    assert "policy_id" in policy_def
    assert "version" in policy_def
    assert "case_types" in policy_def
    
    # Check case types
    case_types = policy_def["case_types"]
    assert "csf" in case_types
    assert "csf_practitioner" in case_types
    assert "csf_facility" in case_types
    
    # Check CSF rules
    csf_data = case_types["csf"]
    assert "case_type" in csf_data
    assert "rules" in csf_data
    assert isinstance(csf_data["rules"], list)
    
    # Verify rule structure
    if csf_data["rules"]:
        rule = csf_data["rules"][0]
        assert "id" in rule
        assert "title" in rule
        assert "severity" in rule
        assert "weight" in rule


def test_policy_hash_changes_with_content():
    """Test that changing policy content changes the hash."""
    policy_def = get_current_policy_definition()
    original_hash = compute_policy_hash(policy_def)
    
    # Modify definition
    modified_def = policy_def.copy()
    modified_def["version"] = "2.0.0"
    
    modified_hash = compute_policy_hash(modified_def)
    
    assert original_hash != modified_hash, "Hash should change when content changes"


def test_policy_captured_in_history():
    """
    Test that policy metadata is captured when intelligence is computed.
    
    This is an integration test that verifies the policy versioning
    is properly integrated with the intelligence history system.
    """
    from app.intelligence.repository import insert_intelligence_history, get_intelligence_history
    
    # Create test payload
    test_case_id = "test_case_policy_v1"
    test_payload = {
        "confidence_score": 85.5,
        "confidence_band": "high",
        "decision": "approve",
        "computed_at": "2026-01-17T22:30:00Z",
    }
    
    # Insert history entry (should capture current policy)
    history_id = insert_intelligence_history(
        case_id=test_case_id,
        payload=test_payload,
        actor="test_system",
        reason="Policy versioning test",
    )
    
    # Retrieve history
    history = get_intelligence_history(test_case_id, limit=1)
    
    assert len(history) > 0, "Should have history entry"
    
    entry = history[0]
    assert entry["id"] == history_id
    
    # Verify policy fields are present
    assert "policy_id" in entry
    assert "policy_version" in entry
    assert "policy_hash" in entry
    
    # Verify values match current policy
    current_policy = get_current_policy()
    assert entry["policy_id"] == current_policy.policy_id
    assert entry["policy_version"] == current_policy.version
    assert entry["policy_hash"] == current_policy.policy_hash


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
