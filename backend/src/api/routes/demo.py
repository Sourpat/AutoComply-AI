# backend/src/api/routes/demo.py
"""
Demo endpoints for resetting and reseeding the database for demonstrations.

ADMIN ONLY - These endpoints clear and reset data.

RAG DEPENDENCY: Reset endpoint uses KB seeding which requires RAG features.
Returns 501 if RAG is disabled.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Dict
import logging

from src.database.connection import get_db
from src.config import get_settings
from src.database.models import (
    KBEntry,
    QuestionEvent,
    ReviewQueueItem,
    Message,
    Conversation
)

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/v1/demo",
    tags=["demo"],
)


def check_rag_enabled():
    """Raise 501 if RAG features are disabled."""
    settings = get_settings()
    if not settings.rag_enabled:
        raise HTTPException(
            status_code=501,
            detail="RAG features are disabled. Demo reset endpoint requires RAG_ENABLED=true and ML dependencies (sentence-transformers)."
        )


@router.post("/reset")
async def reset_demo(db: Session = Depends(get_db)) -> Dict[str, str]:
    """
    Reset demo database to clean state and reseed KB.
    
    ADMIN ONLY endpoint for portfolio demonstrations.
    Requires RAG features enabled (RAG_ENABLED=true).
    
    Workflow:
    1. Delete all question events and review queue items
    2. Delete all messages and conversations
    3. Delete all KB entries
    4. Reseed KB with demo questions (including state-specific ones)
    
    Returns:
        Status message with counts of deleted and created items
    """
    check_rag_enabled()
    
    # Lazy import to avoid import errors when RAG disabled
    from src.services.kb_service import KBService
    
    try:
        logger.info("Starting demo reset...")
        
        # 1. Delete review queue items first (has FK to question_events)
        review_count = db.query(ReviewQueueItem).delete()
        logger.info(f"Deleted {review_count} review queue items")
        
        # 2. Delete messages (has FK to conversations and question_events)
        message_count = db.query(Message).delete()
        logger.info(f"Deleted {message_count} messages")
        
        # 3. Delete question events (has FK to conversations)
        event_count = db.query(QuestionEvent).delete()
        logger.info(f"Deleted {event_count} question events")
        
        # 4. Delete conversations
        conv_count = db.query(Conversation).delete()
        logger.info(f"Deleted {conv_count} conversations")
        
        # 5. Delete KB entries
        kb_count = db.query(KBEntry).delete()
        logger.info(f"Deleted {kb_count} KB entries")
        
        db.commit()
        
        # 6. Reseed KB with demo data
        kb_service = KBService(db)
        seeded_count = await _reseed_kb(kb_service, db)
        
        logger.info(f"Demo reset completed successfully. Seeded {seeded_count} KB entries.")
        
        return {
            "status": "success",
            "message": f"Demo reset completed. Deleted {kb_count} KB entries, {event_count} events, {review_count} review items. Seeded {seeded_count} new KB entries.",
            "deleted": {
                "kb_entries": kb_count,
                "question_events": event_count,
                "review_items": review_count,
                "messages": message_count,
                "conversations": conv_count
            },
            "seeded": {
                "kb_entries": seeded_count
            }
        }
        
    except Exception as e:
        logger.error(f"Demo reset failed: {e}", exc_info=True)
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Demo reset failed: {str(e)}"
        )


async def _reseed_kb(kb_service, db: Session) -> int:
    """
    Reseed KB with demo data including state-specific questions.
    
    Returns:
        Number of KB entries created
    """
    sample_entries = [
        {
            "canonical_question": "What is a Schedule II drug?",
            "answer": "Schedule II drugs are controlled substances with high potential for abuse, which may lead to severe psychological or physical dependence. Examples include:\n\n- Opioids: oxycodone, hydrocodone, morphine, fentanyl\n- Stimulants: amphetamine, methylphenidate (Ritalin)\n- Other: cocaine (for medical use)\n\nSchedule II drugs:\n- Require written prescriptions (with some exceptions)\n- Cannot be refilled (new prescription needed each time)\n- Require DEA registration to prescribe or dispense\n- Must be stored securely and inventoried regularly",
            "tags": ["schedule-ii", "controlled-substances", "dea", "general"],
            "auto_generate_variants": True
        },
        {
            "canonical_question": "What are Schedule IV shipping rules for New Jersey?",
            "answer": "For Schedule IV controlled substances shipping to New Jersey:\n\n1. **DEA Registration**: Valid DEA registration with Schedule IV authorization required\n2. **NJ State License**: New Jersey pharmacy or practitioner license must be current\n3. **Shipping Documentation**: Proper manifests and records for all Schedule IV shipments\n4. **Storage Requirements**: Secure storage and handling per NJ regulations\n5. **Record Keeping**: Detailed inventory and transaction records required\n\nNew Jersey has specific attestation requirements for certain Schedule IV substances. All shipments must comply with both federal DEA regulations and New Jersey state pharmacy laws.",
            "tags": ["schedule-iv", "new-jersey", "nj", "shipping", "controlled-substances"],
            "question_variants": [
                "What are the rules for shipping Schedule IV drugs to New Jersey?",
                "NJ Schedule IV shipping requirements",
                "How do I ship Schedule 4 controlled substances to NJ?"
            ]
        },
        {
            "canonical_question": "What are Schedule IV shipping rules for California?",
            "answer": "For Schedule IV controlled substances shipping to California:\n\n1. **DEA Registration**: Valid DEA registration with Schedule IV authorization required\n2. **CA State License**: California pharmacy license (or wholesaler license) must be active\n3. **CURES Reporting**: Schedule IV shipments must be reported to California's CURES database\n4. **Shipping Security**: Enhanced security measures for Schedule IV shipments\n5. **Documentation**: Comprehensive manifests and chain-of-custody records\n\nCalifornia has stricter requirements than many states, including mandatory electronic reporting and additional security protocols for Schedule IV substances.",
            "tags": ["schedule-iv", "california", "ca", "shipping", "controlled-substances", "cures"],
            "question_variants": [
                "What are the rules for shipping Schedule IV drugs to California?",
                "CA Schedule IV shipping requirements",
                "How do I ship Schedule 4 controlled substances to CA?"
            ]
        },
        {
            "canonical_question": "What are the requirements for Schedule II controlled substances in Florida?",
            "answer": "In Florida, Schedule II controlled substances require:\n\n1. Valid DEA registration with Schedule II authorization\n2. Florida state pharmacy or practitioner license\n3. Electronic prescription requirement (with limited exceptions)\n4. Secure storage and handling procedures per Florida statutes\n5. Detailed record-keeping and inventory controls\n6. PDMP (Prescription Drug Monitoring Program) compliance\n\nFlorida has some of the strictest Schedule II regulations in the nation, particularly for opioids. Additional attestations may be required for high-risk medications.",
            "tags": ["florida", "fl", "schedule-ii", "controlled-substances", "requirements"]
        },
        {
            "canonical_question": "What is the difference between hospital CSF and practitioner CSF?",
            "answer": "Hospital CSF (Controlled Substance Form) and Practitioner CSF differ in several ways:\n\n**Hospital CSF:**\n- Used for institutional pharmacies\n- Covers multiple practitioners\n- Requires facility DEA registration\n- Subject to institutional storage requirements\n\n**Practitioner CSF:**\n- Used for individual prescribers\n- Covers single practitioner's prescriptions\n- Requires individual DEA registration\n- Different attestation requirements by state",
            "tags": ["csf", "hospital", "practitioner", "comparison", "general"]
        },
        {
            "canonical_question": "What is Ohio TDDD and when is it required?",
            "answer": "Ohio TDDD (Terminal Distributor of Dangerous Drugs) is a state license required in Ohio for:\n\n1. Any entity that receives and distributes dangerous drugs (including controlled substances)\n2. Pharmacies operating in Ohio\n3. Facilities shipping controlled substances into Ohio\n\nKey requirements:\n- Valid Ohio TDDD license number\n- License must be current and not expired\n- Must match the ship-to state of Ohio\n- Additional attestations may be required for out-of-state shippers",
            "tags": ["ohio", "oh", "tddd", "license", "requirements"]
        },
        {
            "canonical_question": "How does AutoComply AI handle manual review cases?",
            "answer": "AutoComply AI routes cases to manual review when:\n\n1. **Missing critical information** - Required fields like DEA number or license number are missing\n2. **High-risk scenarios** - Schedule II drugs to certain states, expired licenses, or regulatory flags\n3. **Policy gates** - Cases that trigger compliance policy rules\n4. **Unknown questions** - Questions not yet in the knowledge base\n\nManual review cases are:\n- Flagged with a clear reason code\n- Queued for compliance team review\n- Include all context needed for human decision-making\n- Can be approved, rejected, or sent back for more information",
            "tags": ["manual-review", "workflow", "compliance", "general"]
        },
        {
            "canonical_question": "What is the similarity threshold for chatbot answers?",
            "answer": "The AutoComply AI chatbot uses a similarity threshold of 78% (0.78) by default for answering questions from the knowledge base.\n\n**How it works:**\n- Questions are converted to embeddings using sentence-transformers\n- Similarity scores are calculated against all KB entries\n- Scores >= 78% are considered confident matches and answered immediately\n- Scores < 78% are routed to human review\n- Jurisdiction filtering is applied when states are mentioned\n\nThis threshold can be configured in `backend/src/services/kb_service.py`",
            "tags": ["chatbot", "similarity", "threshold", "kb", "general"]
        }
    ]
    
    created_count = 0
    for entry_data in sample_entries:
        try:
            kb_entry = kb_service.create_kb_entry(
                canonical_question=entry_data["canonical_question"],
                answer=entry_data["answer"],
                tags=entry_data.get("tags", []),
                source="demo_seed",
                question_variants=entry_data.get("question_variants"),
                auto_generate_variants=entry_data.get("auto_generate_variants", False)
            )
            logger.info(f"Created KB entry {kb_entry.id}: {entry_data['canonical_question'][:60]}...")
            created_count += 1
        except Exception as e:
            logger.error(f"Failed to create KB entry: {e}")
    
    return created_count
