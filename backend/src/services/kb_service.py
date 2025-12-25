# backend/src/services/kb_service.py
"""
Knowledge Base service for semantic similarity search and management.

Uses sentence-transformers for embeddings and cosine similarity for retrieval.
"""

from typing import List, Dict, Any, Optional, Tuple, Set
from sqlalchemy.orm import Session
import numpy as np
from sentence_transformers import SentenceTransformer
import logging

from src.database.models import KBEntry
from src.services.jurisdiction import extract_states, has_jurisdiction_mismatch, detect_requested_state

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


def generate_question_variants(question: str) -> List[str]:
    """
    Generate 3-5 paraphrased variants of a question using rule-based approach.
    
    Simple deterministic rules:
    - Synonym substitutions (license/registration, DEA/Drug Enforcement Administration)
    - Word reordering
    - Add common locale qualifiers (state, Ohio, etc.)
    - Remove question marks and capitalize differently
    
    For production: could optionally call OpenAI API if key is available.
    """
    variants = []
    question_lower = question.lower().strip()
    
    # Rule 1: Synonym substitutions
    synonym_map = {
        'license': 'registration',
        'registration': 'license',
        'dea': 'drug enforcement administration',
        'drug enforcement administration': 'dea',
        'controlled substance': 'scheduled drug',
        'scheduled drug': 'controlled substance',
        'pharmacy': 'pharmacist',
        'pharmacist': 'pharmacy',
        'obtain': 'get',
        'get': 'obtain',
        'apply for': 'register for',
        'register for': 'apply for',
    }
    
    for original, synonym in synonym_map.items():
        if original in question_lower:
            variant = question_lower.replace(original, synonym)
            if variant != question_lower and variant not in variants:
                # Capitalize first letter
                variant = variant[0].upper() + variant[1:] if variant else variant
                variants.append(variant)
    
    # Rule 2: Add state context if not present
    states = ['ohio', 'california', 'new york', 'texas', 'florida']
    has_state = any(state in question_lower for state in states)
    
    if not has_state and len(variants) < 5:
        # Add a variant with "in [state]"
        for state in ['Ohio', 'a state']:
            variant = question.replace('?', f' in {state}?')
            if variant not in variants and variant != question:
                variants.append(variant)
                if len(variants) >= 5:
                    break
    
    # Rule 3: Reorder if question starts with "How do I"
    if question_lower.startswith('how do i'):
        rest = question[8:].strip()
        variant = f"What is the process to {rest}"
        if variant not in variants:
            variants.append(variant)
    
    if question_lower.startswith('what is'):
        rest = question[7:].strip()
        variant = f"How do I learn about {rest}"
        if variant not in variants:
            variants.append(variant)
    
    # Rule 4: Add "for a pharmacy" or "for a hospital" if relevant
    if any(kw in question_lower for kw in ['license', 'registration', 'csf', 'controlled']):
        if 'pharmacy' not in question_lower and 'hospital' not in question_lower:
            variant = question.replace('?', ' for a pharmacy?')
            if variant not in variants and len(variants) < 5:
                variants.append(variant)
    
    # Limit to 5 variants
    return variants[:5]


class KBService:
    """Service for knowledge base operations."""

    def __init__(self, db: Session):
        self.db = db

    def search_kb(
        self, 
        question: str, 
        top_k: int = 3
    ) -> Tuple[Optional[Dict[str, Any]], List[Dict[str, Any]], Optional[dict], bool, int]:
        """
        Search KB for similar questions (canonical + variants) with jurisdiction filtering.
        
        Returns:
            (best_match, top_3_matches, requested_state_info, jurisdiction_mismatch, state_filtered_count)
            
            best_match: {
                'kb_id': int,
                'canonical_question': str,
                'answer': str,
                'score': float,
                'tags': List[str],
                'matched_text': str,
                'matched_variant_index': Optional[int],
                'entry_states': Set[str]
            } or None if no match
            
            top_3_matches: List of up to 3 matches with scores
            requested_state_info: {"code": "RI", "name": "rhode island"} or None
            jurisdiction_mismatch: True if best match was rejected due to state mismatch
            state_filtered_count: Number of candidates after state filtering
        """
        # Get all KB entries
        kb_entries = self.db.query(KBEntry).all()
        
        if not kb_entries:
            logger.info("No KB entries found")
            return None, [], None, False, 0
        
        # Detect requested state from user question
        requested_state_info = detect_requested_state(question)
        requested_states = extract_states(question)
        
        if requested_state_info:
            logger.info(f"Requested state: {requested_state_info['code']} ({requested_state_info['name']})")
        
        # Compute question embedding
        question_embedding = compute_embedding(question)
        
        # Compute similarities against canonical + variants
        matches = []
        for entry in kb_entries:
            # Extract states from KB entry (canonical + variants + answer)
            entry_text = entry.canonical_question + " " + entry.answer
            if entry.question_variants:
                entry_text += " " + " ".join(entry.question_variants)
            entry_states = extract_states(entry_text)
            
            best_score = 0.0
            matched_text = entry.canonical_question
            matched_variant_index = None
            
            # Check canonical question
            if entry.embedding:
                canonical_score = cosine_similarity(question_embedding, entry.embedding)
                if canonical_score > best_score:
                    best_score = canonical_score
                    matched_text = entry.canonical_question
                    matched_variant_index = None
            
            # Check variants
            if entry.question_variants and entry.variant_embeddings:
                for idx, (variant, variant_emb) in enumerate(zip(entry.question_variants, entry.variant_embeddings)):
                    variant_score = cosine_similarity(question_embedding, variant_emb)
                    if variant_score > best_score:
                        best_score = variant_score
                        matched_text = variant
                        matched_variant_index = idx
            
            matches.append({
                'kb_id': entry.id,
                'canonical_question': entry.canonical_question,
                'answer': entry.answer,
                'score': best_score,
                'tags': entry.tags or [],
                'matched_text': matched_text,
                'matched_variant_index': matched_variant_index,
                'entry_states': entry_states
            })
        
        # Sort by score descending
        matches.sort(key=lambda x: x['score'], reverse=True)
        
        # Track how many candidates we have after state filtering
        state_filtered_count = len(matches)
        
        # Safety check: if no matches after filtering, return empty results
        if not matches:
            logger.info(
                f"KB search for '{question[:50]}...' - No matches found after filtering. "
                f"Requested state: {requested_state_info['code'] if requested_state_info else 'none'}"
            )
            return None, [], requested_state_info, False, 0
        
        # Get best match and check for jurisdiction mismatch
        best_match = matches[0]
        jurisdiction_mismatch = False
        
        if best_match:
            # Check if there's a jurisdiction mismatch
            if has_jurisdiction_mismatch(requested_states, best_match['entry_states']):
                logger.warning(
                    f"Jurisdiction mismatch: Question states {requested_states}, "
                    f"Entry states {best_match['entry_states']} - rejecting match"
                )
                jurisdiction_mismatch = True
                best_match = None  # Treat as no match
        
        top_3_matches = matches[:top_k]
        
        if best_match:
            logger.info(
                f"KB search for '{question[:50]}...' - Best score: {best_match['score']:.4f}, "
                f"Entry states: {best_match.get('entry_states') or 'none'}, "
                f"State filtered candidates: {state_filtered_count}"
            )
        else:
            logger.info(
                f"KB search for '{question[:50]}...' - No match "
                f"(jurisdiction_mismatch={jurisdiction_mismatch}, state_filtered_count={state_filtered_count})"
            )
        
        return best_match, top_3_matches, requested_state_info, jurisdiction_mismatch, state_filtered_count

    def create_kb_entry(
        self,
        canonical_question: str,
        answer: str,
        tags: Optional[List[str]] = None,
        source: str = "manual",
        question_variants: Optional[List[str]] = None,
        auto_generate_variants: bool = False
    ) -> KBEntry:
        """Create a new KB entry with embedding and optional variants."""
        embedding = compute_embedding(canonical_question)
        
        # Generate or use provided variants
        variants = question_variants
        variant_embeddings = None
        
        if auto_generate_variants and not variants:
            variants = generate_question_variants(canonical_question)
        
        if variants:
            variant_embeddings = [compute_embedding(v) for v in variants]
        
        entry = KBEntry(
            canonical_question=canonical_question,
            answer=answer,
            embedding=embedding,
            question_variants=variants,
            variant_embeddings=variant_embeddings,
            tags=tags,
            source=source
        )
        
        self.db.add(entry)
        self.db.commit()
        self.db.refresh(entry)
        
        logger.info(f"Created KB entry {entry.id}: '{canonical_question[:50]}...' with {len(variants) if variants else 0} variants")
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
