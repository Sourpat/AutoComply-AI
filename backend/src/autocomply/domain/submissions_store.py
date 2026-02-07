"""
Unified verification submissions store for all CSF types.

This module provides a centralized in-memory store for tracking CSF/License
submissions awaiting verification. It's structured to easily migrate to a
database backend (PostgreSQL, MongoDB, etc.) in the future.

Current implementation: In-memory dictionary
Future: Replace with SQLAlchemy models or document store
"""

from __future__ import annotations

import uuid
from enum import Enum
from typing import Dict, List, Optional

from pydantic import BaseModel, Field

from src.autocomply.domain import sla_policy


def _now_iso() -> str:
    return sla_policy.now_iso()


class SubmissionStatus(str, Enum):
    """Status of a verification submission."""

    SUBMITTED = "submitted"
    IN_REVIEW = "in_review"
    NEEDS_INFO = "needs_info"
    APPROVED = "approved"
    REJECTED = "rejected"
    BLOCKED = "blocked"


class SubmissionPriority(str, Enum):
    """Priority level for verification queue."""

    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class CsfType(str, Enum):
    """CSF submission type."""

    PRACTITIONER = "practitioner"
    HOSPITAL = "hospital"
    FACILITY = "facility"
    EMS = "ems"
    RESEARCHER = "researcher"


class Submission(BaseModel):
    """
    Verification submission record.

    Represents a CSF or License submission awaiting manual verification.
    Used by the Compliance Console work queue.
    """

    submission_id: str = Field(
        ..., description="Unique submission identifier (UUID)"
    )
    csf_type: str = Field(..., description="Type of CSF submission")
    tenant: str = Field(..., description="Tenant/facility identifier")
    status: SubmissionStatus = Field(
        default=SubmissionStatus.SUBMITTED, description="Current submission status"
    )
    last_status_at: Optional[str] = Field(
        None, description="ISO 8601 timestamp of last status change"
    )
    last_status_by: Optional[str] = Field(
        None, description="Actor who last changed status"
    )
    request_info: Optional[Dict] = Field(
        None, description="Request info payload when verifier needs more info"
    )
    priority: SubmissionPriority = Field(
        default=SubmissionPriority.MEDIUM, description="Verification priority"
    )
    created_at: str = Field(
        ..., description="ISO 8601 timestamp of submission creation"
    )
    updated_at: str = Field(
        ..., description="ISO 8601 timestamp of last update"
    )
    title: str = Field(..., description="Human-readable submission title")
    subtitle: str = Field(..., description="Brief reason/description")
    summary: Optional[str] = Field(
        None, description="Detailed summary or notes"
    )
    trace_id: str = Field(..., description="Linked trace ID for replay")
    payload: Dict = Field(
        default_factory=dict, description="Original submission payload"
    )
    decision_status: Optional[str] = Field(
        None, description="Decision engine status (ok_to_ship, blocked, etc.)"
    )
    risk_level: Optional[str] = Field(
        None, description="Risk assessment (Low, Medium, High)"
    )
    reviewer_notes: Optional[str] = Field(
        None, description="Notes added by compliance reviewer"
    )
    reviewed_by: Optional[str] = Field(
        None, description="Username/email of reviewer who took action"
    )
    reviewed_at: Optional[str] = Field(
        None, description="ISO 8601 timestamp when reviewed (approved/rejected)"
    )
    sla_first_touch_due_at: Optional[str] = Field(
        None, description="ISO 8601 timestamp when first touch is due"
    )
    sla_needs_info_due_at: Optional[str] = Field(
        None, description="ISO 8601 timestamp when needs-info response is due"
    )
    sla_decision_due_at: Optional[str] = Field(
        None, description="ISO 8601 timestamp when final decision is due"
    )
    sla_escalation_level: int = Field(
        0, description="Current SLA escalation level"
    )
    sla_last_notified_at: Optional[str] = Field(
        None, description="ISO 8601 timestamp when SLA reminder last emitted"
    )

    class Config:
        use_enum_values = True


class SubmissionStore:
    """
    In-memory store for verification submissions.

    Thread-safe for single-process deployments. For multi-process/distributed
    systems, replace with Redis, PostgreSQL, or other shared backend.
    """

    def __init__(self):
        self._store: Dict[str, Submission] = {}
        self._client_index: Dict[str, str] = {}

    def create_submission(
        self,
        csf_type: str,
        tenant: str,
        title: str,
        subtitle: str,
        trace_id: str,
        payload: Dict,
        decision_status: Optional[str] = None,
        risk_level: Optional[str] = None,
        priority: SubmissionPriority = SubmissionPriority.MEDIUM,
        summary: Optional[str] = None,
        submission_id: Optional[str] = None,
        client_token: Optional[str] = None,
    ) -> Submission:
        """
        Create a new verification submission.

        Args:
            csf_type: Type of CSF (practitioner, hospital, facility, ems, researcher)
            tenant: Tenant identifier (e.g., "ohio-hospital-main")
            title: Human-readable title (e.g., "Ohio Hospital – Main Campus")
            subtitle: Brief description (e.g., "Missing TDDD renewal documentation")
            trace_id: Linked trace ID for replay
            payload: Original submission payload (form data, decision, etc.)
            decision_status: Decision engine result (ok_to_ship, blocked, needs_review)
            risk_level: Risk assessment (Low, Medium, High)
            priority: Verification priority
            summary: Optional detailed summary

        Returns:
            Created Submission object
        """
        now = sla_policy.utc_now()
        now_iso = now.isoformat().replace('+00:00', 'Z')
        if submission_id is None:
            submission_id = str(uuid.uuid4())

        submission = Submission(
            submission_id=submission_id,
            csf_type=csf_type,
            tenant=tenant,
            status=SubmissionStatus.SUBMITTED,
            last_status_at=now_iso,
            last_status_by="submitter",
            priority=priority,
            created_at=now_iso,
            updated_at=now_iso,
            title=title,
            subtitle=subtitle,
            summary=summary,
            trace_id=trace_id,
            payload=payload,
            decision_status=decision_status,
            risk_level=risk_level,
            sla_first_touch_due_at=sla_policy.add_hours_iso(now, sla_policy.FIRST_TOUCH_HOURS),
            sla_decision_due_at=sla_policy.add_hours_iso(now, sla_policy.DECISION_HOURS),
            sla_escalation_level=0,
            sla_last_notified_at=None,
        )

        self._store[submission_id] = submission
        if client_token:
            self._client_index[client_token] = submission_id
        return submission

    def get_submission(self, submission_id: str) -> Optional[Submission]:
        """Retrieve a submission by ID."""
        return self._store.get(submission_id)

    def get_submission_by_client_token(self, client_token: str) -> Optional[Submission]:
        submission_id = self._client_index.get(client_token)
        if not submission_id:
            return None
        return self._store.get(submission_id)

    def list_submissions(
        self,
        tenant: Optional[str] = None,
        status: Optional[List[SubmissionStatus]] = None,
        limit: int = 100,
    ) -> List[Submission]:
        """
        List submissions with optional filters.

        Args:
            tenant: Filter by tenant identifier
            status: Filter by status (can be multiple)
            limit: Maximum number of results

        Returns:
            List of submissions sorted by created_at descending (newest first)
        """
        submissions = list(self._store.values())

        # Apply filters
        if tenant:
            submissions = [s for s in submissions if s.tenant == tenant]

        if status:
            status_values = [s.value if isinstance(s, Enum) else s for s in status]
            submissions = [s for s in submissions if s.status in status_values]

        # Sort by created_at descending (newest first)
        submissions.sort(key=lambda s: s.created_at, reverse=True)

        return submissions[:limit]

    def set_submission_status(
        self,
        submission_id: str,
        status: SubmissionStatus,
        by: str,
        request_info: Optional[Dict] = None,
    ) -> Optional[Submission]:
        submission = self._store.get(submission_id)
        if not submission:
            return None

        submission.status = status
        submission.last_status_at = _now_iso()
        submission.last_status_by = by
        if request_info is not None:
            submission.request_info = request_info
        if status != SubmissionStatus.NEEDS_INFO and request_info is None:
            submission.request_info = None
        if status == SubmissionStatus.NEEDS_INFO:
            submission.sla_needs_info_due_at = sla_policy.add_hours_iso(
                sla_policy.utc_now(), sla_policy.NEEDS_INFO_HOURS
            )
        elif status != SubmissionStatus.NEEDS_INFO:
            submission.sla_needs_info_due_at = None
        if status == SubmissionStatus.IN_REVIEW:
            submission.sla_first_touch_due_at = None
        if status in [SubmissionStatus.APPROVED, SubmissionStatus.REJECTED]:
            if not submission.reviewed_at:
                submission.reviewed_at = submission.last_status_at
            if by:
                submission.reviewed_by = by
            submission.sla_first_touch_due_at = None
            submission.sla_needs_info_due_at = None
            submission.sla_decision_due_at = None
            submission.sla_escalation_level = 0
            submission.sla_last_notified_at = None
        submission.updated_at = submission.last_status_at
        return submission

    def update_submission_status(
        self, submission_id: str, status: SubmissionStatus
    ) -> Optional[Submission]:
        """Update submission status and updated_at timestamp."""
        return self.set_submission_status(submission_id, status, by="system")

    def update_submission(
        self,
        submission_id: str,
        status: Optional[SubmissionStatus] = None,
        reviewer_notes: Optional[str] = None,
        reviewed_by: Optional[str] = None,
    ) -> Optional[Submission]:
        """Update submission with status, notes, and reviewer info."""
        submission = self._store.get(submission_id)
        if not submission:
            return None

        if status is not None:
            self.set_submission_status(submission_id, status, by=reviewed_by or "system")
        
        if reviewer_notes is not None:
            submission.reviewer_notes = reviewer_notes
        
        if reviewed_by is not None:
            submission.reviewed_by = reviewed_by
        
        submission.updated_at = _now_iso()
        return submission

    def delete_submission(self, submission_id: str) -> bool:
        """Delete a submission. Returns True if deleted, False if not found."""
        if submission_id in self._store:
            del self._store[submission_id]
            return True
        return False

    def get_statistics(
        self, tenant: Optional[str] = None
    ) -> Dict[str, int]:
        """
        Get submission statistics.

        Returns counts by status and priority for dashboard widgets.
        """
        submissions = self.list_submissions(tenant=tenant, limit=10000)

        stats = {
            "total": len(submissions),
            "by_status": {},
            "by_priority": {},
        }

        for submission in submissions:
            # Count by status
            status_key = submission.status
            stats["by_status"][status_key] = (
                stats["by_status"].get(status_key, 0) + 1
            )

            # Count by priority
            priority_key = submission.priority
            stats["by_priority"][priority_key] = (
                stats["by_priority"].get(priority_key, 0) + 1
            )

        return stats


# Global singleton instance (in-memory for now)
# In production, replace with database-backed store
_global_store: Optional[SubmissionStore] = None


def get_submission_store() -> SubmissionStore:
    """Get the global submission store instance."""
    global _global_store
    if _global_store is None:
        _global_store = SubmissionStore()
    return _global_store


def set_submission_status(
    submission_id: str,
    status: SubmissionStatus,
    by: str,
    request_info: Optional[Dict] = None,
) -> Optional[Submission]:
    store = get_submission_store()
    return store.set_submission_status(submission_id, status, by, request_info=request_info)


def reset_submission_store() -> None:
    """Reset the global store (for testing)."""
    global _global_store
    _global_store = SubmissionStore()
