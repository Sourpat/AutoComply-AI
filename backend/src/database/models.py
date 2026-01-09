# backend/src/database/models.py
"""
SQLAlchemy models for the Learn After First Unknown feature.

Tables:
- Conversation: Chat conversation tracking
- Message: Individual messages in a conversation
- QuestionEvent: Tracks questions and whether they need review
- ReviewQueueItem: Human review queue for unknown questions
- KBEntry: Knowledge base entries (canonical Q&A)
"""

from datetime import datetime
from sqlalchemy import (
    Column,
    Integer,
    String,
    Text,
    Float,
    DateTime,
    ForeignKey,
    JSON,
    Enum as SQLEnum,
)
from sqlalchemy.orm import relationship
import enum

from src.database.connection import Base


# ============================================================================
# Enums
# ============================================================================

class QuestionStatus(str, enum.Enum):
    """Status of a question event."""
    ANSWERED = "answered"  # Successfully answered from KB
    NEEDS_REVIEW = "needs_review"  # Below threshold or policy gate triggered


class ReviewStatus(str, enum.Enum):
    """Status of a review queue item."""
    OPEN = "open"  # Awaiting assignment
    IN_REVIEW = "in_review"  # Assigned to reviewer
    APPROVED = "approved"  # Approved but not yet published
    PUBLISHED = "published"  # Published to KB


class ReasonCode(str, enum.Enum):
    """Reason codes for NEEDS_REVIEW."""
    LOW_SIMILARITY = "low_similarity"  # Below similarity threshold
    POLICY_GATE = "policy_gate"  # Triggered policy safety gate
    NO_KB_MATCH = "no_kb_match"  # No KB entries exist yet
    JURISDICTION_MISMATCH = "jurisdiction_mismatch"  # State in question doesn't match KB entry states
    RAG_DISABLED = "rag_disabled"  # RAG features disabled in production
    IMPORT_ERROR = "import_error"  # Failed to import RAG dependencies
    INTERNAL_ERROR = "internal_error"  # Exception caught during processing


# ============================================================================
# Models
# ============================================================================

class Conversation(Base):
    """A chat conversation session."""
    __tablename__ = "conversations"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String(255), unique=True, index=True, nullable=False)
    user_id = Column(String(255), nullable=True)  # Optional user tracking
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    messages = relationship("Message", back_populates="conversation", cascade="all, delete-orphan")
    question_events = relationship("QuestionEvent", back_populates="conversation", cascade="all, delete-orphan")


class Message(Base):
    """Individual message in a conversation."""
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, index=True)
    conversation_id = Column(Integer, ForeignKey("conversations.id"), nullable=False)
    role = Column(String(50), nullable=False)  # 'user' or 'assistant'
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    # Link to question event if this was a question
    question_event_id = Column(Integer, ForeignKey("question_events.id"), nullable=True)

    # Relationships
    conversation = relationship("Conversation", back_populates="messages")
    question_event = relationship("QuestionEvent", back_populates="messages")


class QuestionEvent(Base):
    """Tracks each question asked and whether it needed review."""
    __tablename__ = "question_events"

    id = Column(Integer, primary_key=True, index=True)
    conversation_id = Column(Integer, ForeignKey("conversations.id"), nullable=False)
    question_text = Column(Text, nullable=False)
    status = Column(SQLEnum(QuestionStatus), nullable=False, index=True)
    reason_code = Column(SQLEnum(ReasonCode), nullable=True)
    
    # Triage results (lightweight classification before retrieval)
    intent_category = Column(String(100), nullable=True)  # 'license_inquiry', 'csf_question', etc.
    risk_level = Column(String(50), nullable=True)  # 'low', 'medium', 'high'
    needs_clarification = Column(Integer, default=0)  # Boolean: 1=needs clarification
    recommended_action = Column(String(50), nullable=True)  # 'ANSWER', 'ASK_CLARIFY', 'NEEDS_REVIEW', 'BLOCK'
    triage_metadata = Column(JSON, nullable=True)  # Additional triage details
    
    # KB retrieval info
    top_match_score = Column(Float, nullable=True)  # Similarity score of best match
    top_match_kb_id = Column(Integer, ForeignKey("kb_entries.id"), nullable=True)
    top_3_matches = Column(JSON, nullable=True)  # Array of {kb_id, score, question}
    
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    conversation = relationship("Conversation", back_populates="question_events")
    messages = relationship("Message", back_populates="question_event")
    review_queue_item = relationship("ReviewQueueItem", back_populates="question_event", uselist=False)
    top_match_kb_entry = relationship("KBEntry", foreign_keys=[top_match_kb_id])


class ReviewQueueItem(Base):
    """Human review queue for questions that need attention."""
    __tablename__ = "review_queue_items"

    id = Column(Integer, primary_key=True, index=True)
    question_event_id = Column(Integer, ForeignKey("question_events.id"), nullable=False, unique=True)
    
    status = Column(SQLEnum(ReviewStatus), nullable=False, default=ReviewStatus.OPEN, index=True)
    
    # Review workflow
    draft_answer = Column(Text, nullable=True)  # AI-generated draft (marked as draft)
    draft_metadata = Column(JSON, nullable=True)  # Draft context: top_matches, scores, triage
    final_answer = Column(Text, nullable=True)  # Human-approved answer
    assigned_to = Column(String(255), nullable=True)  # Reviewer username/email
    
    # Metadata
    tags = Column(JSON, nullable=True)  # Array of tags for categorization
    priority = Column(Integer, default=0)  # Higher = more urgent
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    assigned_at = Column(DateTime, nullable=True)
    approved_at = Column(DateTime, nullable=True)
    published_at = Column(DateTime, nullable=True)
    
    # Link to published KB entry
    published_kb_id = Column(Integer, ForeignKey("kb_entries.id"), nullable=True)

    # Relationships
    question_event = relationship("QuestionEvent", back_populates="review_queue_item")
    published_kb_entry = relationship("KBEntry", foreign_keys=[published_kb_id])


class KBEntry(Base):
    """Knowledge base entry (canonical question + answer)."""
    __tablename__ = "kb_entries"

    id = Column(Integer, primary_key=True, index=True)
    
    canonical_question = Column(Text, nullable=False)
    answer = Column(Text, nullable=False)
    
    # Question variants for improved matching
    question_variants = Column(JSON, nullable=True)  # Array of paraphrased variants
    
    # Metadata
    tags = Column(JSON, nullable=True)  # Array of tags
    source = Column(String(255), nullable=True)  # 'manual', 'review_queue', 'import'
    version = Column(Integer, default=1)  # For versioning answers
    
    # Embedding for similarity search (stored as JSON array)
    embedding = Column(JSON, nullable=True)
    variant_embeddings = Column(JSON, nullable=True)  # Array of embeddings for variants
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    review_queue_items = relationship("ReviewQueueItem", foreign_keys=[ReviewQueueItem.published_kb_id], back_populates="published_kb_entry")
