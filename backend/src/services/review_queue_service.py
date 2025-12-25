# backend/src/services/review_queue_service.py
"""
Review Queue service for managing human-in-the-loop workflow.
"""

from typing import List, Optional
from sqlalchemy.orm import Session
from datetime import datetime
import logging

from src.database.models import (
    ReviewQueueItem,
    ReviewStatus,
    QuestionEvent,
    QuestionStatus,
    ReasonCode,
    Conversation,
    Message,
)
from src.services.kb_service import KBService

logger = logging.getLogger(__name__)


class ReviewQueueService:
    """Service for review queue operations."""

    def __init__(self, db: Session):
        self.db = db
        self.kb_service = KBService(db)

    def create_review_item(
        self,
        question_event_id: int,
        draft_answer: Optional[str] = None,
        draft_metadata: Optional[dict] = None,
        tags: Optional[List[str]] = None,
        priority: int = 0
    ) -> ReviewQueueItem:
        """
        Create a new review queue item for a question that needs review.
        """
        review_item = ReviewQueueItem(
            question_event_id=question_event_id,
            status=ReviewStatus.OPEN,
            draft_answer=draft_answer,
            draft_metadata=draft_metadata,
            tags=tags,
            priority=priority
        )
        
        self.db.add(review_item)
        self.db.commit()
        self.db.refresh(review_item)
        
        logger.info(f"Created review queue item {review_item.id} for question event {question_event_id}")
        return review_item

    def get_queue_items(
        self,
        status: Optional[ReviewStatus] = None,
        limit: int = 50,
        offset: int = 0
    ) -> List[ReviewQueueItem]:
        """
        Get review queue items with optional status filter.
        """
        query = self.db.query(ReviewQueueItem)
        
        if status:
            query = query.filter(ReviewQueueItem.status == status)
        
        # Order by priority (desc) then created_at (asc)
        query = query.order_by(
            ReviewQueueItem.priority.desc(),
            ReviewQueueItem.created_at.asc()
        )
        
        return query.offset(offset).limit(limit).all()

    def get_queue_item(self, item_id: int) -> Optional[ReviewQueueItem]:
        """Get a specific review queue item with related data."""
        return self.db.query(ReviewQueueItem).filter(
            ReviewQueueItem.id == item_id
        ).first()

    def assign_review_item(
        self,
        item_id: int,
        assigned_to: str
    ) -> Optional[ReviewQueueItem]:
        """Assign a review item to a reviewer."""
        item = self.get_queue_item(item_id)
        
        if not item:
            return None
        
        item.assigned_to = assigned_to
        item.assigned_at = datetime.utcnow()
        item.status = ReviewStatus.IN_REVIEW
        
        self.db.commit()
        self.db.refresh(item)
        
        logger.info(f"Assigned review item {item_id} to {assigned_to}")
        return item

    def update_draft_answer(
        self,
        item_id: int,
        draft_answer: str
    ) -> Optional[ReviewQueueItem]:
        """Update the draft answer for a review item."""
        item = self.get_queue_item(item_id)
        
        if not item:
            return None
        
        item.draft_answer = draft_answer
        
        self.db.commit()
        self.db.refresh(item)
        
        return item

    def approve_and_publish(
        self,
        item_id: int,
        final_answer: str,
        tags: Optional[List[str]] = None
    ) -> Optional[ReviewQueueItem]:
        """
        Approve a review item and publish it to the KB.
        
        This is the key workflow step that:
        1. Marks the review item as approved
        2. Creates a new KB entry with the canonical question + final answer
        3. Links the review item to the published KB entry
        4. Updates the question event status
        """
        item = self.get_queue_item(item_id)
        
        if not item:
            return None
        
        # Get the original question from the question event
        question_event = self.db.query(QuestionEvent).filter(
            QuestionEvent.id == item.question_event_id
        ).first()
        
        if not question_event:
            logger.error(f"Question event {item.question_event_id} not found")
            return None
        
        # Create KB entry with auto-generated variants
        kb_entry = self.kb_service.create_kb_entry(
            canonical_question=question_event.question_text,
            answer=final_answer,
            tags=tags or item.tags,
            source="review_queue",
            auto_generate_variants=True  # Generate 3-5 variants automatically
        )
        
        logger.info(f"Published KB entry {kb_entry.id} with {len(kb_entry.question_variants) if kb_entry.question_variants else 0} variants")
        
        # Update review item
        item.final_answer = final_answer
        item.status = ReviewStatus.PUBLISHED
        item.approved_at = datetime.utcnow()
        item.published_at = datetime.utcnow()
        item.published_kb_id = kb_entry.id
        
        if tags:
            item.tags = tags
        
        # Update question event to mark as answered
        question_event.status = QuestionStatus.ANSWERED
        question_event.top_match_kb_id = kb_entry.id
        question_event.top_match_score = 1.0  # Perfect match since it's the exact question
        
        self.db.commit()
        self.db.refresh(item)
        
        logger.info(f"Published review item {item_id} as KB entry {kb_entry.id}")
        return item

    def reject_review_item(
        self,
        item_id: int,
        reason: Optional[str] = None
    ) -> Optional[ReviewQueueItem]:
        """Reject a review item (move back to OPEN or delete)."""
        item = self.get_queue_item(item_id)
        
        if not item:
            return None
        
        # For now, just move back to OPEN status
        item.status = ReviewStatus.OPEN
        item.assigned_to = None
        item.assigned_at = None
        
        self.db.commit()
        self.db.refresh(item)
        
        logger.info(f"Rejected review item {item_id}")
        return item

    def get_queue_stats(self) -> dict:
        """Get statistics about the review queue."""
        total_open = self.db.query(ReviewQueueItem).filter(
            ReviewQueueItem.status == ReviewStatus.OPEN
        ).count()
        
        total_in_review = self.db.query(ReviewQueueItem).filter(
            ReviewQueueItem.status == ReviewStatus.IN_REVIEW
        ).count()
        
        total_published = self.db.query(ReviewQueueItem).filter(
            ReviewQueueItem.status == ReviewStatus.PUBLISHED
        ).count()
        
        return {
            'open': total_open,
            'in_review': total_in_review,
            'published': total_published,
            'total': total_open + total_in_review + total_published
        }
