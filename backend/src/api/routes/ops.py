# backend/src/api/routes/ops.py
"""
Ops Dashboard endpoints for Verification team.
Read-only endpoints that provide operational metrics and review queue analytics.

SECURITY: All endpoints require admin role via X-User-Role header.
"""

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func, case
from datetime import datetime, timedelta, timezone

from src.database.connection import get_db
from src.database.models import ReviewQueueItem, ReviewStatus, QuestionEvent, QuestionStatus
from src.autocomply.domain.submissions_store import get_submission_store, SubmissionStatus
from src.api.dependencies.auth import require_admin_role

router = APIRouter(
    prefix="/api/v1/admin/ops",
    tags=["admin", "ops"],
    dependencies=[Depends(require_admin_role)],  # All endpoints require admin role
)


# ============================================================================
# Response Models
# ============================================================================

class OpsKPIResponse(BaseModel):
    """KPI metrics for ops dashboard."""
    open_reviews: int
    high_risk_open_reviews: int
    avg_time_to_first_response_hours: Optional[float]
    auto_answered_rate: Optional[float]


class OpsReviewItemResponse(BaseModel):
    """Review item with ops-relevant fields."""
    id: int
    created_at: str
    jurisdiction: Optional[str]
    reason_code: Optional[str]
    risk_level: str
    status: str
    question_excerpt: str
    top_match_score: Optional[float]


class OpsTrendDataPoint(BaseModel):
    """Single day trend data."""
    date: str
    open_created: int
    published: int


class OpsSubmissionResponse(BaseModel):
    """CSF/License submission for verification queue."""
    submission_id: str
    csf_type: str
    status: str
    created_at: str
    updated_at: str
    title: str
    subtitle: str
    decision_status: Optional[str]
    risk_level: Optional[str]
    trace_id: str


# ============================================================================
# Helper Functions
# ============================================================================

def infer_risk_level(reason_code: Optional[str], status: str) -> str:
    """Infer risk level from reason code and status."""
    if not reason_code:
        return "LOW"
    
    reason_lower = reason_code.lower()
    
    # HIGH risk
    if "jurisdiction" in reason_lower or "mismatch" in reason_lower:
        return "HIGH"
    if "unsafe" in reason_lower or "policy" in reason_lower:
        return "HIGH"
    if "internal_error" in reason_lower or "system_error" in reason_lower:
        return "HIGH"
    
    # MEDIUM risk
    if "unknown" in reason_lower or "no_match" in reason_lower:
        return "MEDIUM"
    if "low_similarity" in reason_lower:
        return "MEDIUM"
    
    return "LOW"


def extract_jurisdiction(question_event: Optional[QuestionEvent]) -> Optional[str]:
    """Extract jurisdiction/state from question event metadata."""
    if not question_event:
        return None
    
    # Try to get from conversation
    conversation = question_event.conversation
    if conversation and conversation.metadata:
        metadata = conversation.metadata
        if isinstance(metadata, dict):
            return metadata.get("jurisdiction") or metadata.get("state")
    
    # Try to get from triage metadata
    if question_event.triage_metadata and isinstance(question_event.triage_metadata, dict):
        return question_event.triage_metadata.get("jurisdiction") or question_event.triage_metadata.get("state")
    
    return None


# ============================================================================
# Endpoints
# ============================================================================

@router.get("/summary", response_model=OpsKPIResponse)
async def get_ops_summary(db: Session = Depends(get_db)) -> OpsKPIResponse:
    """
    Get KPI summary for ops dashboard.
    
    Returns:
    - Open reviews count
    - High risk open reviews count  
    - Avg time to first response (last 7 days)
    - Auto-answered rate (last 7 days)
    """
    now = datetime.now(timezone.utc)
    seven_days_ago = now - timedelta(days=7)
    
    # Open reviews
    open_count = db.query(ReviewQueueItem).filter(
        ReviewQueueItem.status == ReviewStatus.OPEN
    ).count()
    
    # High risk open reviews (infer from reason_code)
    open_items = db.query(ReviewQueueItem).filter(
        ReviewQueueItem.status == ReviewStatus.OPEN
    ).all()
    
    high_risk_count = 0
    for item in open_items:
        question_event = item.question_event
        if question_event and question_event.reason_code:
            reason_code = question_event.reason_code.value
            if infer_risk_level(reason_code, item.status.value) == "HIGH":
                high_risk_count += 1
    
    # Avg time to first response (created -> assigned_at or approved_at)
    recent_items = db.query(ReviewQueueItem).filter(
        ReviewQueueItem.created_at >= seven_days_ago,
        ReviewQueueItem.assigned_at.isnot(None)
    ).all()
    
    if recent_items:
        total_hours = 0
        for item in recent_items:
            time_diff = item.assigned_at - item.created_at
            total_hours += time_diff.total_seconds() / 3600
        avg_hours = total_hours / len(recent_items)
    else:
        avg_hours = None
    
    # Auto-answered rate (from QuestionEvent)
    total_questions = db.query(QuestionEvent).filter(
        QuestionEvent.created_at >= seven_days_ago
    ).count()
    
    needs_review_count = db.query(QuestionEvent).filter(
        QuestionEvent.created_at >= seven_days_ago,
        QuestionEvent.status == QuestionStatus.NEEDS_REVIEW
    ).count()
    
    if total_questions > 0:
        answered_count = total_questions - needs_review_count
        auto_answered_rate = answered_count / total_questions
    else:
        auto_answered_rate = None
    
    return OpsKPIResponse(
        open_reviews=open_count,
        high_risk_open_reviews=high_risk_count,
        avg_time_to_first_response_hours=avg_hours,
        auto_answered_rate=auto_answered_rate
    )


@router.get("/reviews", response_model=List[OpsReviewItemResponse])
async def get_ops_reviews(
    days: int = 14,
    limit: int = 100,
    db: Session = Depends(get_db)
) -> List[OpsReviewItemResponse]:
    """
    Get review items for ops dashboard with enriched metadata.
    
    Query params:
    - days: Look back period (default 14)
    - limit: Max items to return (default 100)
    """
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    
    items = db.query(ReviewQueueItem).filter(
        ReviewQueueItem.created_at >= cutoff
    ).order_by(
        ReviewQueueItem.created_at.desc()
    ).limit(limit).all()
    
    result = []
    for item in items:
        # Use the relationship to get question event
        question_event = item.question_event
        
        question_text = question_event.question_text if question_event else "N/A"
        question_excerpt = question_text[:120] + "..." if len(question_text) > 120 else question_text
        
        jurisdiction = extract_jurisdiction(question_event)
        
        # Get reason_code from question_event if available
        reason_code = question_event.reason_code.value if question_event and question_event.reason_code else None
        
        risk_level = infer_risk_level(reason_code, item.status.value)
        
        result.append(OpsReviewItemResponse(
            id=item.id,
            created_at=item.created_at.isoformat(),
            jurisdiction=jurisdiction,
            reason_code=reason_code,
            risk_level=risk_level,
            status=item.status.value,
            question_excerpt=question_excerpt,
            top_match_score=question_event.top_match_score if question_event else None
        ))
    
    return result


@router.get("/trends", response_model=List[OpsTrendDataPoint])
async def get_ops_trends(
    days: int = 14,
    db: Session = Depends(get_db)
) -> List[OpsTrendDataPoint]:
    """
    Get daily trend data for ops dashboard.
    
    Returns:
    - Daily count of open items created
    - Daily count of published items
    """
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    
    # Get items created per day
    created_items = db.query(
        func.date(ReviewQueueItem.created_at).label("date"),
        func.count(ReviewQueueItem.id).label("count")
    ).filter(
        ReviewQueueItem.created_at >= cutoff,
        ReviewQueueItem.status == ReviewStatus.OPEN
    ).group_by(
        func.date(ReviewQueueItem.created_at)
    ).all()
    
    # Get items published per day
    published_items = db.query(
        func.date(ReviewQueueItem.published_at).label("date"),
        func.count(ReviewQueueItem.id).label("count")
    ).filter(
        ReviewQueueItem.published_at >= cutoff,
        ReviewQueueItem.status == ReviewStatus.PUBLISHED
    ).group_by(
        func.date(ReviewQueueItem.published_at)
    ).all()
    
    # Create complete date range
    result_dict = {}
    current_date = cutoff.date()
    end_date = datetime.now(timezone.utc).date()
    
    while current_date <= end_date:
        result_dict[current_date] = {
            "date": current_date.isoformat(),
            "open_created": 0,
            "published": 0
        }
        current_date += timedelta(days=1)
    
    # Fill in created counts
    for row in created_items:
        if row.date in result_dict:
            result_dict[row.date]["open_created"] = row.count
    
    # Fill in published counts
    for row in published_items:
        if row.date in result_dict:
            result_dict[row.date]["published"] = row.count
    
    # Convert to list and sort
    result = [
        OpsTrendDataPoint(**data)
        for data in sorted(result_dict.values(), key=lambda x: x["date"])
    ]
    
    return result


@router.get("/submissions", response_model=List[OpsSubmissionResponse])
async def get_ops_submissions(
    status: Optional[str] = None,
    limit: int = 100
) -> List[OpsSubmissionResponse]:
    """
    Get CSF/License submissions for verification work queue.
    
    Query params:
    - status: Filter by status (submitted, in_review, approved, rejected, blocked)
    - limit: Max items to return (default 100)
    """
    store = get_submission_store()
    
    # Parse status filter if provided
    status_filter = None
    if status:
        try:
            status_filter = [SubmissionStatus(status)]
        except ValueError:
            # Invalid status, return empty list
            return []
    
    submissions = store.list_submissions(
        status=status_filter,
        limit=limit
    )
    
    result = []
    for submission in submissions:
        result.append(OpsSubmissionResponse(
            submission_id=submission.submission_id,
            csf_type=submission.csf_type,
            status=submission.status,
            created_at=submission.created_at,
            updated_at=submission.updated_at,
            title=submission.title,
            subtitle=submission.subtitle,
            decision_status=submission.decision_status,
            risk_level=submission.risk_level,
            trace_id=submission.trace_id
        ))
    
    return result
