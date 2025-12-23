# backend/scripts/seed_kb.py
"""
Quick script to seed the knowledge base with sample questions.
Run this after starting the backend to populate initial data for testing.
"""

import sys
from pathlib import Path

# Add backend/src to path
backend_src = Path(__file__).parent.parent / "src"
sys.path.insert(0, str(backend_src))

from database.connection import SessionLocal, init_db
from services.kb_service import KBService


def seed_knowledge_base():
    """Seed the KB with sample compliance questions."""
    
    # Initialize database
    print("Initializing database...")
    init_db()
    
    db = SessionLocal()
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
    
    print(f"\nSeeding {len(sample_entries)} knowledge base entries...")
    created = 0
    
    for entry in sample_entries:
        try:
            kb_entry = kb_service.create_kb_entry(
                canonical_question=entry["canonical_question"],
                answer=entry["answer"],
                tags=entry.get("tags", []),
                source="seed"
            )
            print(f"✓ Created KB entry {kb_entry.id}: {entry['canonical_question'][:60]}...")
            created += 1
        except Exception as e:
            print(f"✗ Failed to create entry: {e}")
    
    db.close()
    
    print(f"\n✓ Successfully seeded {created} KB entries!")
    print("\nYou can now:")
    print("1. Navigate to http://localhost:5173/chat")
    print("2. Try asking one of the seeded questions")
    print("3. Or ask a new question to see the review queue workflow\n")


if __name__ == "__main__":
    seed_knowledge_base()
