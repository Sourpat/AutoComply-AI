"""
Compliance Console API routes.

Provides endpoints for the Compliance Console dashboard to fetch
real-time verification work queue, statistics, and trace data.
"""

from typing import List, Optional

from fastapi import APIRouter, Query
from pydantic import BaseModel, Field

from src.autocomply.domain.submissions_store import (
    Submission,
    SubmissionStatus,
    get_submission_store,
)

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
    store = get_submission_store()
    submission = store.get_submission(submission_id)

    if not submission:
        from fastapi import HTTPException

        raise HTTPException(
            status_code=404, detail=f"Submission {submission_id} not found"
        )

    return submission
