"""
Phase 7.25: Policy Versioning + Rulepack Traceability
API endpoints for policy metadata, versioning, and diff operations.

Provides:
- GET /policy/current: Current active policy metadata
- GET /policy/versions: List all available policy versions
- GET /policy/diff: Compare two policy versions

Author: AutoComply AI
Date: 2026-01-17
"""

from typing import List, Dict, Any, Optional
from fastapi import APIRouter, HTTPException, Query

from .models import PolicyMeta
from .registry import (
    get_current_policy,
    list_policy_versions,
    diff_policy_versions,
    get_policy_by_version,
)

router = APIRouter()


@router.get(
    "/policy/current",
    summary="Get Current Policy",
    description="Retrieve metadata for the currently active policy version",
    tags=["policy"]
)
async def get_current_policy_endpoint() -> PolicyMeta:
    """
    Get metadata for the current active policy version.
    
    Returns:
        PolicyMeta object with:
        - policy_id: Identifier (e.g., "autocomply-rules-v1")
        - version: Semantic version (e.g., "1.0.0")
        - created_at: Timestamp
        - policy_hash: SHA256 hash of policy definition
        - summary: Human-readable description
        - rules_count: Total number of rules across all case types
        
    Example Response:
        {
            "policy_id": "autocomply-rules-v1",
            "version": "1.0.0",
            "created_at": "2026-01-17T22:30:00Z",
            "policy_hash": "a1b2c3d4...",
            "summary": "AutoComply Decision Rules v1.0.0",
            "rules_count": 42
        }
    """
    try:
        policy = get_current_policy()
        return policy
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to retrieve current policy: {str(e)}"
        )


@router.get(
    "/policy/versions",
    summary="List Policy Versions",
    description="List all available policy versions, optionally filtered by policy_id",
    tags=["policy"]
)
async def list_policy_versions_endpoint(
    policy_id: Optional[str] = Query(None, description="Filter by policy ID")
) -> List[PolicyMeta]:
    """
    List all available policy versions.
    
    Args:
        policy_id: Optional filter by policy ID
        
    Returns:
        List of PolicyMeta objects, ordered by version (newest first)
        
    Example Response:
        [
            {
                "policy_id": "autocomply-rules-v1",
                "version": "1.0.0",
                "policy_hash": "abc123...",
                ...
            }
        ]
        
    Note:
        In v1, only the current policy version is available.
        Future versions may include historical policy versions.
    """
    try:
        versions = list_policy_versions(policy_id)
        return versions
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to list policy versions: {str(e)}"
        )


@router.get(
    "/policy/diff",
    summary="Diff Policy Versions",
    description="Compare two policy versions and return added/removed/changed rules",
    tags=["policy"]
)
async def diff_policy_endpoint(
    from_version: str = Query(..., description="Source version (e.g., '1.0.0')"),
    to_version: str = Query(..., description="Target version (e.g., '1.1.0')")
) -> Dict[str, Any]:
    """
    Compare two policy versions and return a diff.
    
    Args:
        from_version: Source policy version
        to_version: Target policy version
        
    Returns:
        Dictionary with:
        - from_version: Source version
        - to_version: Target version
        - added_rules: List of rules added in target version
        - removed_rules: List of rules removed from source version
        - changed_rules: List of rules that changed (title, severity, weight)
        - summary: Human-readable diff summary
        
    Example Response:
        {
            "from_version": "1.0.0",
            "to_version": "1.1.0",
            "added_rules": [
                {
                    "case_type": "csf",
                    "rule_id": "R042",
                    "title": "New validation rule"
                }
            ],
            "removed_rules": [],
            "changed_rules": [
                {
                    "case_type": "csf",
                    "rule_id": "R010",
                    "field": "severity",
                    "old_value": "medium",
                    "new_value": "high"
                }
            ],
            "summary": "1 rule added, 0 removed, 1 changed"
        }
        
    Raises:
        404: If either version not found
        400: If versions are identical (no diff)
    """
    try:
        # Validate versions exist
        from_policy = get_policy_by_version(from_version)
        to_policy = get_policy_by_version(to_version)
        
        if not from_policy:
            raise HTTPException(
                status_code=404,
                detail=f"Source version '{from_version}' not found"
            )
        
        if not to_policy:
            raise HTTPException(
                status_code=404,
                detail=f"Target version '{to_version}' not found"
            )
        
        if from_version == to_version:
            raise HTTPException(
                status_code=400,
                detail="Cannot diff identical versions"
            )
        
        # Compute diff
        diff = diff_policy_versions(from_version, to_version)
        return diff
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to compute policy diff: {str(e)}"
        )


@router.get(
    "/policy/{version}",
    summary="Get Policy by Version",
    description="Retrieve metadata for a specific policy version",
    tags=["policy"]
)
async def get_policy_by_version_endpoint(version: str) -> PolicyMeta:
    """
    Get metadata for a specific policy version.
    
    Args:
        version: Policy version (e.g., "1.0.0")
        
    Returns:
        PolicyMeta object
        
    Raises:
        404: If version not found
    """
    try:
        policy = get_policy_by_version(version)
        
        if not policy:
            raise HTTPException(
                status_code=404,
                detail=f"Policy version '{version}' not found"
            )
        
        return policy
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to retrieve policy version: {str(e)}"
        )
