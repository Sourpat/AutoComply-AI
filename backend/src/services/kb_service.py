# backend/src/services/kb_service.py
"""
Knowledge Base service for semantic similarity search and management.

Uses sentence-transformers for embeddings and cosine similarity for retrieval.
"""

from typing import List, Dict, Any, Optional, Tuple
from sqlalchemy.orm import Session
import numpy as np
from sentence_transformers import SentenceTransformer
import logging

from src.database.models import KBEntry

logger = logging.getLogger(__name__)

# Global model instance (lazy loaded)
_embedding_model: Optional[SentenceTransformer] = None

# Configuration
SIMILARITY_THRESHOLD = 0.78  # Configurable threshold for "confident" match
MODEL_NAME = "all-MiniLM-L6-v2"  # Fast, good quality model (384 dimensions)


def get_embedding_model() -> SentenceTransformer:
    """Get or initialize the sentence transformer model."""
    global _embedding_model
    if _embedding_model is None:
        logger.info(f"Loading sentence transformer model: {MODEL_NAME}")
        _embedding_model = SentenceTransformer(MODEL_NAME)
    return _embedding_model


def compute_embedding(text: str) -> List[float]:
    """Compute embedding vector for a text string."""
    model = get_embedding_model()
    embedding = model.encode(text, convert_to_numpy=True)
    return embedding.tolist()


def cosine_similarity(vec1: List[float], vec2: List[float]) -> float:
    """Compute cosine similarity between two vectors."""
    a = np.array(vec1)
    b = np.array(vec2)
    return float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b)))


class KBService:
    """Service for knowledge base operations."""

    def __init__(self, db: Session):
        self.db = db

    def search_kb(
        self, 
        question: str, 
        top_k: int = 3
    ) -> Tuple[Optional[Dict[str, Any]], List[Dict[str, Any]]]:
        """
        Search KB for similar questions.
        
        Returns:
            (best_match, top_3_matches)
            
            best_match: {
                'kb_id': int,
                'canonical_question': str,
                'answer': str,
                'score': float,
                'tags': List[str]
            } or None if no KB entries
            
            top_3_matches: List of up to 3 matches with scores
        """
        # Get all KB entries
        kb_entries = self.db.query(KBEntry).all()
        
        if not kb_entries:
            logger.info("No KB entries found")
            return None, []
        
        # Compute question embedding
        question_embedding = compute_embedding(question)
        
        # Compute similarities
        matches = []
        for entry in kb_entries:
            if entry.embedding:
                score = cosine_similarity(question_embedding, entry.embedding)
                matches.append({
                    'kb_id': entry.id,
                    'canonical_question': entry.canonical_question,
                    'answer': entry.answer,
                    'score': score,
                    'tags': entry.tags or []
                })
        
        # Sort by score descending
        matches.sort(key=lambda x: x['score'], reverse=True)
        
        # Get best match and top 3
        best_match = matches[0] if matches else None
        top_3_matches = matches[:top_k]
        
        logger.info(f"KB search for '{question[:50]}...' - Best score: {best_match['score'] if best_match else 'N/A'}")
        
        return best_match, top_3_matches

    def create_kb_entry(
        self,
        canonical_question: str,
        answer: str,
        tags: Optional[List[str]] = None,
        source: str = "manual"
    ) -> KBEntry:
        """Create a new KB entry with embedding."""
        embedding = compute_embedding(canonical_question)
        
        entry = KBEntry(
            canonical_question=canonical_question,
            answer=answer,
            embedding=embedding,
            tags=tags,
            source=source
        )
        
        self.db.add(entry)
        self.db.commit()
        self.db.refresh(entry)
        
        logger.info(f"Created KB entry {entry.id}: '{canonical_question[:50]}...'")
        return entry

    def update_kb_entry(
        self,
        kb_id: int,
        canonical_question: Optional[str] = None,
        answer: Optional[str] = None,
        tags: Optional[List[str]] = None
    ) -> Optional[KBEntry]:
        """Update an existing KB entry."""
        entry = self.db.query(KBEntry).filter(KBEntry.id == kb_id).first()
        
        if not entry:
            return None
        
        if canonical_question is not None:
            entry.canonical_question = canonical_question
            entry.embedding = compute_embedding(canonical_question)
        
        if answer is not None:
            entry.answer = answer
        
        if tags is not None:
            entry.tags = tags
        
        entry.version += 1
        
        self.db.commit()
        self.db.refresh(entry)
        
        logger.info(f"Updated KB entry {entry.id}")
        return entry

    def delete_kb_entry(self, kb_id: int) -> bool:
        """Delete a KB entry."""
        entry = self.db.query(KBEntry).filter(KBEntry.id == kb_id).first()
        
        if not entry:
            return False
        
        self.db.delete(entry)
        self.db.commit()
        
        logger.info(f"Deleted KB entry {kb_id}")
        return True

    def get_all_kb_entries(self, limit: int = 100, offset: int = 0) -> List[KBEntry]:
        """Get all KB entries with pagination."""
        return self.db.query(KBEntry).offset(offset).limit(limit).all()

    def get_kb_entry(self, kb_id: int) -> Optional[KBEntry]:
        """Get a specific KB entry by ID."""
        return self.db.query(KBEntry).filter(KBEntry.id == kb_id).first()
