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
    
    print(f"\nSeeding {len(sample_entries)} knowledge base entries...")
    created = 0
    
    for entry in sample_entries:
        try:
            kb_entry = kb_service.create_kb_entry(
                canonical_question=entry["canonical_question"],
                answer=entry["answer"],
                tags=entry.get("tags", []),
                source="seed",
                question_variants=entry.get("question_variants"),
                auto_generate_variants=entry.get("auto_generate_variants", False)
            )
            
            variants_info = ""
            if kb_entry.question_variants:
                variants_info = f" with {len(kb_entry.question_variants)} variants"
            
            print(f"✓ Created KB entry {kb_entry.id}: {entry['canonical_question'][:60]}...{variants_info}")
            
            # Show variants if generated
            if kb_entry.question_variants:
                for i, variant in enumerate(kb_entry.question_variants, 1):
                    print(f"  Variant {i}: {variant}")
            
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
