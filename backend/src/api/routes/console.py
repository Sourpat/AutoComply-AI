"""
Compliance Console API routes.

Provides endpoints for the Compliance Console dashboard to fetch
real-time verification work queue, statistics, and trace data.
"""

from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from src.autocomply.domain.submissions_store import (
    Submission,
    SubmissionStatus,
    get_submission_store,
)
from src.core.db import execute_sql

router = APIRouter(prefix="/console", tags=["console"])


class WorkQueueResponse(BaseModel):
    """Work queue response with submissions and statistics."""

    items: List[Submission] = Field(
        ..., description="List of verification submissions"
    )
    statistics: dict = Field(
        ..., description="Submission statistics (counts by status/priority)"
    )
    total: int = Field(..., description="Total number of items")


class UpdateSubmissionRequest(BaseModel):
    """Request to update submission status and/or notes."""

    status: Optional[SubmissionStatus] = Field(
        None, description="New submission status"
    )
    reviewer_notes: Optional[str] = Field(
        None, description="Reviewer notes to add/update"
    )
    reviewed_by: Optional[str] = Field(
        "admin", description="Username/email of reviewer (defaults to 'admin')"
    )


class OverrideMetricsResponse(BaseModel):
    window: str
    total: int
    by_action: Dict[str, int]
    by_reviewer: Dict[str, int]
    recent: List[Dict[str, str]]


def _parse_window(window: str) -> timedelta:
    value = window.strip().lower()
    if value.endswith("h"):
        return timedelta(hours=int(value[:-1]))
    if value.endswith("d"):
        return timedelta(days=int(value[:-1]))
    raise ValueError("window must be like '24h' or '7d'")


@router.get("/work-queue", response_model=WorkQueueResponse)
async def get_work_queue(
    tenant: Optional[str] = Query(
        None, description="Filter by tenant identifier"
    ),
    status: Optional[str] = Query(
        None,
        description="Filter by status (comma-separated: submitted,in_review)",
    ),
    limit: int = Query(100, description="Maximum number of results"),
) -> WorkQueueResponse:
    """
    Get verification work queue for Compliance Console.

    Returns submissions awaiting verification, sorted by created_at descending.
    Includes statistics for dashboard widgets (counts by status, priority).

    Example:
        GET /console/work-queue?tenant=ohio-hospital-main&status=submitted,in_review
    """
    store = get_submission_store()

    # Parse status filter
    status_filter = None
    if status:
        status_values = [s.strip() for s in status.split(",")]
        try:
            status_filter = [SubmissionStatus(s) for s in status_values]
        except ValueError as e:
            # Invalid status value, ignore filter
            pass

    # Fetch submissions
    items = store.list_submissions(
        tenant=tenant, status=status_filter, limit=limit
    )

    # Get statistics
    statistics = store.get_statistics(tenant=tenant)

    return WorkQueueResponse(
        items=items, statistics=statistics, total=len(items)
    )




@router.get("/submissions/{submission_id}", response_model=Submission)
async def get_submission(submission_id: str) -> Submission:
    """
    Get a specific submission by ID.

    Returns full submission details including payload and trace_id.
    """
    return await _get_submission_impl(submission_id)


@router.get("/work-queue/{submission_id}", response_model=Submission)
async def get_work_queue_submission(submission_id: str) -> Submission:
    """
    Get a specific work queue submission by ID (alias endpoint for compatibility).

    Returns full submission details including payload, trace_id, and reviewer fields.
    """
    return await _get_submission_impl(submission_id)


async def _get_submission_impl(submission_id: str) -> Submission:
    """
    Shared implementation for getting a submission by ID.

    Returns full submission details including:
    - Basic info (title, type, tenant, created_at, etc.)
    - Engine decision (decision_status, risk_level, summary)
    - Reviewer workflow (status, reviewer_notes, reviewed_by, reviewed_at)
    - Trace data (trace_id, payload)
    """
    store = get_submission_store()
    submission = store.get_submission(submission_id)

    if not submission:
        raise HTTPException(
            status_code=404, detail=f"Submission {submission_id} not found"
        )

    return submission


@router.patch("/work-queue/{submission_id}", response_model=Submission)
async def update_submission(
    submission_id: str, request: UpdateSubmissionRequest
) -> Submission:
    """Update submission status and/or reviewer notes."""
    return await _update_submission_impl(submission_id, request)


@router.patch("/work-queue/{submission_id}/status", response_model=Submission)
async def update_submission_status(
    submission_id: str, request: UpdateSubmissionRequest
) -> Submission:
    """Update submission status (alias endpoint for compatibility)."""
    return await _update_submission_impl(submission_id, request)


async def _update_submission_impl(
    submission_id: str, request: UpdateSubmissionRequest
) -> Submission:
    """
    Update submission status and/or reviewer notes.

    Allows compliance reviewers to:
    - Change status (submitted → in_review → approved/rejected)
    - Add/update reviewer notes for audit trail

    Example:
        PATCH /console/work-queue/{id}
        { "status": "in_review", "reviewer_notes": "Checking DEA number..." }
    """
    store = get_submission_store()

    # Validate at least one field is being updated
    if request.status is None and request.reviewer_notes is None:
        raise HTTPException(
            status_code=400,
            detail="Must provide at least one of: status, reviewer_notes",
        )

    # Update submission
    submission = store.update_submission(
        submission_id=submission_id,
        status=request.status,
        reviewer_notes=request.reviewer_notes,
        reviewed_by=request.reviewed_by,
    )

    if not submission:
        raise HTTPException(
            status_code=404, detail=f"Submission {submission_id} not found"
        )

    return submission


@router.get("/override-metrics", response_model=OverrideMetricsResponse)
async def get_override_metrics(window: str = Query("24h")) -> OverrideMetricsResponse:
    try:
        delta = _parse_window(window)
    except (ValueError, TypeError):
        raise HTTPException(status_code=400, detail="Invalid window; use '24h' or '7d'")

    cutoff = (datetime.now(timezone.utc) - delta).isoformat().replace("+00:00", "Z")

    total_rows = execute_sql(
        "SELECT COUNT(*) as total FROM policy_overrides WHERE created_at >= :cutoff",
        {"cutoff": cutoff},
    )
    total = int(total_rows[0]["total"]) if total_rows else 0

    action_rows = execute_sql(
        """
        SELECT override_action, COUNT(*) as count
        FROM policy_overrides
        WHERE created_at >= :cutoff
        GROUP BY override_action
        """,
        {"cutoff": cutoff},
    )
    by_action = {row["override_action"]: int(row["count"]) for row in action_rows}

    reviewer_rows = execute_sql(
        """
        SELECT reviewer, COUNT(*) as count
        FROM policy_overrides
        WHERE created_at >= :cutoff
        GROUP BY reviewer
        ORDER BY count DESC
        """,
        {"cutoff": cutoff},
    )
    by_reviewer = {row["reviewer"]: int(row["count"]) for row in reviewer_rows}

    recent_rows = execute_sql(
        """
        SELECT id, trace_id, submission_id, override_action, rationale, reviewer, created_at
        FROM policy_overrides
        WHERE created_at >= :cutoff
        ORDER BY created_at DESC
        LIMIT 20
        """,
        {"cutoff": cutoff},
    )

    return OverrideMetricsResponse(
        window=window,
        total=total,
        by_action=by_action,
        by_reviewer=by_reviewer,
        recent=[dict(row) for row in recent_rows],
    )
