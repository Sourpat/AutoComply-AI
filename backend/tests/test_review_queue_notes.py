from datetime import datetime

from src.database.connection import SessionLocal, init_db
from src.database.models import Conversation, QuestionEvent, QuestionStatus
from src.services.review_queue_service import ReviewQueueService


def test_review_queue_create_with_notes() -> None:
    init_db()
    db = SessionLocal()
    try:
        conversation = Conversation(session_id=f"test-notes-{datetime.utcnow().timestamp()}")
        db.add(conversation)
        db.commit()
        db.refresh(conversation)

        event = QuestionEvent(
            conversation_id=conversation.id,
            question_text="Test question needing review",
            status=QuestionStatus.NEEDS_REVIEW,
        )
        db.add(event)
        db.commit()
        db.refresh(event)

        service = ReviewQueueService(db)
        item = service.create_review_item(
            question_event_id=event.id,
            notes="queued from test",
        )

        assert item.notes == "queued from test"
    finally:
        db.close()


def test_review_queue_create_without_notes() -> None:
    init_db()
    db = SessionLocal()
    try:
        conversation = Conversation(session_id=f"test-nonotes-{datetime.utcnow().timestamp()}")
        db.add(conversation)
        db.commit()
        db.refresh(conversation)

        event = QuestionEvent(
            conversation_id=conversation.id,
            question_text="Test question without notes",
            status=QuestionStatus.NEEDS_REVIEW,
        )
        db.add(event)
        db.commit()
        db.refresh(event)

        service = ReviewQueueService(db)
        item = service.create_review_item(question_event_id=event.id)

        assert item.notes is None
    finally:
        db.close()
