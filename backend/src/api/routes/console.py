"""
Compliance Console API routes.

Provides endpoints for the Compliance Console dashboard to fetch
real-time verification work queue, statistics, and trace data.
"""

from datetime import datetime, timedelta, timezone
import json
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


def _table_exists(table_name: str) -> bool:
    rows = execute_sql(
        "SELECT name FROM sqlite_master WHERE type='table' AND name = :table_name",
        {"table_name": table_name},
    )
    return bool(rows)


def _safe_count(query: str, params: dict | None = None) -> int:
    rows = execute_sql(query, params or {})
    if not rows:
        return 0
    return int(rows[0].get("count", 0))


def _safe_group_count(query: str, params: dict | None = None, key: str = "name") -> list[dict]:
    rows = execute_sql(query, params or {})
    results: list[dict] = []
    for row in rows:
        name = row.get(key)
        if name is None:
            continue
        results.append({"name": name, "count": int(row.get("count", 0))})
    return results


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


@router.get("/analytics/summary")
async def get_console_analytics_summary(
    days: int = Query(30, ge=1, le=365)
) -> dict:
    cutoff_dt = datetime.now(timezone.utc) - timedelta(days=days)
    cutoff = cutoff_dt.isoformat().replace("+00:00", "Z")
    now = datetime.now(timezone.utc)
    now_iso = now.isoformat().replace("+00:00", "Z")
    soon_iso = (now + timedelta(hours=24)).isoformat().replace("+00:00", "Z")

    if not _table_exists("cases"):
        return {
            "total_cases": 0,
            "open_cases": 0,
            "closed_cases": 0,
            "overdue_cases": 0,
            "due_24h": 0,
            "status_breakdown": [],
            "decision_type_breakdown": [],
            "cases_created_daily": [],
            "cases_closed_daily": [],
            "top_event_types": [],
            "verifier_activity": [],
            "top_evidence_tags": [],
            "request_info_reasons": [],
        }

    open_statuses = ("new", "in_review", "needs_info")
    closed_statuses = ("approved", "blocked", "closed")

    total_cases = _safe_count("SELECT COUNT(*) as count FROM cases")
    open_cases = _safe_count(
        "SELECT COUNT(*) as count FROM cases WHERE status IN (:s1, :s2, :s3)",
        {"s1": open_statuses[0], "s2": open_statuses[1], "s3": open_statuses[2]},
    )
    closed_cases = _safe_count(
        "SELECT COUNT(*) as count FROM cases WHERE status IN (:s1, :s2, :s3)",
        {"s1": closed_statuses[0], "s2": closed_statuses[1], "s3": closed_statuses[2]},
    )
    overdue_cases = _safe_count(
        """
        SELECT COUNT(*) as count
        FROM cases
        WHERE due_at IS NOT NULL
          AND due_at < :now
          AND status IN (:s1, :s2, :s3)
        """,
        {"now": now_iso, "s1": open_statuses[0], "s2": open_statuses[1], "s3": open_statuses[2]},
    )
    due_24h = _safe_count(
        """
        SELECT COUNT(*) as count
        FROM cases
        WHERE due_at IS NOT NULL
          AND due_at >= :now
          AND due_at <= :soon
          AND status IN (:s1, :s2, :s3)
        """,
        {
            "now": now_iso,
            "soon": soon_iso,
            "s1": open_statuses[0],
            "s2": open_statuses[1],
            "s3": open_statuses[2],
        },
    )

    status_breakdown = _safe_group_count(
        "SELECT status as name, COUNT(*) as count FROM cases GROUP BY status",
        key="name",
    )
    decision_type_breakdown = _safe_group_count(
        "SELECT decision_type as name, COUNT(*) as count FROM cases GROUP BY decision_type",
        key="name",
    )

    cases_created_daily = execute_sql(
        """
        SELECT substr(created_at, 1, 10) as date, COUNT(*) as count
        FROM cases
        WHERE created_at >= :cutoff
        GROUP BY date
        ORDER BY date
        """,
        {"cutoff": cutoff},
    )

    cases_closed_daily = execute_sql(
        """
        SELECT substr(resolved_at, 1, 10) as date, COUNT(*) as count
        FROM cases
        WHERE resolved_at IS NOT NULL AND resolved_at >= :cutoff
        GROUP BY date
        ORDER BY date
        """,
        {"cutoff": cutoff},
    )

    cases_created_daily = [
        {"date": row.get("date"), "count": int(row.get("count", 0))}
        for row in cases_created_daily
        if row.get("date")
    ]
    cases_closed_daily = [
        {"date": row.get("date"), "count": int(row.get("count", 0))}
        for row in cases_closed_daily
        if row.get("date")
    ]

    top_event_types: list[dict] = []
    if _table_exists("audit_events"):
        top_event_types = _safe_group_count(
            """
            SELECT event_type as name, COUNT(*) as count
            FROM audit_events
            WHERE created_at >= :cutoff
            GROUP BY event_type
            ORDER BY count DESC
            LIMIT 10
            """,
            {"cutoff": cutoff},
            key="name",
        )

    verifier_activity_map: dict[str, int] = {}
    if _table_exists("policy_overrides"):
        rows = execute_sql(
            """
            SELECT reviewer as name, COUNT(*) as count
            FROM policy_overrides
            WHERE created_at >= :cutoff
            GROUP BY reviewer
            """,
            {"cutoff": cutoff},
        )
        for row in rows:
            name = row.get("name") or "unknown"
            verifier_activity_map[name] = verifier_activity_map.get(name, 0) + int(row.get("count", 0))

    if _table_exists("case_decisions"):
        rows = execute_sql(
            """
            SELECT COALESCE(decided_by_name, decided_by_role, 'unknown') as name,
                   COUNT(*) as count
            FROM case_decisions
            WHERE created_at >= :cutoff
              AND decision = 'APPROVED'
            GROUP BY name
            """,
            {"cutoff": cutoff},
        )
        for row in rows:
            name = row.get("name") or "unknown"
            verifier_activity_map[name] = verifier_activity_map.get(name, 0) + int(row.get("count", 0))

    verifier_activity = [
        {"name": name, "count": count}
        for name, count in sorted(verifier_activity_map.items(), key=lambda item: item[1], reverse=True)
    ]

    top_evidence_tags: list[dict] = []
    if _table_exists("evidence_items"):
        tag_counts: dict[str, int] = {}
        rows = execute_sql(
            "SELECT tags FROM evidence_items WHERE created_at >= :cutoff",
            {"cutoff": cutoff},
        )
        for row in rows:
            raw = row.get("tags")
            if not raw:
                continue
            try:
                tags = json.loads(raw) if isinstance(raw, str) else []
            except json.JSONDecodeError:
                tags = []
            if not isinstance(tags, list):
                continue
            for tag in tags:
                if not tag:
                    continue
                tag_counts[str(tag)] = tag_counts.get(str(tag), 0) + 1
        top_evidence_tags = [
            {"name": tag, "count": count}
            for tag, count in sorted(tag_counts.items(), key=lambda item: item[1], reverse=True)[:10]
        ]

    return {
        "total_cases": total_cases,
        "open_cases": open_cases,
        "closed_cases": closed_cases,
        "overdue_cases": overdue_cases,
        "due_24h": due_24h,
        "status_breakdown": status_breakdown,
        "decision_type_breakdown": decision_type_breakdown,
        "cases_created_daily": cases_created_daily,
        "cases_closed_daily": cases_closed_daily,
        "top_event_types": top_event_types,
        "verifier_activity": verifier_activity,
        "top_evidence_tags": top_evidence_tags,
        "request_info_reasons": [],
    }




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
