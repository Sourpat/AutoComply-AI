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

RAG DEPENDENCY: Chat endpoint can work without RAG but with reduced functionality.
When RAG is disabled, all questions go to review queue with helpful message.
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session
import uuid
import logging
import re

from src.database.connection import get_db
from src.config import get_settings
from src.database.models import (
    Conversation,
    Message,
    QuestionEvent,
    QuestionStatus,
    ReasonCode,
)
from src.services.review_queue_service import ReviewQueueService

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/v1/chat",
    tags=["chat"],
)

alias_router = APIRouter(
    prefix="/api/chat",
    tags=["chat"],
)

# Note: SIMILARITY_THRESHOLD imported dynamically when RAG enabled
SIMILARITY_THRESHOLD = 0.78  # Fallback default


# ============================================================================
# Triage Models
# ============================================================================

class TriageResult(BaseModel):
    """Result of lightweight question triage."""
    intent_category: str  # 'license_inquiry', 'csf_question', 'general', 'unclear'
    risk_level: str  # 'low', 'medium', 'high'
    needs_clarification: bool
    recommended_action: str  # 'ANSWER', 'ASK_CLARIFY', 'NEEDS_REVIEW', 'BLOCK'
    clarifying_question: Optional[str] = None
    confidence: float = 0.0
    reasoning: str = ""


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
    # Triage results
    triage: Optional[Dict[str, Any]] = None
    
    # KB retrieval results
    kb_searched: bool
    top_match_score: Optional[float] = None
    matched_text: Optional[str] = None  # Canonical question or variant that matched
    matched_kb_entry_id: Optional[int] = None  # KB entry ID that matched
    matched_variant_index: Optional[int] = None  # None if canonical, else variant index
    top_3_matches: List[Dict[str, Any]] = Field(default_factory=list)
    similarity_threshold: float
    passed_similarity_gate: bool
    passed_policy_gate: bool
    gating_decision: str  # "ANSWERED", "NEEDS_REVIEW", "ASK_CLARIFY"
    reason_code: Optional[str] = None  # "low_similarity", "policy_gate", "no_kb_match", "jurisdiction_mismatch"
    queue_item_id: Optional[int] = None
    model_metadata: Dict[str, Any] = Field(default_factory=dict)
    
    # Jurisdiction filtering
    requested_states: Optional[List[str]] = None  # States mentioned in user question
    matched_entry_states: Optional[List[str]] = None  # States in matched KB entry
    jurisdiction_mismatch: bool = False  # True if states don't overlap


class ChatResponse(BaseModel):
    """Response from the chatbot."""
    answer: str
    decision_trace: DecisionTrace
    session_id: str
    message_id: int
    reviewer_draft: Optional[str] = None  # Detailed markdown draft for reviewers (only for NEEDS_REVIEW)


# ============================================================================
# Helper Functions
# ============================================================================

def contains_draft_markers(text: str) -> bool:
    """
    Check if text contains draft/reviewer markers that should not be served to users.
    
    Returns True if text appears to be a draft or contains reviewer instructions.
    """
    if not text:
        return False
    
    lower = text.lower()
    markers = [
        "draft answer",
        "requires human review",
        "reviewer:",
        "please write a complete answer",
        "must be reviewed",
        "ai-generated draft"
    ]
    return any(m in lower for m in markers)


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


def triage_question(question: str) -> TriageResult:
    """
    Lightweight triage before KB retrieval.
    
    Classifies the question to determine:
    - Intent category
    - Risk level
    - Whether clarification is needed
    - Recommended action
    
    For prototype, uses rule-based heuristics. In production, this
    would use an LLM or fine-tuned classifier.
    """
    question_lower = question.lower().strip()
    
    # Check if question is too vague/short
    if len(question) < 10 or len(question.split()) < 3:
        return TriageResult(
            intent_category="unclear",
            risk_level="low",
            needs_clarification=True,
            recommended_action="ASK_CLARIFY",
            clarifying_question="Could you provide more details about your question? For example, which state or regulation are you asking about?",
            confidence=0.8,
            reasoning="Question too short or vague"
        )
    
    # Detect intent category
    intent_category = "general"
    if any(kw in question_lower for kw in ['license', 'registration', 'register', 'permit']):
        intent_category = "license_inquiry"
    elif any(kw in question_lower for kw in ['controlled substance', 'csf', 'schedule', 'dea']):
        intent_category = "csf_question"
    elif any(kw in question_lower for kw in ['compliance', 'regulation', 'requirement']):
        intent_category = "compliance_inquiry"
    
    # Determine risk level
    risk_level = "low"
    if any(kw in question_lower for kw in ['urgent', 'emergency', 'deadline', 'audit', 'violation']):
        risk_level = "high"
    elif any(kw in question_lower for kw in ['important', 'soon', 'asap']):
        risk_level = "medium"
    
    # Check if clarification needed (very basic heuristic)
    needs_clarification = False
    clarifying_question = None
    
    # Questions asking "how" or "what" without specifics might need clarification
    if question_lower.startswith(("how", "what", "when")) and intent_category == "general":
        if not any(state in question_lower for state in ['ohio', 'california', 'new york', 'texas', 'florida']):
            needs_clarification = True
            clarifying_question = "Which state or jurisdiction are you asking about?"
    
    # Determine recommended action
    if needs_clarification:
        recommended_action = "ASK_CLARIFY"
    elif risk_level == "high":
        recommended_action = "NEEDS_REVIEW"
    else:
        recommended_action = "ANSWER"  # Attempt to answer from KB
    
    return TriageResult(
        intent_category=intent_category,
        risk_level=risk_level,
        needs_clarification=needs_clarification,
        recommended_action=recommended_action,
        clarifying_question=clarifying_question,
        confidence=0.7,
        reasoning=f"Detected as {intent_category} with {risk_level} risk"
    )


def generate_draft_answer(
    question: str,
    triage: 'TriageResult',
    top_3_matches: List[Dict[str, Any]]
) -> str:
    """
    Generate an AI draft answer for review queue items.
    
    Rules:
    - Must not hallucinate (only reference known KB matches)
    - Clearly labeled as draft for reviewer approval
    - Includes assumptions, missing info, and safe disclaimer
    - Includes references if any KB matches exist
    
    For prototype, this is template-based. In production, this would
    call an LLM with strict prompting to avoid hallucination.
    """
    draft_parts = []
    
    # Header with clear labeling
    draft_parts.append("## DRAFT ANSWER - REQUIRES HUMAN REVIEW")
    draft_parts.append("")
    draft_parts.append("**Question:**")
    draft_parts.append(f"> {question}")
    draft_parts.append("")
    
    # Triage classification
    draft_parts.append("### Classification")
    draft_parts.append(f"- **Intent:** {triage.intent_category}")
    draft_parts.append(f"- **Risk Level:** {triage.risk_level}")
    draft_parts.append(f"- **Triage Reasoning:** {triage.reasoning}")
    draft_parts.append("")
    
    # Assumptions and missing information
    draft_parts.append("### Assumptions & Missing Information")
    assumptions = []
    
    if triage.intent_category == "unclear":
        assumptions.append("⚠️ Question is too vague to classify accurately")
    
    # Check for state/jurisdiction
    if not any(state in question.lower() for state in ['ohio', 'california', 'new york', 'texas', 'florida', 'state']):
        assumptions.append("⚠️ No specific state or jurisdiction mentioned")
    
    # Check for specificity
    if len(question.split()) < 5:
        assumptions.append("⚠️ Question lacks detail")
    
    if triage.risk_level == "high":
        assumptions.append("⚠️ High-risk question requires urgent review")
    
    if not assumptions:
        assumptions.append("✓ Question appears sufficiently detailed")
    
    for assumption in assumptions:
        draft_parts.append(f"- {assumption}")
    draft_parts.append("")
    
    # Related KB matches (if any)
    if top_3_matches:
        draft_parts.append("### Related Knowledge Base Entries")
        draft_parts.append("")
        draft_parts.append("The following KB entries may be relevant (even with low similarity):")
        draft_parts.append("")
        
        for i, match in enumerate(top_3_matches, 1):
            score_pct = match['score'] * 100
            draft_parts.append(f"{i}. **[{score_pct:.1f}% match]** {match['canonical_question']}")
            draft_parts.append(f"   - KB Entry #{match['kb_id']}")
            
            # Show answer if score is decent
            if match['score'] >= 0.5:
                answer_preview = match.get('answer', '')[:150]
                draft_parts.append(f"   - Answer preview: {answer_preview}...")
            else:
                draft_parts.append(f"   - Similarity too low to use directly")
            draft_parts.append("")
    else:
        draft_parts.append("### Related Knowledge Base Entries")
        draft_parts.append("")
        draft_parts.append("⚠️ **No existing KB entries found.** This is a completely new question.")
        draft_parts.append("")
    
    # Suggested answer section (placeholder for human)
    draft_parts.append("### Suggested Answer")
    draft_parts.append("")
    
    if top_3_matches and top_3_matches[0]['score'] >= 0.5:
        # High enough match to suggest adaptation
        draft_parts.append(f"Consider adapting the answer from KB Entry #{top_3_matches[0]['kb_id']}:")
        draft_parts.append("")
        draft_parts.append("```")
        draft_parts.append(top_3_matches[0].get('answer', '[Answer not available]'))
        draft_parts.append("```")
        draft_parts.append("")
        draft_parts.append("**Reviewer:** Please modify the above answer to address the specific question.")
    else:
        # No good matches - reviewer must write from scratch
        draft_parts.append("**[Reviewer: Please write a complete answer here]**")
        draft_parts.append("")
        draft_parts.append("Guidelines:")
        draft_parts.append("- Be specific and accurate")
        draft_parts.append("- Include relevant regulations or citations")
        draft_parts.append("- Keep language clear and professional")
        draft_parts.append("- Add disclaimers if legal/medical advice")
    
    draft_parts.append("")
    
    # Safe disclaimer
    draft_parts.append("### ⚠️ Important Disclaimer")
    draft_parts.append("")
    draft_parts.append(
        "This draft is automatically generated and **must be reviewed by a compliance expert** "
        "before publishing. Do not use this draft directly without human verification."
    )
    draft_parts.append("")
    draft_parts.append(
        "If this question involves legal interpretation, medical advice, or time-sensitive compliance requirements, "
        "escalate to appropriate subject matter experts."
    )
    
    return "\n".join(draft_parts)


# ============================================================================
# Endpoints
# ============================================================================

@alias_router.get("/health")
async def chat_health() -> dict:
    return {"ok": True, "route": "chat"}

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
    
    CRITICAL: Never returns 500 to UI. All errors result in NEEDS_REVIEW with internal_error reason.
    """
    try:
        return await _ask_question_internal(request, db)
    except Exception as e:
        # CRITICAL: Catch ALL exceptions to prevent 500 errors to users
        logger.error(f"[EXCEPTION] Unhandled exception in ask_question for '{request.question[:60]}...': {e}", exc_info=True)
        
        # Try to save error to review queue (best effort)
        session_id = request.session_id or str(uuid.uuid4())
        queue_item_id = None
        
        try:
            review_service = ReviewQueueService(db)
            
            # Get or create conversation
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
            
            # Create question event for the error
            question_event = QuestionEvent(
                conversation_id=conversation.id,
                question_text=request.question,
                status=QuestionStatus.NEEDS_REVIEW,
                reason_code=ReasonCode.INTERNAL_ERROR.value,
                intent_category="error",
                risk_level="high"
            )
            db.add(question_event)
            db.commit()
            db.refresh(question_event)
            
            # Create review queue item
            draft_answer = f"## INTERNAL ERROR - REQUIRES INVESTIGATION\n\n**Question:**\n> {request.question}\n\n**Error:**\n```\n{type(e).__name__}: {str(e)}\n```\n\n**Action Required:**\nInvestigate the error and provide a proper answer to this question."
            
            review_item = review_service.create_review_item(
                question_event_id=question_event.id,
                draft_answer=draft_answer,
                draft_metadata={
                    'error_type': type(e).__name__,
                    'error_message': str(e)
                },
                tags=["internal_error", "high_priority"],
                priority=10  # High priority
            )
            queue_item_id = review_item.id
            logger.info(f"Created review queue item #{queue_item_id} for internal error")
            
        except Exception as inner_e:
            # If we can't even create a review item, just log it
            logger.error(f"[EXCEPTION] Failed to create review item for error: {inner_e}", exc_info=True)
        
        # Return clean NEEDS_REVIEW response
        decision_trace = DecisionTrace(
            kb_searched=False,
            similarity_threshold=SIMILARITY_THRESHOLD,
            passed_similarity_gate=False,
            passed_policy_gate=False,
            gating_decision="NEEDS_REVIEW",
            reason_code=ReasonCode.INTERNAL_ERROR.value,
            queue_item_id=queue_item_id,
            model_metadata={
                'error': str(e),
                'error_type': type(e).__name__
            }
        )
        
        return ChatResponse(
            answer="Thank you for your question. This query has been submitted for review by our compliance team. We'll update our knowledge base with the answer and it will be available for future queries.",
            decision_trace=decision_trace,
            session_id=session_id,
            message_id=0  # Placeholder when DB save fails
        )


@alias_router.post("/ask", response_model=ChatResponse)
async def ask_question_alias(
    request: ChatRequest,
    db: Session = Depends(get_db)
) -> ChatResponse:
    return await ask_question(request, db)


async def _ask_question_internal(
    request: ChatRequest,
    db: Session
) -> ChatResponse:
    """
    Internal implementation of ask_question with full error handling.
    
    Works with or without RAG enabled. When RAG is disabled, routes
    all questions to review queue with helpful message.
    """
    settings = get_settings()
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
    
    # Check if RAG is enabled
    if not settings.rag_enabled:
        # RAG disabled - route to review queue with helpful message
        logger.info(f"RAG disabled - routing question to review queue: {request.question[:50]}...")
        
        question_event = QuestionEvent(
            conversation_id=conversation.id,
            question_text=request.question,
            status=QuestionStatus.NEEDS_REVIEW,
            reason_code=ReasonCode.RAG_DISABLED
        )
        db.add(question_event)
        db.commit()
        db.refresh(question_event)
        
        # Create review queue item
        queue_item = review_service.create_review_item(
            question_event_id=question_event.id,
            priority=0,
            notes="RAG features disabled - manual answer needed"
        )
        
        decision_trace = DecisionTrace(
            kb_searched=False,
            top_match_score=None,
            top_3_matches=[],
            similarity_threshold=SIMILARITY_THRESHOLD,
            passed_similarity_gate=False,
            passed_policy_gate=True,
            gating_decision="NEEDS_REVIEW",
            reason_code="rag_disabled",
            queue_item_id=queue_item.id,
            model_metadata={
                'rag_enabled': False,
                'message': 'RAG features disabled in production'
            }
        )
        
        answer = (
            "Thank you for your question. Our knowledge base search is currently unavailable, "
            "so your question has been submitted for review by our compliance team. "
            "We'll provide an answer soon and add it to our knowledge base for future reference."
        )
        
        bot_message = Message(
            conversation_id=conversation.id,
            role="assistant",
            content=answer,
            question_event_id=question_event.id
        )
        db.add(bot_message)
        db.commit()
        db.refresh(bot_message)
        
        return ChatResponse(
            answer=answer,
            decision_trace=decision_trace,
            session_id=session_id,
            message_id=bot_message.id
        )
    
    # RAG is enabled - proceed with KB search
    try:
        from src.services.kb_service import KBService
        kb_service = KBService(db)
    except ImportError as e:
        logger.error(f"KB service import failed even though RAG enabled: {e}")
        # Fall back to review queue
        question_event = QuestionEvent(
            conversation_id=conversation.id,
            question_text=request.question,
            status=QuestionStatus.NEEDS_REVIEW,
            reason_code=ReasonCode.IMPORT_ERROR
        )
        db.add(question_event)
        db.commit()
        db.refresh(question_event)
        
        queue_item = review_service.create_review_item(
            question_event_id=question_event.id,
            priority=0,
            notes=f"Import error: {str(e)}"
        )
        
        decision_trace = DecisionTrace(
            kb_searched=False,
            top_match_score=None,
            top_3_matches=[],
            similarity_threshold=SIMILARITY_THRESHOLD,
            passed_similarity_gate=False,
            passed_policy_gate=True,
            gating_decision="NEEDS_REVIEW",
            reason_code="import_error",
            queue_item_id=queue_item.id,
            model_metadata={'error': str(e)}
        )
        
        answer = (
            "Thank you for your question. There was a technical issue accessing our knowledge base, "
            "so your question has been submitted for review. We'll provide an answer soon."
        )
        
        bot_message = Message(
            conversation_id=conversation.id,
            role="assistant",
            content=answer,
            question_event_id=question_event.id
        )
        db.add(bot_message)
        db.commit()
        db.refresh(bot_message)
        
        return ChatResponse(
            answer=answer,
            decision_trace=decision_trace,
            session_id=session_id,
            message_id=bot_message.id
        )
    
    # 1. Triage the question (lightweight classification)
    triage = triage_question(request.question)
    
    # 2. If needs clarification, return clarifying question immediately
    if triage.needs_clarification and triage.recommended_action == "ASK_CLARIFY":
        # Create question event with triage info
        question_event = QuestionEvent(
            conversation_id=conversation.id,
            question_text=request.question,
            status=QuestionStatus.ANSWERED,  # Clarifying question is a form of answer
            intent_category=triage.intent_category,
            risk_level=triage.risk_level,
            needs_clarification=1,
            recommended_action=triage.recommended_action,
            triage_metadata={
                'confidence': triage.confidence,
                'reasoning': triage.reasoning
            }
        )
        db.add(question_event)
        db.commit()
        db.refresh(question_event)
        
        # Save clarifying question as assistant message
        assistant_message = Message(
            conversation_id=conversation.id,
            role="assistant",
            content=triage.clarifying_question,
            question_event_id=question_event.id
        )
        db.add(assistant_message)
        db.commit()
        db.refresh(assistant_message)
        
        # Return with decision trace
        decision_trace = DecisionTrace(
            triage=triage.model_dump(),
            kb_searched=False,
            similarity_threshold=SIMILARITY_THRESHOLD,
            passed_similarity_gate=False,
            passed_policy_gate=True,
            gating_decision="ASK_CLARIFY",
            model_metadata={'version': '1.0.0'}
        )
        
        return ChatResponse(
            answer=triage.clarifying_question,
            decision_trace=decision_trace,
            session_id=session_id,
            message_id=assistant_message.id
        )
    
    # 3. Search KB with fail-safe error handling
    best_match = None
    top_3_matches = []
    requested_state_info = None
    jurisdiction_mismatch = False
    state_filtered_count = 0
    error_fallback_used = False
    fallback_reason = None
    
    try:
        logger.info(f"[Q:{request.question[:80]}...] Starting KB search")
        best_match, top_3_matches, requested_state_info, jurisdiction_mismatch, state_filtered_count = kb_service.search_kb(
            request.question, top_k=3
        )
        logger.info(
            f"[Q:{request.question[:40]}...] KB search completed - "
            f"best_match: {best_match is not None}, "
            f"requested_state: {requested_state_info['code'] if requested_state_info else 'none'}, "
            f"jurisdiction_mismatch: {jurisdiction_mismatch}, "
            f"state_filtered_count: {state_filtered_count}"
        )
        
        # If state was requested but no KB match found, set fallback reason
        if requested_state_info and best_match is None and state_filtered_count == 0:
            fallback_reason = "no_state_specific_kb_match"
            logger.info(f"No KB entries found for state: {requested_state_info['code']}")
            
    except Exception as e:
        logger.error(f"KB search failed with exception: {e}", exc_info=True)
        # Fail-safe: treat as no match and continue
        best_match = None
        top_3_matches = []
        requested_state_info = None
        jurisdiction_mismatch = False
        state_filtered_count = 0
        error_fallback_used = True
        fallback_reason = "exception_fallback"
    
    # Prepare decision trace data
    top_match_score = best_match['score'] if best_match else None
    matched_entry_states = list(best_match['entry_states']) if best_match and best_match.get('entry_states') else None
    requested_states_list = [requested_state_info['code']] if requested_state_info else None
    kb_searched = True
    
    # 4. Apply gates
    passed_similarity_gate = False
    passed_policy_gate = True
    reason_code = None
    answer = ""
    queue_item_id = None
    
    # Check for jurisdiction mismatch first
    if jurisdiction_mismatch:
        # Jurisdiction mismatch - treat as no match
        passed_similarity_gate = False
        reason_code = ReasonCode.JURISDICTION_MISMATCH.value
        logger.info(
            f"[Q:{request.question[:40]}...] Jurisdiction mismatch: requested {requested_state_info['code'] if requested_state_info else 'unknown'}, "
            f"no compatible KB entry found"
        )
    # Check if we have any KB entries
    elif best_match is None:
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
    
    # 5. Determine final decision
    # CRITICAL FIX: Always prioritize KB matches over triage risk
    # If we found a confident match (exact or variant), return it immediately
    if passed_similarity_gate and passed_policy_gate:
        # Check if KB answer contains draft markers - if so, route to review
        if best_match and contains_draft_markers(best_match['answer']):
            logger.warning(f"KB match #{best_match['kb_id']} contains draft markers - routing to NEEDS_REVIEW")
            # Force NEEDS_REVIEW even though similarity was high
            answer = (
                "Thank you for your question. This query has been submitted for review "
                "by our compliance team. We'll update our knowledge base with the answer "
                "and it will be available for future queries."
            )
            question_status = QuestionStatus.NEEDS_REVIEW
            gating_decision = "NEEDS_REVIEW"
        else:
            # ANSWERED - return published KB answer
            answer = best_match['answer']
            question_status = QuestionStatus.ANSWERED
            gating_decision = "ANSWERED"
            logger.info(f"KB match found with score {top_match_score:.4f} - returning published answer")
    elif triage.risk_level == "high" or triage.recommended_action == "NEEDS_REVIEW":
        # High-risk questions go to review (only if no KB match exists)
        answer = (
            "Thank you for your question. Due to its complexity or urgency, this query has been "
            "prioritized for review by our compliance team. We'll provide a thorough answer shortly."
        )
        question_status = QuestionStatus.NEEDS_REVIEW
        gating_decision = "NEEDS_REVIEW"
    else:
        # NEEDS_REVIEW - create review queue item
        answer = (
            "Thank you for your question. This query has been submitted for review "
            "by our compliance team. We'll update our knowledge base with the answer "
            "and it will be available for future queries."
        )
        question_status = QuestionStatus.NEEDS_REVIEW
        gating_decision = "NEEDS_REVIEW"
    
    # 6. Create question event with triage info
    question_event = QuestionEvent(
        conversation_id=conversation.id,
        question_text=request.question,
        status=question_status,
        reason_code=reason_code,
        intent_category=triage.intent_category,
        risk_level=triage.risk_level,
        needs_clarification=0,
        recommended_action=triage.recommended_action,
        triage_metadata={
            'confidence': triage.confidence,
            'reasoning': triage.reasoning
        },
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
    
    # 7. If NEEDS_REVIEW, create review queue item
    reviewer_draft = None  # Will contain detailed markdown for admin review
    if question_status == QuestionStatus.NEEDS_REVIEW:
        # Generate enhanced draft with assumptions, references, and disclaimer
        draft_answer = generate_draft_answer(
            question=request.question,
            triage=triage,
            top_3_matches=top_3_matches
        )
        
        # Store draft for API response (for frontend to optionally display in admin views)
        reviewer_draft = draft_answer
        
        # Prepare draft metadata for reviewer context
        draft_metadata = {
            'triage': triage.model_dump(),
            'top_matches': [
                {
                    'kb_id': m['kb_id'],
                    'question': m['canonical_question'],
                    'score': m['score'],
                    'answer': m.get('answer', '')
                }
                for m in top_3_matches
            ],
            'similarity_threshold': SIMILARITY_THRESHOLD,
            'top_match_score': top_match_score,
            'reason_code': reason_code
        }
        
        # Set priority based on risk level
        priority = 0
        if triage.risk_level == "high":
            priority = 10
        elif triage.risk_level == "medium":
            priority = 5
        
        review_item = review_service.create_review_item(
            question_event_id=question_event.id,
            draft_answer=draft_answer,
            draft_metadata=draft_metadata,
            tags=["auto-generated", triage.intent_category, f"risk_{triage.risk_level}"],
            priority=priority
        )
        queue_item_id = review_item.id
    
    # 8. Save assistant message
    assistant_message = Message(
        conversation_id=conversation.id,
        role="assistant",
        content=answer,
        question_event_id=question_event.id
    )
    db.add(assistant_message)
    db.commit()
    db.refresh(assistant_message)
    
    # 9. Build decision trace with triage
    decision_trace = DecisionTrace(
        triage=triage.model_dump(),
        kb_searched=kb_searched,
        top_match_score=top_match_score,
        matched_text=best_match.get('matched_text') if best_match else None,
        matched_kb_entry_id=best_match.get('kb_id') if best_match else None,
        matched_variant_index=best_match.get('matched_variant_index') if best_match else None,
        top_3_matches=[
            {
                'kb_id': m['kb_id'],
                'canonical_question': m['canonical_question'],
                'score': round(m['score'], 4),
                'matched_text': m.get('matched_text', m['canonical_question'])
            }
            for m in top_3_matches
        ],
        similarity_threshold=SIMILARITY_THRESHOLD,
        passed_similarity_gate=passed_similarity_gate,
        passed_policy_gate=passed_policy_gate,
        gating_decision=gating_decision,
        reason_code=reason_code,
        queue_item_id=queue_item_id,
        requested_states=requested_states_list,
        matched_entry_states=matched_entry_states,
        jurisdiction_mismatch=jurisdiction_mismatch,
        model_metadata={
            'embedding_model': 'all-MiniLM-L6-v2',
            'kb_entry_count': len(kb_service.get_all_kb_entries()),
            'triage_version': '1.0.0',
            'version': '1.0.0',
            'error_fallback_used': error_fallback_used,
            'state_filtered_candidates_count': state_filtered_count,
            'fallback_reason': fallback_reason,
            'requested_state_info': requested_state_info
        }
    )
    
    # GUARD: Ensure answer never contains reviewer draft markdown
    if "DRAFT ANSWER" in answer or answer.startswith("**"):
        # Replace with short user-friendly message if draft leaked into answer
        answer = (
            "Thank you for your question. This query has been submitted for review "
            "by our compliance team. We'll update our knowledge base with the answer "
            "and it will be available for future queries."
        )
    
    return ChatResponse(
        answer=answer,
        decision_trace=decision_trace,
        session_id=session_id,
        message_id=assistant_message.id,
        reviewer_draft=reviewer_draft
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


@alias_router.get("/history/{session_id}")
async def get_chat_history_alias(
    session_id: str,
    db: Session = Depends(get_db)
):
    return await get_chat_history(session_id, db)
