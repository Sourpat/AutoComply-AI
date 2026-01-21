"""
Policy Registry (Phase 7.25).

Manages policy versions, provides current policy metadata, and computes policy diffs.
"""

import hashlib
import json
from typing import Dict, List, Any, Optional
from datetime import datetime, timezone

from .models import PolicyMeta
from app.intelligence.rules_engine import (
    get_rule_pack,
    RulePack,
)


# =============================================================================
# Policy Version Registry
# =============================================================================

# Current policy version (bump when rules change)
CURRENT_POLICY_VERSION = "1.0.0"
CURRENT_POLICY_ID = "autocomply-rules-v1"


def compute_policy_hash(policy_definition: Dict[str, Any]) -> str:
    """
    Compute SHA256 hash of normalized policy definition.
    
    Args:
        policy_definition: Dict representing the policy (e.g., serialized rulepacks)
        
    Returns:
        SHA256 hash as hex string
        
    Example:
        >>> policy_def = {"rules": [...], "version": "1.0.0"}
        >>> compute_policy_hash(policy_def)
        "a1b2c3d4..."
    """
    # Normalize: sorted keys, no whitespace
    normalized_json = json.dumps(policy_definition, sort_keys=True, separators=(',', ':'))
    return hashlib.sha256(normalized_json.encode('utf-8')).hexdigest()


def serialize_rulepack(pack: RulePack) -> Dict[str, Any]:
    """
    Serialize a RulePack to a deterministic dictionary.
    
    Args:
        pack: RulePack instance
        
    Returns:
        Dict representation of the rulepack
    """
    return {
        "case_type": pack.case_type,
        "rules": [
            {
                "id": rule.id,
                "title": rule.title,
                "severity": rule.severity.value,
                "weight": rule.weight,
                "field_path": rule.field_path,
            }
            for rule in pack.rules
        ]
    }


def get_current_policy_definition() -> Dict[str, Any]:
    """
    Get current policy definition (all rulepacks).
    
    Returns:
        Dict with all case type rulepacks serialized
    """
    case_types = ["csf_practitioner", "csf_facility", "csf", "csa"]
    
    policy_definition = {
        "policy_id": CURRENT_POLICY_ID,
        "version": CURRENT_POLICY_VERSION,
        "case_types": {}
    }
    
    for case_type in case_types:
        pack = get_rule_pack(case_type)
        policy_definition["case_types"][case_type] = serialize_rulepack(pack)
    
    return policy_definition


def get_current_policy() -> PolicyMeta:
    """
    Get metadata for the current active policy version.
    
    Returns:
        PolicyMeta for current policy
        
    Example:
        >>> policy = get_current_policy()
        >>> print(policy.version)
        "1.0.0"
    """
    policy_def = get_current_policy_definition()
    policy_hash = compute_policy_hash(policy_def)
    
    # Count total rules across all case types
    total_rules = sum(
        len(ct_data["rules"])
        for ct_data in policy_def["case_types"].values()
    )
    
    return PolicyMeta(
        policy_id=CURRENT_POLICY_ID,
        version=CURRENT_POLICY_VERSION,
        created_at=datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z'),  # In production, this would be fixed
        policy_hash=policy_hash,
        summary=f"AutoComply Decision Rules v{CURRENT_POLICY_VERSION}",
        rules_count=total_rules
    )


def list_policy_versions(policy_id: Optional[str] = None) -> List[PolicyMeta]:
    """
    List all available policy versions.
    
    Note: In this initial implementation, we only have one version.
    Future: Could load from database or JSON files.
    
    Args:
        policy_id: Optional filter by policy_id
        
    Returns:
        List of PolicyMeta objects
    """
    current = get_current_policy()
    
    if policy_id and policy_id != current.policy_id:
        return []
    
    # For now, only current version exists
    # Future: query database or filesystem for historical versions
    return [current]


def diff_policy_versions(from_version: str, to_version: str) -> Dict[str, Any]:
    """
    Compute diff between two policy versions.
    
    Args:
        from_version: Source version (e.g., "1.0.0")
        to_version: Target version (e.g., "1.1.0")
        
    Returns:
        Dict with:
        - added_rules: List of rule IDs added in to_version
        - removed_rules: List of rule IDs removed from from_version
        - changed_rules: List of rule IDs with modified properties
        - summary: Human-readable summary
        
    Example:
        >>> diff = diff_policy_versions("1.0.0", "1.1.0")
        >>> print(diff["summary"])
        "Added 2 rules, removed 0 rules, changed 1 rule"
    """
    # For now, only current version exists, so return empty diff
    current = get_current_policy()
    
    if from_version == to_version:
        return {
            "from_version": from_version,
            "to_version": to_version,
            "added_rules": [],
            "removed_rules": [],
            "changed_rules": [],
            "summary": "No changes (same version)"
        }
    
    # If comparing to/from current version and versions don't exist
    if from_version != current.version and to_version != current.version:
        return {
            "from_version": from_version,
            "to_version": to_version,
            "added_rules": [],
            "removed_rules": [],
            "changed_rules": [],
            "summary": f"Version {from_version} or {to_version} not found",
            "error": "One or both versions not found"
        }
    
    # Placeholder: In production, this would:
    # 1. Load policy definitions for both versions from storage
    # 2. Compare rule lists by ID
    # 3. Detect added/removed/changed rules
    # 4. Return detailed diff
    
    return {
        "from_version": from_version,
        "to_version": to_version,
        "added_rules": [],
        "removed_rules": [],
        "changed_rules": [],
        "summary": "Policy diff not yet implemented for historical versions",
        "note": "Currently only current version (v1.0.0) is available"
    }


def get_policy_by_version(version: str) -> Optional[PolicyMeta]:
    """
    Get policy metadata for a specific version.
    
    Args:
        version: Version string (e.g., "1.0.0")
        
    Returns:
        PolicyMeta if version exists, None otherwise
    """
    current = get_current_policy()
    
    if version == current.version:
        return current
    
    # Future: query database/filesystem for historical versions
    return None
