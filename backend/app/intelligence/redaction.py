"""
Phase 7.28: Redaction & Retention for Audit Exports
Safe-by-default redaction with role-based permissions.

Author: AutoComply AI
Date: 2026-01-20
"""

import os
import re
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional


# Environment variables for retention policy
EVIDENCE_RETENTION_DAYS = int(os.getenv("EVIDENCE_RETENTION_DAYS", "30"))
PAYLOAD_RETENTION_DAYS = int(os.getenv("PAYLOAD_RETENTION_DAYS", "90"))


# Fields to keep in safe mode (allowlist-first approach)
SAFE_MODE_ALLOWLIST = {
    "id",
    "run_id",
    "case_id",
    "computed_at",
    "updated_at",
    "created_at",
    "timestamp",
    "status",
    "confidence_score",
    "confidence_band",
    "decision",
    "completeness_score",
    "policy_version",
    "policy_hash",
    "input_hash",
    "evidence_hash",
    "previous_run_id",
    "integrity_check",
    "signature",
    "signature_metadata",
    "canonicalization",
    "gap_count",
    "bias_count",
    "trigger",
    "actor_role",
    "redaction_mode",
    "redacted_fields_count",
    "retention_policy",
    "export_metadata",
}


def mask_identifier(value: str, keep_last: int = 4) -> str:
    """
    Mask identifier keeping only last N characters.
    
    Example:
        >>> mask_identifier("DEA-AB1234567")
        "***-****4567"
    """
    if not value or len(value) <= keep_last:
        return "*" * len(value) if value else ""
    
    masked_part = "*" * (len(value) - keep_last)
    visible_part = value[-keep_last:]
    return masked_part + visible_part


def redact_pii(text: str) -> str:
    """
    Redact PII patterns from text.
    
    Patterns:
    - Emails: replaced with [EMAIL_REDACTED]
    - Phone: replaced with [PHONE_REDACTED]
    - SSN-like: replaced with [ID_REDACTED]
    """
    if not text:
        return text
    
    # Email pattern
    text = re.sub(
        r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b',
        '[EMAIL_REDACTED]',
        text
    )
    
    # Phone pattern (various formats)
    text = re.sub(
        r'\b\d{3}[-.]?\d{3}[-.]?\d{4}\b',
        '[PHONE_REDACTED]',
        text
    )
    
    # SSN-like pattern (XXX-XX-XXXX)
    text = re.sub(
        r'\b\d{3}-\d{2}-\d{4}\b',
        '[ID_REDACTED]',
        text
    )
    
    return text


def redact_dict(data: Dict[str, Any], safe_mode: bool) -> Dict[str, Any]:
    """
    Recursively redact dictionary fields based on safe mode.
    
    Args:
        data: Dictionary to redact
        safe_mode: If True, only keep allowlisted fields
        
    Returns:
        Redacted dictionary
    """
    if not isinstance(data, dict):
        return data
    
    redacted = {}
    
    for key, value in data.items():
        # In safe mode, only keep allowlisted fields
        if safe_mode and key not in SAFE_MODE_ALLOWLIST:
            # Set sensitive fields to None instead of removing them
            if key in ["evidence_snapshot", "payload", "intelligence_payload", "form_data", "raw_payload"]:
                redacted[key] = None
                continue
            
            # Redact string values that might contain PII
            if isinstance(value, str):
                redacted[key] = redact_pii(value)
            elif isinstance(value, dict):
                redacted[key] = redact_dict(value, safe_mode)
            elif isinstance(value, list):
                redacted[key] = [redact_dict(item, safe_mode) if isinstance(item, dict) else item for item in value]
            else:
                redacted[key] = value
        else:
            # Keep allowlisted fields
            if isinstance(value, dict):
                redacted[key] = redact_dict(value, safe_mode)
            elif isinstance(value, list):
                redacted[key] = [redact_dict(item, safe_mode) if isinstance(item, dict) else item for item in value]
            else:
                redacted[key] = value
    
    return redacted


def apply_retention_policy(
    history_entries: List[Dict[str, Any]],
    evidence_retention_days: int = EVIDENCE_RETENTION_DAYS,
    payload_retention_days: int = PAYLOAD_RETENTION_DAYS
) -> List[Dict[str, Any]]:
    """
    Apply retention policy to history entries.
    
    If entry is older than retention period:
    - evidence_snapshot becomes null
    - intelligence_payload becomes null
    - evidence_hash and input_hash remain
    
    Args:
        history_entries: List of history entry dicts
        evidence_retention_days: Days to retain evidence_snapshot
        payload_retention_days: Days to retain intelligence_payload
        
    Returns:
        List of entries with retention applied
    """
    now = datetime.utcnow()
    evidence_cutoff = now - timedelta(days=evidence_retention_days)
    payload_cutoff = now - timedelta(days=payload_retention_days)
    
    result = []
    for entry in history_entries:
        entry_copy = entry.copy()
        
        # Parse computed_at timestamp
        computed_at_str = entry_copy.get("computed_at", "")
        try:
            # Handle both ISO format with and without 'Z'
            computed_at_str_clean = computed_at_str.rstrip('Z')
            computed_at = datetime.fromisoformat(computed_at_str_clean)
        except (ValueError, AttributeError):
            # If can't parse, keep data (assume recent)
            result.append(entry_copy)
            continue
        
        # Apply evidence retention
        if computed_at < evidence_cutoff:
            if "evidence_snapshot" in entry_copy:
                entry_copy["evidence_snapshot"] = None
                entry_copy["_retention_applied"] = True
                entry_copy["_evidence_expired"] = True
        
        # Apply payload retention
        if computed_at < payload_cutoff:
            if "intelligence_payload" in entry_copy:
                entry_copy["intelligence_payload"] = None
                entry_copy["_retention_applied"] = True
                entry_copy["_payload_expired"] = True
        
        result.append(entry_copy)
    
    return result


def redact_export(
    export_data: Dict[str, Any],
    role: str,
    safe_mode: Optional[bool] = None,
    include_payload: bool = False,
    include_evidence: bool = False
) -> Dict[str, Any]:
    """
    Redact audit export based on role and permissions.
    
    Permission matrix:
    - verifier: forced safe mode, no payload/evidence
    - admin/devsupport: can choose safe/full, can include payload/evidence
    
    Args:
        export_data: Raw export data
        role: User role (admin, verifier, devsupport)
        safe_mode: If None, auto-determined by role. If True, apply safe redaction
        include_payload: Whether to include intelligence payloads (admin only)
        include_evidence: Whether to include evidence snapshots (admin only)
        
    Returns:
        Redacted export with metadata
    """
    # Determine redaction mode
    if role == "verifier":
        # Verifiers are forced into safe mode
        safe_mode = True
        include_payload = False
        include_evidence = False
    else:
        # Admin/devsupport can choose
        if safe_mode is None:
            safe_mode = False  # Default to full export for admin
    
    # Apply retention policy first
    if "history" in export_data:
        export_data["history"] = apply_retention_policy(export_data["history"])
    
    # Count redacted fields
    redacted_count = 0
    
    # Apply redaction
    if safe_mode:
        export_data = redact_dict(export_data, safe_mode=True)
        redacted_count = count_redacted_fields(export_data)
    
    # Remove payload/evidence if not permitted
    if "history" in export_data:
        for entry in export_data["history"]:
            if not include_payload and "intelligence_payload" in entry:
                entry["intelligence_payload"] = None
                redacted_count += 1
            
            if not include_evidence and "evidence_snapshot" in entry:
                entry["evidence_snapshot"] = None
                redacted_count += 1
    
    # Add export metadata
    export_data["export_metadata"] = {
        "redaction_mode": "safe" if safe_mode else "full",
        "redacted_fields_count": redacted_count,
        "retention_policy": {
            "evidence_retention_days": EVIDENCE_RETENTION_DAYS,
            "payload_retention_days": PAYLOAD_RETENTION_DAYS,
        },
        "permissions": {
            "role": role,
            "include_payload": include_payload,
            "include_evidence": include_evidence,
        }
    }
    
    return export_data


def count_redacted_fields(data: Any, count: int = 0) -> int:
    """Count fields that were redacted (contain REDACTED markers)."""
    if isinstance(data, dict):
        for value in data.values():
            count = count_redacted_fields(value, count)
    elif isinstance(data, list):
        for item in data:
            count = count_redacted_fields(item, count)
    elif isinstance(data, str):
        if "REDACTED" in data or data is None:
            count += 1
    
    return count
