# backend/src/api/routes/admin_review.py
"""
Admin endpoints for managing the review queue.

Allows reviewers to:
- List review queue items (filtered by status)
- Get details of a specific review item
- Assign items to reviewers
- Update draft answers
- Approve and publish answers to KB
- Reject items
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from typing import Optional, List
from sqlalchemy.orm import Session

from src.database.connection import get_db
from src.database.models import ReviewStatus, ReviewQueueItem, QuestionEvent
from src.services.review_queue_service import ReviewQueueService

router = APIRouter(
    prefix="/api/v1/admin/review-queue",
    tags=["admin", "review-queue"],
)


# ============================================================================
# Request/Response Models
# ============================================================================

class ReviewQueueItemResponse(BaseModel):
    """Response model for a review queue item."""
    id: int
    question_text: str  # From related question_event
    status: str
    draft_answer: Optional[str] = None
    draft_metadata: Optional[dict] = None  # Triage, top_matches, scores
    final_answer: Optional[str] = None
    assigned_to: Optional[str] = None
    tags: Optional[List[str]] = None
    priority: int
    created_at: str
    assigned_at: Optional[str] = None
    approved_at: Optional[str] = None
    published_at: Optional[str] = None
    published_kb_id: Optional[int] = None
    
    # Extra context
    top_match_score: Optional[float] = None
    reason_code: Optional[str] = None


class ReviewQueueListResponse(BaseModel):
    """Response for listing review queue items."""
    items: List[ReviewQueueItemResponse]
    total: int
    stats: dict


class AssignRequest(BaseModel):
    """Request to assign a review item."""
    assigned_to: str = Field(..., min_length=1)


class UpdateDraftRequest(BaseModel):
    """Request to update draft answer."""
    draft_answer: str = Field(..., min_length=1)


class PublishRequest(BaseModel):
    """Request to approve and publish an answer."""
    final_answer: str = Field(..., min_length=1)
    tags: Optional[List[str]] = None


# ============================================================================
# Endpoints
# ============================================================================

@router.get("/items", response_model=ReviewQueueListResponse)
async def list_review_items(
    status: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    db: Session = Depends(get_db)
) -> ReviewQueueListResponse:
    """
    List review queue items with optional status filter.
    
    Query params:
    - status: Filter by status (open, in_review, approved, published)
    - limit: Max items to return (default 50)
    - offset: Pagination offset (default 0)
    """
    review_service = ReviewQueueService(db)
    
    # Parse status if provided
    review_status = None
    if status:
        try:
            review_status = ReviewStatus(status.lower())
        except ValueError:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid status: {status}. Must be one of: open, in_review, approved, published"
            )
    
    # Get items
    items = review_service.get_queue_items(
        status=review_status,
        limit=limit,
        offset=offset
    )
    
    # Get stats
    stats = review_service.get_queue_stats()
    
    # Build response
    response_items = []
    for item in items:
        # Get related question event
        question_event = db.query(QuestionEvent).filter(
            QuestionEvent.id == item.question_event_id
        ).first()
        
        response_items.append(ReviewQueueItemResponse(
            id=item.id,
            question_text=question_event.question_text if question_event else "",
            status=item.status.value,
            draft_answer=item.draft_answer,
            draft_metadata=item.draft_metadata,
            final_answer=item.final_answer,
            assigned_to=item.assigned_to,
            tags=item.tags,
            priority=item.priority,
            created_at=item.created_at.isoformat(),
            assigned_at=item.assigned_at.isoformat() if item.assigned_at else None,
            approved_at=item.approved_at.isoformat() if item.approved_at else None,
            published_at=item.published_at.isoformat() if item.published_at else None,
            published_kb_id=item.published_kb_id,
            top_match_score=question_event.top_match_score if question_event else None,
            reason_code=question_event.reason_code.value if question_event and question_event.reason_code else None
        ))
    
    return ReviewQueueListResponse(
        items=response_items,
        total=len(response_items),
        stats=stats
    )


@router.get("/items/{item_id}", response_model=ReviewQueueItemResponse)
async def get_review_item(
    item_id: int,
    db: Session = Depends(get_db)
) -> ReviewQueueItemResponse:
    """Get details of a specific review queue item."""
    review_service = ReviewQueueService(db)
    
    item = review_service.get_queue_item(item_id)
    
    if not item:
        raise HTTPException(status_code=404, detail="Review item not found")
    
    # Get related question event
    question_event = db.query(QuestionEvent).filter(
        QuestionEvent.id == item.question_event_id
    ).first()
    
    return ReviewQueueItemResponse(
        id=item.id,
        question_text=question_event.question_text if question_event else "",
        status=item.status.value,
        draft_answer=item.draft_answer,
        draft_metadata=item.draft_metadata,
        final_answer=item.final_answer,
        assigned_to=item.assigned_to,
        tags=item.tags,
        priority=item.priority,
        created_at=item.created_at.isoformat(),
        assigned_at=item.assigned_at.isoformat() if item.assigned_at else None,
        approved_at=item.approved_at.isoformat() if item.approved_at else None,
        published_at=item.published_at.isoformat() if item.published_at else None,
        published_kb_id=item.published_kb_id,
        top_match_score=question_event.top_match_score if question_event else None,
        reason_code=question_event.reason_code.value if question_event and question_event.reason_code else None
    )


@router.post("/items/{item_id}/assign")
async def assign_review_item(
    item_id: int,
    request: AssignRequest,
    db: Session = Depends(get_db)
):
    """Assign a review item to a reviewer."""
    review_service = ReviewQueueService(db)
    
    item = review_service.assign_review_item(item_id, request.assigned_to)
    
    if not item:
        raise HTTPException(status_code=404, detail="Review item not found")
    
    return {
        'success': True,
        'item_id': item.id,
        'assigned_to': item.assigned_to,
        'status': item.status.value
    }


@router.post("/items/{item_id}/update-draft")
async def update_draft_answer(
    item_id: int,
    request: UpdateDraftRequest,
    db: Session = Depends(get_db)
):
    """Update the draft answer for a review item."""
    review_service = ReviewQueueService(db)
    
    item = review_service.update_draft_answer(item_id, request.draft_answer)
    
    if not item:
        raise HTTPException(status_code=404, detail="Review item not found")
    
    return {
        'success': True,
        'item_id': item.id,
        'draft_answer_length': len(item.draft_answer) if item.draft_answer else 0
    }


@router.post("/items/{item_id}/publish")
async def publish_answer(
    item_id: int,
    request: PublishRequest,
    db: Session = Depends(get_db)
):
    """
    Approve and publish an answer to the knowledge base.
    
    This is the key workflow action that:
    1. Marks the review item as published
    2. Creates a new KB entry
    3. Makes the answer immediately available for future queries
    """
    # Validate final_answer
    final_answer = request.final_answer.strip()
    
    if not final_answer:
        raise HTTPException(
            status_code=400,
            detail="Final answer cannot be empty"
        )
    
    # Check for draft markers that should not be in final answer (case-insensitive)
    final_answer_lower = final_answer.lower()
    draft_markers = [
        "draft answer",
        "requires human review",
        "reviewer:",
        "**draft**",
        "please write a complete answer",
        "must be reviewed",
        "ai-generated draft"
    ]
    for marker in draft_markers:
        if marker in final_answer_lower:
            raise HTTPException(
                status_code=400,
                detail=f"Final answer looks like a draft. Please provide a clean customer-facing answer."
            )
    
    review_service = ReviewQueueService(db)
    
    item = review_service.approve_and_publish(
        item_id=item_id,
        final_answer=final_answer,
        tags=request.tags
    )
    
    if not item:
        raise HTTPException(status_code=404, detail="Review item not found")
    
    return {
        'success': True,
        'item_id': item.id,
        'status': item.status.value,
        'published_kb_id': item.published_kb_id,
        'message': 'Answer successfully published to knowledge base'
    }


@router.post("/items/{item_id}/reject")
async def reject_review_item(
    item_id: int,
    db: Session = Depends(get_db)
):
    """Reject a review item (moves it back to OPEN status)."""
    review_service = ReviewQueueService(db)
    
    item = review_service.reject_review_item(item_id)
    
    if not item:
        raise HTTPException(status_code=404, detail="Review item not found")
    
    return {
        'success': True,
        'item_id': item.id,
        'status': item.status.value
    }


@router.get("/stats")
async def get_queue_stats(db: Session = Depends(get_db)):
    """Get statistics about the review queue."""
    review_service = ReviewQueueService(db)
    stats = review_service.get_queue_stats()
    
    return stats
