# backend/src/api/routes/kb_admin.py
"""
KB Admin endpoints for seeding and managing knowledge base entries.

SECURITY: All endpoints require admin role via X-User-Role header.

RAG DEPENDENCY: These endpoints require RAG features (sentence-transformers, embeddings).
Returns 501 Not Implemented if RAG is disabled in production.
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from sqlalchemy.orm import Session

from src.database.connection import get_db
from src.config import get_settings
from src.api.dependencies.auth import require_admin_role

router = APIRouter(
    prefix="/api/v1/admin/kb",
    tags=["admin", "kb"],
    dependencies=[Depends(require_admin_role)],  # All endpoints require admin role
)


class CreateKBRequest(BaseModel):
    canonical_question: str
    answer: str
    tags: Optional[List[str]] = None


def check_rag_enabled():
    """Raise 501 if RAG features are disabled."""
    settings = get_settings()
    if not settings.rag_enabled:
        raise HTTPException(
            status_code=501,
            detail="RAG features are disabled. KB admin endpoints require RAG_ENABLED=true and ML dependencies (sentence-transformers, openai)."
        )


@router.post("/seed")
async def seed_kb(db: Session = Depends(get_db)):
    """
    Seed the knowledge base with sample compliance questions.
    Useful for testing and demos.
    
    Requires RAG features enabled (RAG_ENABLED=true).
    """
    check_rag_enabled()
    
    # Lazy import to avoid import errors when RAG disabled
    from src.services.kb_service import KBService
    
    kb_service = KBService(db)
    
    sample_entries = [
        {
            "canonical_question": "What are the requirements for Schedule II controlled substances in Florida?",
            "answer": "In Florida, Schedule II controlled substances require:\n1. Valid DEA registration with Schedule II authorization\n2. Florida state pharmacy or practitioner license\n3. Proper prescription documentation\n4. Secure storage and handling procedures\n5. Detailed record-keeping per Florida statutes\n\nFor practitioners, additional Florida-specific attestations may be required for certain high-risk medications.",
            "tags": ["florida", "schedule-ii", "controlled-substances", "requirements"]
        },
        {
            "canonical_question": "What is the difference between hospital CSF and practitioner CSF?",
            "answer": "Hospital CSF (Controlled Substance Form) and Practitioner CSF differ in several ways:\n\n**Hospital CSF:**\n- Used for institutional pharmacies\n- Covers multiple practitioners\n- Requires facility DEA registration\n- Subject to institutional storage requirements\n\n**Practitioner CSF:**\n- Used for individual prescribers\n- Covers single practitioner's prescriptions\n- Requires individual DEA registration\n- Different attestation requirements by state",
            "tags": ["csf", "hospital", "practitioner", "comparison"]
        },
        {
            "canonical_question": "What is Ohio TDDD and when is it required?",
            "answer": "Ohio TDDD (Terminal Distributor of Dangerous Drugs) is a state license required in Ohio for:\n\n1. Any entity that receives and distributes dangerous drugs (including controlled substances)\n2. Pharmacies operating in Ohio\n3. Facilities shipping controlled substances into Ohio\n\nKey requirements:\n- Valid Ohio TDDD license number\n- License must be current and not expired\n- Must match the ship-to state of Ohio\n- Additional attestations may be required for out-of-state shippers",
            "tags": ["ohio", "tddd", "license", "requirements"]
        },
        {
            "canonical_question": "How does AutoComply AI handle manual review cases?",
            "answer": "AutoComply AI routes cases to manual review when:\n\n1. **Missing critical information** - Required fields like DEA number or license number are missing\n2. **High-risk scenarios** - Schedule II drugs to certain states, expired licenses, or regulatory flags\n3. **Policy gates** - Cases that trigger compliance policy rules\n\nManual review cases are:\n- Flagged with a clear reason code\n- Queued for compliance team review\n- Include all context needed for human decision-making\n- Can be approved, rejected, or sent back for more information",
            "tags": ["manual-review", "workflow", "compliance"]
        },
        {
            "canonical_question": "What is the similarity threshold for chatbot answers?",
            "answer": "The AutoComply AI chatbot uses a similarity threshold of 78% (0.78) by default for answering questions from the knowledge base.\n\n**How it works:**\n- Questions are converted to embeddings using sentence-transformers\n- Similarity scores are calculated against all KB entries\n- Scores >= 78% are considered confident matches and answered immediately\n- Scores < 78% are routed to human review\n\nThis threshold can be configured in `backend/src/services/kb_service.py`",
            "tags": ["chatbot", "similarity", "threshold", "kb"]
        }
    ]
    
    created = []
    for entry in sample_entries:
        # Check if already exists
        existing = db.query(db.query(KBService(db).get_all_kb_entries()).filter(
            lambda e: e.canonical_question == entry["canonical_question"]
        ).first())
        
        if not existing:
            kb_entry = kb_service.create_kb_entry(
                canonical_question=entry["canonical_question"],
                answer=entry["answer"],
                tags=entry.get("tags", []),
                source="seed"
            )
            created.append({
                "id": kb_entry.id,
                "question": kb_entry.canonical_question
            })
    
    return {
        "success": True,
        "created_count": len(created),
        "created_entries": created,
        "message": f"Seeded {len(created)} KB entries"
    }


@router.post("/entries")
async def create_kb_entry(
    request: CreateKBRequest,
    db: Session = Depends(get_db)
):
    """
    Create a new KB entry manually.
    
    Requires RAG features enabled (RAG_ENABLED=true).
    """
    check_rag_enabled()
    
    # Lazy import to avoid import errors when RAG disabled
    from src.services.kb_service import KBService
    
    kb_service = KBService(db)
    
    kb_entry = kb_service.create_kb_entry(
        canonical_question=request.canonical_question,
        answer=request.answer,
        tags=request.tags,
        source="manual"
    )
    
    return {
        "success": True,
        "kb_id": kb_entry.id,
        "canonical_question": kb_entry.canonical_question
    }


@router.get("/entries")
async def list_kb_entries(
    limit: int = 100,
    offset: int = 0,
    db: Session = Depends(get_db)
):
    """
    List all KB entries.
    
    Requires RAG features enabled (RAG_ENABLED=true).
    """
    check_rag_enabled()
    
    # Lazy import to avoid import errors when RAG disabled
    from src.services.kb_service import KBService
    
    kb_service = KBService(db)
    entries = kb_service.get_all_kb_entries(limit=limit, offset=offset)
    
    return {
        "total": len(entries),
        "entries": [
            {
                "id": e.id,
                "canonical_question": e.canonical_question,
                "answer": e.answer,
                "tags": e.tags,
                "source": e.source,
                "created_at": e.created_at.isoformat()
            }
            for e in entries
        ]
    }


@router.delete("/entries/{kb_id}")
async def delete_kb_entry(
    kb_id: int,
    db: Session = Depends(get_db)
):
    """
    Delete a KB entry.
    
    Requires RAG features enabled (RAG_ENABLED=true).
    """
    check_rag_enabled()
    
    # Lazy import to avoid import errors when RAG disabled
    from src.services.kb_service import KBService
    
    kb_service = KBService(db)
    success = kb_service.delete_kb_entry(kb_id)
    
    if not success:
        raise HTTPException(status_code=404, detail="KB entry not found")
    
    return {
        "success": True,
        "message": f"Deleted KB entry {kb_id}"
    }
