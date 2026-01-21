"""
Demo Data Seeding

Idempotent seeding of realistic demo workflow cases for Render deployment.
Automatically seeds data on startup when DEMO_SEED=1 and cases table is empty.
"""

import logging
from datetime import datetime, timedelta, timezone
from typing import List
import uuid

from app.workflow.repo import create_case, list_cases
from app.workflow.models import CaseCreateInput, EvidenceItem

logger = logging.getLogger(__name__)


def is_empty_workflow_db() -> bool:
    """
    Check if workflow cases table is empty.
    
    Returns:
        True if no cases exist, False otherwise
    """
    cases, total = list_cases(limit=1, offset=0)
    return total == 0


def seed_demo_data() -> int:
    """
    Seed demo workflow cases (idempotent).
    
    Creates a small set of realistic demo cases covering multiple decision types
    if the cases table is empty. Safe to run multiple times (no duplicates).
    
    Returns:
        Number of cases created (0 if already seeded)
        
    Example:
        >>> count = seed_demo_data()
        >>> print(f"Created {count} demo cases")
    """
    # Check if already seeded
    if not is_empty_workflow_db():
        logger.info("Demo data already exists - skipping seed")
        return 0
    
    logger.info("Seeding demo workflow cases...")
    
    now = datetime.now(timezone.utc)
    cases_created = 0
    
    # =========================================================================
    # Demo Case 1: CSF Practitioner - New Application
    # =========================================================================
    try:
        case1 = create_case(CaseCreateInput(
            decisionType="csf_practitioner",
            title="Dr. Sarah Chen - DEA Registration Application",
            summary="Initial DEA registration for Schedule II-V controlled substances. California practitioner license CA-MD-45782, expiration 2027-06-15.",
            evidence=[
                EvidenceItem(
                    id=str(uuid.uuid4()),
                    title="DEA Schedule II-V Authorization",
                    snippet="Practitioner authorized for Schedule II, III, IV, and V controlled substances under federal DEA regulations.",
                    citation="21 CFR 1301.13 - DEA Practitioner Registration",
                    sourceId="dea-regs-practitioner",
                    tags=["dea", "schedule-ii", "federal"],
                    metadata={},
                    includedInPacket=True
                ),
                EvidenceItem(
                    id=str(uuid.uuid4()),
                    title="California Practitioner License Requirements",
                    snippet="California requires valid medical license and DEA registration for prescribing controlled substances. License must be current and in good standing.",
                    citation="California Business and Professions Code § 2525",
                    sourceId="ca-bpc-2525",
                    tags=["california", "license", "state"],
                    metadata={},
                    includedInPacket=True
                ),
                EvidenceItem(
                    id=str(uuid.uuid4()),
                    title="CURES Reporting Requirement",
                    snippet="California requires enrollment in CURES 2.0 (Controlled Substance Utilization Review and Evaluation System) for all prescribers of Schedule II-IV drugs.",
                    citation="California Health and Safety Code § 11165.1",
                    sourceId="ca-hsc-11165",
                    tags=["california", "cures", "reporting"],
                    metadata={},
                    includedInPacket=False
                ),
            ],
            assignedTo="verifier@autocomply.ai",
            dueAt=now + timedelta(hours=48)
        ))
        cases_created += 1
        logger.info(f"✓ Created demo case: {case1.id} - {case1.title}")
    except Exception as e:
        logger.error(f"Failed to create demo case 1: {e}")
    
    # =========================================================================
    # Demo Case 2: CSF Facility - Renewal
    # =========================================================================
    try:
        case2 = create_case(CaseCreateInput(
            decisionType="csf_facility",
            title="Bright Hope Pharmacy - Facility License Renewal",
            summary="Annual facility license renewal for retail pharmacy. DEA registration expires 2026-03-15, requires renewal verification.",
            evidence=[
                EvidenceItem(
                    id=str(uuid.uuid4()),
                    title="DEA Facility Registration Requirements",
                    snippet="Pharmacies must maintain current DEA registration (Form 224) for dispensing controlled substances. Renewal required every 3 years.",
                    citation="21 CFR 1301.13 - DEA Facility Registration",
                    sourceId="dea-regs-facility",
                    tags=["dea", "facility", "renewal"],
                    metadata={},
                    includedInPacket=True
                ),
                EvidenceItem(
                    id=str(uuid.uuid4()),
                    title="State Pharmacy License Requirements",
                    snippet="State pharmacy licenses must be renewed annually or biennially depending on jurisdiction. License expiration dates must be tracked.",
                    citation="Model State Pharmacy Act § 104",
                    sourceId="nabp-model-act",
                    tags=["state", "pharmacy", "license"],
                    metadata={},
                    includedInPacket=True
                ),
            ],
            assignedTo="reviewer@autocomply.ai",
            dueAt=now + timedelta(hours=72)
        ))
        cases_created += 1
        logger.info(f"✓ Created demo case: {case2.id} - {case2.title}")
    except Exception as e:
        logger.error(f"Failed to create demo case 2: {e}")
    
    # =========================================================================
    # Demo Case 3: Ohio TDDD - New License
    # =========================================================================
    try:
        case3 = create_case(CaseCreateInput(
            decisionType="ohio_tddd",
            title="MedSupply Corp - Ohio TDDD Application",
            summary="New Terminal Distributor of Dangerous Drugs license application for Ohio operations. Wholesale distributor expanding to OH market.",
            evidence=[
                EvidenceItem(
                    id=str(uuid.uuid4()),
                    title="Ohio TDDD License Requirement",
                    snippet="Any entity distributing dangerous drugs (including controlled substances) in Ohio must obtain a Terminal Distributor of Dangerous Drugs (TDDD) license.",
                    citation="Ohio Revised Code § 4729.51",
                    sourceId="ohio-rc-4729-51",
                    tags=["ohio", "tddd", "license"],
                    metadata={},
                    includedInPacket=True
                ),
                EvidenceItem(
                    id=str(uuid.uuid4()),
                    title="Ohio TDDD Application Requirements",
                    snippet="TDDD applications require proof of secure storage facilities, responsible person designation, and compliance with Ohio Board of Pharmacy regulations.",
                    citation="Ohio Administrative Code 4729-9-01",
                    sourceId="ohio-ac-4729-9-01",
                    tags=["ohio", "tddd", "requirements"],
                    metadata={},
                    includedInPacket=True
                ),
            ],
            assignedTo=None,  # Unassigned - in triage
            dueAt=now + timedelta(hours=96)
        ))
        cases_created += 1
        logger.info(f"✓ Created demo case: {case3.id} - {case3.title}")
    except Exception as e:
        logger.error(f"Failed to create demo case 3: {e}")
    
    # =========================================================================
    # Demo Case 4: Generic License Case - Expired License
    # =========================================================================
    try:
        case4 = create_case(CaseCreateInput(
            decisionType="license",
            title="Apex Healthcare - Expired License Alert",
            summary="DEA license expired 2025-12-01. Requires immediate renewal or suspension of controlled substance operations.",
            evidence=[
                EvidenceItem(
                    id=str(uuid.uuid4()),
                    title="Expired License Prohibition",
                    snippet="Operating with an expired DEA license is prohibited and may result in civil penalties, criminal charges, and loss of registration privileges.",
                    citation="21 USC § 842 - Prohibited Acts",
                    sourceId="usc-21-842",
                    tags=["dea", "expired", "prohibition"],
                    metadata={},
                    includedInPacket=True
                ),
                EvidenceItem(
                    id=str(uuid.uuid4()),
                    title="License Renewal Process",
                    snippet="DEA licenses must be renewed before expiration. Grace periods vary by state. Submit Form 224 (facility) or Form 363 (practitioner) at least 60 days before expiration.",
                    citation="DEA Diversion Control Division - Renewal Guidelines",
                    sourceId="dea-renewal-guide",
                    tags=["dea", "renewal", "process"],
                    metadata={},
                    includedInPacket=False
                ),
            ],
            assignedTo="admin@autocomply.ai",
            dueAt=now + timedelta(hours=24)  # Urgent - expired license
        ))
        cases_created += 1
        logger.info(f"✓ Created demo case: {case4.id} - {case4.title}")
    except Exception as e:
        logger.error(f"Failed to create demo case 4: {e}")
    
    # =========================================================================
    # Demo Case 5: CSA (Controlled Substances Act) - Schedule Change
    # =========================================================================
    try:
        case5 = create_case(CaseCreateInput(
            decisionType="csa",
            title="Schedule Reclassification - Hydrocodone Combination Products",
            summary="Impact analysis for Schedule III to Schedule II reclassification of hydrocodone combination products (effective 2014). Historical reference case.",
            evidence=[
                EvidenceItem(
                    id=str(uuid.uuid4()),
                    title="Hydrocodone Rescheduling to Schedule II",
                    snippet="Effective October 6, 2014, all FDA-approved products containing hydrocodone were reclassified from Schedule III to Schedule II under the Controlled Substances Act.",
                    citation="DEA Final Rule - Hydrocodone Combination Products (79 FR 49661)",
                    sourceId="dea-hydrocodone-reschedule",
                    tags=["dea", "schedule-ii", "hydrocodone", "rescheduling"],
                    metadata={},
                    includedInPacket=True
                ),
                EvidenceItem(
                    id=str(uuid.uuid4()),
                    title="Schedule II Prescription Requirements",
                    snippet="Schedule II drugs require written prescriptions (with limited electronic exceptions), no refills allowed, and stricter storage and record-keeping requirements.",
                    citation="21 CFR 1306.11 - Requirement of Prescription",
                    sourceId="cfr-21-1306-11",
                    tags=["schedule-ii", "prescription", "requirements"],
                    metadata={},
                    includedInPacket=True
                ),
            ],
            assignedTo="compliance@autocomply.ai",
            dueAt=now + timedelta(hours=168)  # 1 week - lower priority
        ))
        cases_created += 1
        logger.info(f"✓ Created demo case: {case5.id} - {case5.title}")
    except Exception as e:
        logger.error(f"Failed to create demo case 5: {e}")
    
    logger.info(f"✅ Demo seed complete - created {cases_created} cases")
    return cases_created


def seed_demo_on_startup() -> int:
    """
    Startup hook for auto-seeding demo data.
    
    Called from main.py startup event when DEMO_SEED=1.
    Safe to call on every startup - only seeds if DB is empty.
    
    Returns:
        Number of cases created
    """
    try:
        count = seed_demo_data()
        if count > 0:
            logger.info(f"🌱 Auto-seeded {count} demo cases on startup")
        return count
    except Exception as e:
        logger.error(f"❌ Failed to seed demo data on startup: {e}")
        return 0
