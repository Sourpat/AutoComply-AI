# backend/src/api/routes/chat.py
"""
Chat endpoint with "Learn After First Unknown Question" feature.

Key features:
- KB similarity search for answering questions
- Similarity threshold gating (SIMILARITY_THRESHOLD)
- Policy safety gate (basic content filtering)
- Human-in-loop review queue for unknown questions
- Decision trace on every response
- Optional AI draft answer generation for review queue items
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session
import uuid
import logging
import re

from src.database.connection import get_db
from src.database.models import (
    Conversation,
    Message,
    QuestionEvent,
    QuestionStatus,
    ReasonCode,
)
from src.services.kb_service import KBService, SIMILARITY_THRESHOLD
from src.services.review_queue_service import ReviewQueueService

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/v1/chat",
    tags=["chat"],
)


# ============================================================================
# Request/Response Models
# ============================================================================

class ChatRequest(BaseModel):
    """Request to send a message to the chatbot."""
    question: str = Field(..., min_length=1, max_length=5000)
    session_id: Optional[str] = None  # Optional session tracking
    user_id: Optional[str] = None  # Optional user tracking


class DecisionTrace(BaseModel):
    """Decision trace explaining what happened in the backend."""
    kb_searched: bool
    top_match_score: Optional[float] = None
    top_3_matches: List[Dict[str, Any]] = Field(default_factory=list)
    similarity_threshold: float
    passed_similarity_gate: bool
    passed_policy_gate: bool
    gating_decision: str  # "ANSWERED" or "NEEDS_REVIEW"
    reason_code: Optional[str] = None  # "low_similarity", "policy_gate", "no_kb_match"
    queue_item_id: Optional[int] = None
    model_metadata: Dict[str, Any] = Field(default_factory=dict)


class ChatResponse(BaseModel):
    """Response from the chatbot."""
    answer: str
    decision_trace: DecisionTrace
    session_id: str
    message_id: int


# ============================================================================
# Helper Functions
# ============================================================================

def check_policy_gate(question: str) -> bool:
    """
    Basic policy safety gate.
    
    Returns True if the question passes (is safe).
    Returns False if the question should be flagged for review.
    
    For prototype, we implement very basic filtering. In production,
    this would use content moderation APIs.
    """
    question_lower = question.lower()
    
    # Block obviously inappropriate content
    blocked_patterns = [
        r'\bhack\b',
        r'\bexploit\b',
        r'\bmalware\b',
        r'\bpassword.*crack\b',
        # Add more patterns as needed
    ]
    
    for pattern in blocked_patterns:
        if re.search(pattern, question_lower):
            logger.warning(f"Policy gate triggered for question: {question[:50]}")
            return False
    
    return True


def generate_draft_answer(question: str, kb_service: KBService) -> Optional[str]:
    """
    Generate an AI draft answer for review queue items.
    
    For prototype, we return a simple placeholder. In production,
    this would call an LLM to generate a draft answer based on:
    - The question
    - Top KB matches (as context)
    - Regulatory documents (RAG)
    """
    # Simple placeholder for now
    draft = (
        f"**[DRAFT - Requires Human Review]**\n\n"
        f"This is a draft answer for: \"{question}\"\n\n"
        f"Please review and edit this answer before publishing to the knowledge base."
    )
    return draft


# ============================================================================
# Endpoints
# ============================================================================

@router.post("/ask", response_model=ChatResponse)
async def ask_question(
    request: ChatRequest,
    db: Session = Depends(get_db)
) -> ChatResponse:
    """
    Ask a question to the compliance chatbot.
    
    Flow:
    1. Search KB for similar questions
    2. Apply similarity threshold gate
    3. Apply policy safety gate
    4. If gates pass -> return KB answer with decision trace
    5. If gates fail -> create review queue item, return fallback with decision trace
    """
    kb_service = KBService(db)
    review_service = ReviewQueueService(db)
    
    # Get or create conversation
    session_id = request.session_id or str(uuid.uuid4())
    conversation = db.query(Conversation).filter(
        Conversation.session_id == session_id
    ).first()
    
    if not conversation:
        conversation = Conversation(
            session_id=session_id,
            user_id=request.user_id
        )
        db.add(conversation)
        db.commit()
        db.refresh(conversation)
    
    # Save user message
    user_message = Message(
        conversation_id=conversation.id,
        role="user",
        content=request.question
    )
    db.add(user_message)
    db.commit()
    
    # 1. Search KB
    best_match, top_3_matches = kb_service.search_kb(request.question, top_k=3)
    
    # Prepare decision trace data
    top_match_score = best_match['score'] if best_match else None
    kb_searched = True
    
    # 2. Apply gates
    passed_similarity_gate = False
    passed_policy_gate = True
    reason_code = None
    answer = ""
    queue_item_id = None
    
    # Check if we have any KB entries
    if best_match is None:
        # No KB entries at all
        passed_similarity_gate = False
        reason_code = ReasonCode.NO_KB_MATCH.value
    elif best_match['score'] >= SIMILARITY_THRESHOLD:
        # Similarity threshold passed
        passed_similarity_gate = True
    else:
        # Below threshold
        passed_similarity_gate = False
        reason_code = ReasonCode.LOW_SIMILARITY.value
    
    # Policy gate check
    if not check_policy_gate(request.question):
        passed_policy_gate = False
        reason_code = ReasonCode.POLICY_GATE.value
    
    # 3. Determine final decision
    if passed_similarity_gate and passed_policy_gate:
        # ANSWERED - return KB answer
        answer = best_match['answer']
        question_status = QuestionStatus.ANSWERED
        gating_decision = "ANSWERED"
    else:
        # NEEDS_REVIEW - create review queue item
        answer = (
            "Thank you for your question. This query has been submitted for review "
            "by our compliance team. We'll update our knowledge base with the answer "
            "and it will be available for future queries."
        )
        question_status = QuestionStatus.NEEDS_REVIEW
        gating_decision = "NEEDS_REVIEW"
    
    # 4. Create question event
    question_event = QuestionEvent(
        conversation_id=conversation.id,
        question_text=request.question,
        status=question_status,
        reason_code=reason_code,
        top_match_score=top_match_score,
        top_match_kb_id=best_match['kb_id'] if best_match else None,
        top_3_matches=[
            {
                'kb_id': m['kb_id'],
                'question': m['canonical_question'],
                'score': m['score']
            }
            for m in top_3_matches
        ]
    )
    db.add(question_event)
    db.commit()
    db.refresh(question_event)
    
    # 5. If NEEDS_REVIEW, create review queue item
    if question_status == QuestionStatus.NEEDS_REVIEW:
        draft_answer = generate_draft_answer(request.question, kb_service)
        
        review_item = review_service.create_review_item(
            question_event_id=question_event.id,
            draft_answer=draft_answer,
            tags=["auto-generated"],
            priority=0
        )
        queue_item_id = review_item.id
    
    # 6. Save assistant message
    assistant_message = Message(
        conversation_id=conversation.id,
        role="assistant",
        content=answer,
        question_event_id=question_event.id
    )
    db.add(assistant_message)
    db.commit()
    db.refresh(assistant_message)
    
    # 7. Build decision trace
    decision_trace = DecisionTrace(
        kb_searched=kb_searched,
        top_match_score=top_match_score,
        top_3_matches=[
            {
                'kb_id': m['kb_id'],
                'canonical_question': m['canonical_question'],
                'score': round(m['score'], 4)
            }
            for m in top_3_matches
        ],
        similarity_threshold=SIMILARITY_THRESHOLD,
        passed_similarity_gate=passed_similarity_gate,
        passed_policy_gate=passed_policy_gate,
        gating_decision=gating_decision,
        reason_code=reason_code,
        queue_item_id=queue_item_id,
        model_metadata={
            'embedding_model': 'all-MiniLM-L6-v2',
            'kb_entry_count': len(kb_service.get_all_kb_entries()),
            'version': '1.0.0'
        }
    )
    
    return ChatResponse(
        answer=answer,
        decision_trace=decision_trace,
        session_id=session_id,
        message_id=assistant_message.id
    )


@router.get("/history/{session_id}")
async def get_chat_history(
    session_id: str,
    db: Session = Depends(get_db)
):
    """Get chat history for a session."""
    conversation = db.query(Conversation).filter(
        Conversation.session_id == session_id
    ).first()
    
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    messages = db.query(Message).filter(
        Message.conversation_id == conversation.id
    ).order_by(Message.created_at.asc()).all()
    
    return {
        'session_id': session_id,
        'messages': [
            {
                'id': msg.id,
                'role': msg.role,
                'content': msg.content,
                'created_at': msg.created_at.isoformat()
            }
            for msg in messages
        ]
    }
