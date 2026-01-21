# backend/src/api/routes/metrics.py
"""
Metrics endpoint for the Learn After First Unknown feature.

Provides analytics on:
- Answer rate vs review rate
- Average time to publish
- Top unknown questions
- KB coverage
"""

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from datetime import datetime, timedelta, timezone

from src.database.connection import get_db
from src.database.models import (
    QuestionEvent,
    QuestionStatus,
    ReviewQueueItem,
    ReviewStatus,
    KBEntry,
    Message,
)

router = APIRouter(
    prefix="/api/v1/metrics",
    tags=["metrics"],
)


# ============================================================================
# Response Models
# ============================================================================

class MetricsResponse(BaseModel):
    """Overall metrics for the Learn After First Unknown feature."""
    
    # Answer rates
    total_questions: int
    answered_count: int
    needs_review_count: int
    answered_rate: float  # Percentage of questions answered from KB
    review_rate: float  # Percentage needing review
    
    # Review queue metrics
    total_review_items: int
    open_items: int
    in_review_items: int
    published_items: int
    
    # Performance metrics
    avg_publish_time_hours: Optional[float] = None  # Average time from question to publish
    
    # KB metrics
    total_kb_entries: int
    kb_sources: Dict[str, int]  # Count by source (manual, review_queue, etc.)
    
    # Top unknown questions (questions that triggered NEEDS_REVIEW)
    top_unknown_questions: List[Dict[str, Any]]


# ============================================================================
# Endpoints
# ============================================================================

@router.get("/", response_model=MetricsResponse)
async def get_metrics(
    days: int = 30,  # Look back period
    db: Session = Depends(get_db)
) -> MetricsResponse:
    """
    Get comprehensive metrics for the Learn After First Unknown feature.
    
    Query params:
    - days: Look back period for metrics (default 30 days)
    """
    
    # Calculate date range
    cutoff_date = datetime.now(timezone.utc) - timedelta(days=days)
    
    # ========================================================================
    # Question metrics
    # ========================================================================
    
    total_questions = db.query(QuestionEvent).filter(
        QuestionEvent.created_at >= cutoff_date
    ).count()
    
    answered_count = db.query(QuestionEvent).filter(
        QuestionEvent.created_at >= cutoff_date,
        QuestionEvent.status == QuestionStatus.ANSWERED
    ).count()
    
    needs_review_count = db.query(QuestionEvent).filter(
        QuestionEvent.created_at >= cutoff_date,
        QuestionEvent.status == QuestionStatus.NEEDS_REVIEW
    ).count()
    
    answered_rate = (answered_count / total_questions * 100) if total_questions > 0 else 0.0
    review_rate = (needs_review_count / total_questions * 100) if total_questions > 0 else 0.0
    
    # ========================================================================
    # Review queue metrics
    # ========================================================================
    
    total_review_items = db.query(ReviewQueueItem).count()
    
    open_items = db.query(ReviewQueueItem).filter(
        ReviewQueueItem.status == ReviewStatus.OPEN
    ).count()
    
    in_review_items = db.query(ReviewQueueItem).filter(
        ReviewQueueItem.status == ReviewStatus.IN_REVIEW
    ).count()
    
    published_items = db.query(ReviewQueueItem).filter(
        ReviewQueueItem.status == ReviewStatus.PUBLISHED
    ).count()
    
    # ========================================================================
    # Performance metrics - Average publish time
    # ========================================================================
    
    # Get published items with timestamps
    published_with_times = db.query(ReviewQueueItem).filter(
        ReviewQueueItem.status == ReviewStatus.PUBLISHED,
        ReviewQueueItem.published_at.isnot(None)
    ).all()
    
    if published_with_times:
        total_hours = 0
        for item in published_with_times:
            # Get the question event to find when the question was asked
            question_event = db.query(QuestionEvent).filter(
                QuestionEvent.id == item.question_event_id
            ).first()
            
            if question_event:
                time_diff = item.published_at - question_event.created_at
                total_hours += time_diff.total_seconds() / 3600
        
        avg_publish_time_hours = total_hours / len(published_with_times)
    else:
        avg_publish_time_hours = None
    
    # ========================================================================
    # KB metrics
    # ========================================================================
    
    total_kb_entries = db.query(KBEntry).count()
    
    # Count by source
    kb_by_source = db.query(
        KBEntry.source,
        func.count(KBEntry.id)
    ).group_by(KBEntry.source).all()
    
    kb_sources = {source or 'unknown': count for source, count in kb_by_source}
    
    # ========================================================================
    # Top unknown questions
    # ========================================================================
    
    # Get top 10 questions that needed review (ordered by created_at desc)
    top_unknown = db.query(QuestionEvent).filter(
        QuestionEvent.status == QuestionStatus.NEEDS_REVIEW,
        QuestionEvent.created_at >= cutoff_date
    ).order_by(desc(QuestionEvent.created_at)).limit(10).all()
    
    top_unknown_questions = []
    for qe in top_unknown:
        # Get review item if exists
        review_item = db.query(ReviewQueueItem).filter(
            ReviewQueueItem.question_event_id == qe.id
        ).first()
        
        top_unknown_questions.append({
            'question_id': qe.id,
            'question': qe.question_text,
            'reason_code': qe.reason_code.value if qe.reason_code else None,
            'top_match_score': qe.top_match_score,
            'created_at': qe.created_at.isoformat(),
            'review_status': review_item.status.value if review_item else None,
            'queue_item_id': review_item.id if review_item else None
        })
    
    # ========================================================================
    # Build response
    # ========================================================================
    
    return MetricsResponse(
        total_questions=total_questions,
        answered_count=answered_count,
        needs_review_count=needs_review_count,
        answered_rate=round(answered_rate, 2),
        review_rate=round(review_rate, 2),
        total_review_items=total_review_items,
        open_items=open_items,
        in_review_items=in_review_items,
        published_items=published_items,
        avg_publish_time_hours=round(avg_publish_time_hours, 2) if avg_publish_time_hours else None,
        total_kb_entries=total_kb_entries,
        kb_sources=kb_sources,
        top_unknown_questions=top_unknown_questions
    )


@router.get("/summary")
async def get_metrics_summary(db: Session = Depends(get_db)):
    """Quick summary metrics for dashboard widgets."""
    total_questions = db.query(QuestionEvent).count()
    answered = db.query(QuestionEvent).filter(
        QuestionEvent.status == QuestionStatus.ANSWERED
    ).count()
    
    total_kb = db.query(KBEntry).count()
    pending_review = db.query(ReviewQueueItem).filter(
        ReviewQueueItem.status == ReviewStatus.OPEN
    ).count()
    
    return {
        'total_questions': total_questions,
        'answered': answered,
        'total_kb_entries': total_kb,
        'pending_review': pending_review,
        'answer_rate': round((answered / total_questions * 100) if total_questions > 0 else 0, 1)
    }
