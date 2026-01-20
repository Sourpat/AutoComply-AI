"""
Policy Models (Phase 7.25).

Defines policy metadata for traceability and versioning.
"""

from dataclasses import dataclass
from typing import Optional


@dataclass
class PolicyMeta:
    """
    Metadata about a policy version.
    
    Attributes:
        policy_id: Identifier for the policy set (e.g., "autocomply-rules-v1")
        version: Semantic version string (e.g., "1.0.0")
        created_at: ISO timestamp when this version was created
        policy_hash: SHA256 hash of normalized policy definition
        summary: Human-readable description of this version
        rules_count: Total number of rules in this policy
    """
    policy_id: str
    version: str
    created_at: str
    policy_hash: str
    summary: str
    rules_count: int
    
    def to_dict(self):
        """Convert to dictionary for JSON serialization."""
        return {
            "policy_id": self.policy_id,
            "version": self.version,
            "created_at": self.created_at,
            "policy_hash": self.policy_hash,
            "summary": self.summary,
            "rules_count": self.rules_count
        }
