"""
Phase 7.29: SLA + Escalation Signals

Provides SLA status computation for case aging and escalation tracking.
"""

import os
from datetime import datetime, timezone
from typing import Literal

# ENV configuration with defaults
SLA_IN_REVIEW_WARNING_HOURS = int(os.getenv("SLA_IN_REVIEW_WARNING_HOURS", "24"))
SLA_IN_REVIEW_BREACH_HOURS = int(os.getenv("SLA_IN_REVIEW_BREACH_HOURS", "72"))

SLAStatus = Literal["ok", "warning", "breach"]


def compute_age_hours(created_at: datetime, status_updated_at: datetime | None = None) -> float:
    """
    Compute age in hours since case creation or last status update.
    
    Args:
        created_at: Case creation timestamp
        status_updated_at: Optional status update timestamp (falls back to created_at)
    
    Returns:
        Age in hours (float)
    
    Example:
        >>> created = datetime(2026, 1, 19, 12, 0, 0)
        >>> now = datetime(2026, 1, 20, 18, 0, 0)
        >>> age = compute_age_hours(created)  # 30 hours
    """
    reference_time = status_updated_at if status_updated_at else created_at
    now = datetime.now(timezone.utc)
    delta = now - reference_time
    return delta.total_seconds() / 3600


def compute_sla_status(status: str, age_hours: float) -> SLAStatus:
    """
    Compute SLA status based on case status and age.
    
    SLA thresholds (configurable via ENV):
    - WARNING: age >= SLA_IN_REVIEW_WARNING_HOURS (default 24h)
    - BREACH: age >= SLA_IN_REVIEW_BREACH_HOURS (default 72h)
    
    SLA only applies to:
    - status = "in_review" (always)
    - status = "new" (optionally tracked)
    
    Args:
        status: Case status (new, in_review, etc.)
        age_hours: Age in hours
    
    Returns:
        SLAStatus: "ok", "warning", or "breach"
    
    Example:
        >>> # In review for 2 days (48h) with default thresholds
        >>> compute_sla_status("in_review", 48.0)
        'warning'
        
        >>> # In review for 4 days (96h)
        >>> compute_sla_status("in_review", 96.0)
        'breach'
        
        >>> # Approved cases have no SLA
        >>> compute_sla_status("approved", 200.0)
        'ok'
    """
    # SLA only applies to active review statuses
    if status not in ["new", "in_review"]:
        return "ok"
    
    # Check breach threshold first (most critical)
    if age_hours >= SLA_IN_REVIEW_BREACH_HOURS:
        return "breach"
    
    # Check warning threshold
    if age_hours >= SLA_IN_REVIEW_WARNING_HOURS:
        return "warning"
    
    # Within acceptable range
    return "ok"


def add_sla_fields(case_dict: dict) -> dict:
    """
    Add age_hours and sla_status fields to a case dictionary.
    
    Args:
        case_dict: Case data with createdAt, updatedAt, status fields
    
    Returns:
        Case dict with added age_hours and sla_status fields
    
    Example:
        >>> case = {
        ...     "id": "case-123",
        ...     "status": "in_review",
        ...     "createdAt": "2026-01-18T12:00:00Z",
        ...     "updatedAt": "2026-01-19T10:00:00Z"
        ... }
        >>> enriched = add_sla_fields(case)
        >>> enriched["age_hours"]  # ~32 hours (from updatedAt)
        >>> enriched["sla_status"]  # 'warning' (>24h)
    """
    # Parse timestamps (handle both datetime objects and ISO strings)
    created_at = case_dict.get("createdAt")
    if isinstance(created_at, str):
        created_at = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
    
    updated_at = case_dict.get("updatedAt")
    if isinstance(updated_at, str):
        updated_at = datetime.fromisoformat(updated_at.replace("Z", "+00:00"))
    
    # Compute age
    age_hours = compute_age_hours(created_at, updated_at)
    
    # Compute SLA status
    status = case_dict.get("status", "new")
    sla_status = compute_sla_status(status, age_hours)
    
    # Add computed fields
    return {
        **case_dict,
        "age_hours": round(age_hours, 2),
        "sla_status": sla_status,
    }
