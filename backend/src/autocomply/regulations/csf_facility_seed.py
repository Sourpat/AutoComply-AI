"""
CSF Facility Rule Seed Dataset

Regulatory knowledge base for hospital/facility Controlled Substance Facilitator (CSF) registration.
This is structured demo data for testing and development.

Each rule includes:
- Unique ID, title, jurisdiction
- Requirement text and rationale
- Legal citation
- Severity: block (hard fail) | review (needs human) | info (advisory)
- Searchable tags

Distribution:
- 5 "block" rules (hard requirements)
- 5 "review" rules (needs human judgment)
- 5 "info" rules (best practices/guidance)
"""

from typing import List, Dict, Any


def get_csf_facility_rules() -> List[Dict[str, Any]]:
    """
    Returns the seed dataset for csf_facility decision type.
    
    These rules are used by:
    - /rag/regulatory/preview (decision_type="csf_facility")
    - /rag/regulatory/search (queries matching facility CSF)
    - /rag/regulatory-explain (facility CSF decisions)
    """
    
    return [
        # ===== BLOCK Rules (5) =====
        {
            "id": "csf_facility_dea_001",
            "title": "Valid DEA registration for facility required",
            "jurisdiction": "US-FEDERAL",
            "applies_to": "facility",
            "requirement": "Healthcare facility must possess a current, non-expired DEA registration under the appropriate activity code (e.g., Hospital/Clinic, Practitioner, Mid-Level Practitioner). DEA registration must not be suspended, revoked, or restricted.",
            "rationale": "21 CFR §1301.11 requires all entities handling controlled substances to maintain valid DEA registration. Expired or revoked DEA registration categorically blocks CSF approval.",
            "citation_label": "21 CFR §1301.11",
            "citation_text": "21 CFR § 1301.11 - Persons required to register",
            "tags": ["federal", "dea", "registration", "facility", "hospital", "block"],
            "severity": "block",
            "effective_date": "1971-05-01",
            "source_url": "https://www.ecfr.gov/current/title-21/chapter-II/part-1301/section-1301.11"
        },
        {
            "id": "csf_facility_state_002",
            "title": "State healthcare facility license in good standing",
            "jurisdiction": "US-STATE",
            "applies_to": "facility",
            "requirement": "Facility must hold a current state license to operate as a hospital, surgical center, clinic, or other healthcare facility. License must be in active, unrestricted status with no pending closure or sanctions.",
            "rationale": "State licensing authorities regulate healthcare facility operations. Expired, suspended, or restricted facility licenses disqualify CSF eligibility immediately.",
            "citation_label": "State Facility Licensing Statutes",
            "citation_text": "State healthcare facility licensing requirements vary by jurisdiction",
            "tags": ["state", "facility", "license", "hospital", "clinic", "block"],
            "severity": "block",
            "effective_date": "Varies by state",
            "source_url": "https://www.cms.gov/regulations-and-guidance/legislation/clia"
        },
        {
            "id": "csf_facility_responsible_003",
            "title": "Designated responsible pharmacist or physician required",
            "jurisdiction": "US-FEDERAL",
            "applies_to": "facility",
            "requirement": "Facility must designate a licensed pharmacist (with active DEA registration) or physician (with active DEA and state medical license) as responsible for controlled substance management. This person must be available during facility operating hours.",
            "rationale": "21 CFR §1301.12 requires designation of a responsible individual for controlled substance security and recordkeeping at facility locations. Absence of qualified responsible person blocks approval.",
            "citation_label": "21 CFR §1301.12",
            "citation_text": "21 CFR § 1301.12 - Separate registration for separate locations",
            "tags": ["federal", "dea", "responsible-person", "pharmacist", "physician", "block"],
            "severity": "block",
            "effective_date": "1971-05-01",
            "source_url": "https://www.ecfr.gov/current/title-21/chapter-II/part-1301/section-1301.12"
        },
        {
            "id": "csf_facility_storage_004",
            "title": "DEA-compliant controlled substance storage and security",
            "jurisdiction": "US-FEDERAL",
            "applies_to": "facility",
            "requirement": "Facility must maintain controlled substances in securely locked, substantially constructed cabinets or safes as required by 21 CFR §1301.75. Schedule II substances must be stored separately with additional security controls. Facility must implement access controls limiting access to authorized personnel only.",
            "rationale": "21 CFR §1301.75 mandates physical security requirements for controlled substance storage. Inadequate storage security creates diversion risk and blocks CSF approval.",
            "citation_label": "21 CFR §1301.75",
            "citation_text": "21 CFR § 1301.75 - Physical security controls for non-practitioners",
            "tags": ["federal", "dea", "storage", "security", "schedule-ii", "block"],
            "severity": "block",
            "effective_date": "1971-05-01",
            "source_url": "https://www.ecfr.gov/current/title-21/chapter-II/part-1301/section-1301.75"
        },
        {
            "id": "csf_facility_recordkeeping_005",
            "title": "DEA-compliant controlled substance recordkeeping system",
            "jurisdiction": "US-FEDERAL",
            "applies_to": "facility",
            "requirement": "Facility must maintain complete and accurate records of all controlled substance acquisitions, dispensing, and destruction per 21 CFR §1304. Records must be readily retrievable and retained for minimum of two years.",
            "rationale": "21 CFR §1304 establishes comprehensive recordkeeping requirements for controlled substances. Missing, incomplete, or disorganized records block CSF approval due to audit and accountability concerns.",
            "citation_label": "21 CFR §1304",
            "citation_text": "21 CFR Part 1304 - Records and Reports of Registrants",
            "tags": ["federal", "dea", "recordkeeping", "records", "audit", "block"],
            "severity": "block",
            "effective_date": "1971-05-01",
            "source_url": "https://www.ecfr.gov/current/title-21/chapter-II/part-1304"
        },
        
        # ===== REVIEW Rules (5) =====
        {
            "id": "csf_facility_inventory_006",
            "title": "Biennial controlled substance inventory compliance",
            "jurisdiction": "US-FEDERAL",
            "applies_to": "facility",
            "requirement": "Facility must conduct and document comprehensive controlled substance inventory at least every two years per 21 CFR §1304.11. Inventory must account for all controlled substances on hand by schedule and provide item-level detail for Schedule II.",
            "rationale": "21 CFR §1304.11 requires biennial physical inventory of controlled substances. Missing, incomplete, or untimely inventories trigger manual review of facility diligence.",
            "citation_label": "21 CFR §1304.11",
            "citation_text": "21 CFR § 1304.11 - Inventory requirements",
            "tags": ["federal", "dea", "inventory", "biennial", "schedule-ii", "review"],
            "severity": "review",
            "effective_date": "1971-05-01",
            "source_url": "https://www.ecfr.gov/current/title-21/chapter-II/part-1304/section-1304.11"
        },
        {
            "id": "csf_facility_diversion_007",
            "title": "Controlled substance diversion prevention program",
            "jurisdiction": "US-FEDERAL",
            "applies_to": "facility",
            "requirement": "Facility should implement a diversion prevention and monitoring program including audit trails, variance investigations, employee training, and incident reporting. DEA encourages facilities to utilize automated dispensing systems with usage analytics.",
            "rationale": "While not strictly required by regulation, DEA guidance and industry best practices strongly encourage formal diversion prevention programs. Absence of program may trigger enhanced scrutiny during review.",
            "citation_label": "DEA Diversion Control Guidance",
            "citation_text": "DEA Diversion Control Division - Best Practices for Healthcare Facilities",
            "tags": ["federal", "dea", "diversion", "prevention", "monitoring", "review"],
            "severity": "review",
            "effective_date": "2010-01-01",
            "source_url": "https://www.deadiversion.usdoj.gov/faq/registrants_security.htm"
        },
        {
            "id": "csf_facility_staff_008",
            "title": "Staff training on controlled substance handling and security",
            "jurisdiction": "US-FEDERAL",
            "applies_to": "facility",
            "requirement": "Facility should provide regular training to staff with controlled substance access on DEA regulations, security procedures, recordkeeping requirements, and diversion prevention. Training should be documented and refreshed annually.",
            "rationale": "While not explicitly mandated by 21 CFR, DEA expects facilities to train personnel on controlled substance compliance. Inadequate training increases risk of violations and may require review.",
            "citation_label": "DEA Practitioner Manual",
            "citation_text": "DEA Practitioner's Manual - Employee Training Recommendations",
            "tags": ["federal", "dea", "training", "staff", "compliance", "review"],
            "severity": "review",
            "effective_date": "2010-01-01",
            "source_url": "https://www.deadiversion.usdoj.gov/pubs/manuals/pract/"
        },
        {
            "id": "csf_facility_theft_009",
            "title": "Theft or loss reporting and investigation procedures",
            "jurisdiction": "US-FEDERAL",
            "applies_to": "facility",
            "requirement": "Facility must report any theft or significant loss of controlled substances to DEA using Form 106 within one business day of discovery per 21 CFR §1301.74(c). Facility should maintain internal investigation procedures for all discrepancies.",
            "rationale": "21 CFR §1301.74(c) mandates prompt reporting of controlled substance theft or loss. History of unreported thefts or recurring losses triggers compliance review.",
            "citation_label": "21 CFR §1301.74(c)",
            "citation_text": "21 CFR § 1301.74(c) - Theft or loss reporting requirements",
            "tags": ["federal", "dea", "theft", "loss", "reporting", "review"],
            "severity": "review",
            "effective_date": "1971-05-01",
            "source_url": "https://www.ecfr.gov/current/title-21/chapter-II/part-1301/section-1301.74"
        },
        {
            "id": "csf_facility_inspection_010",
            "title": "Compliance with DEA and state inspection requirements",
            "jurisdiction": "US-FEDERAL",
            "applies_to": "facility",
            "requirement": "Facility must cooperate with DEA and state board of pharmacy inspections per 21 CFR §1316. Previous inspection findings should show no unresolved critical violations.",
            "rationale": "21 CFR §1316 authorizes DEA and state inspections of registrant facilities. History of critical violations, refusal to permit inspection, or failure to correct deficiencies triggers review.",
            "citation_label": "21 CFR §1316",
            "citation_text": "21 CFR Part 1316 - Administrative Inspections",
            "tags": ["federal", "dea", "inspection", "compliance", "violations", "review"],
            "severity": "review",
            "effective_date": "1971-05-01",
            "source_url": "https://www.ecfr.gov/current/title-21/chapter-II/part-1316"
        },
        
        # ===== INFO Rules (5) =====
        {
            "id": "csf_facility_renewal_011",
            "title": "DEA registration renewal every three years",
            "jurisdiction": "US-FEDERAL",
            "applies_to": "facility",
            "requirement": "DEA registrations for healthcare facilities expire every three years and must be renewed through the DEA Diversion Control Division. Renewal requires payment of fees and attestation of continued compliance.",
            "rationale": "21 CFR §1301.13 establishes a three-year registration period. Timely renewal prevents operational disruptions and maintains regulatory standing.",
            "citation_label": "21 CFR §1301.13",
            "citation_text": "21 CFR § 1301.13 - Application for registration; time for filing",
            "tags": ["federal", "dea", "renewal", "registration", "fees", "info"],
            "severity": "info",
            "effective_date": "1971-05-01",
            "source_url": "https://www.ecfr.gov/current/title-21/chapter-II/part-1301/section-1301.13"
        },
        {
            "id": "csf_facility_formulary_012",
            "title": "Facility controlled substance formulary management",
            "jurisdiction": "US-FEDERAL",
            "applies_to": "facility",
            "requirement": "Facility should maintain a defined formulary of controlled substances appropriate for patient population and treatment protocols. Pharmacy and Therapeutics (P&T) committee oversight is recommended.",
            "rationale": "While not mandated by DEA regulations, formulary management demonstrates clinical governance and helps prevent overstocking or diversion of unnecessary controlled substances.",
            "citation_label": "Joint Commission Standards",
            "citation_text": "The Joint Commission - Medication Management Standards",
            "tags": ["facility", "formulary", "pharmacy", "therapeutics", "governance", "info"],
            "severity": "info",
            "effective_date": "2010-01-01",
            "source_url": "https://www.jointcommission.org/standards/standard-faqs/hospital/"
        },
        {
            "id": "csf_facility_automation_013",
            "title": "Automated dispensing systems and cabinets",
            "jurisdiction": "US-FEDERAL",
            "applies_to": "facility",
            "requirement": "Facilities may utilize automated dispensing cabinets (ADCs) for controlled substance storage and dispensing. ADCs must meet DEA security and recordkeeping requirements and be periodically audited for discrepancies.",
            "rationale": "DEA permits use of ADCs under 21 CFR §1301.75(b) if they meet security standards. Proper implementation with oversight improves medication safety and provides audit trails.",
            "citation_label": "21 CFR §1301.75(b)",
            "citation_text": "21 CFR § 1301.75(b) - Automated dispensing systems",
            "tags": ["federal", "dea", "automation", "adc", "dispensing", "info"],
            "severity": "info",
            "effective_date": "2009-01-01",
            "source_url": "https://www.ecfr.gov/current/title-21/chapter-II/part-1301/section-1301.75"
        },
        {
            "id": "csf_facility_disposal_014",
            "title": "Controlled substance disposal and reverse distribution",
            "jurisdiction": "US-FEDERAL",
            "applies_to": "facility",
            "requirement": "Facility must dispose of expired, contaminated, or unwanted controlled substances through DEA-registered reverse distributors or authorized take-back programs per 21 CFR §1317. Destruction must be documented with DEA Form 41.",
            "rationale": "21 CFR §1317 establishes procedures for controlled substance disposal. Proper disposal prevents diversion and demonstrates regulatory compliance.",
            "citation_label": "21 CFR §1317",
            "citation_text": "21 CFR Part 1317 - Disposal of Controlled Substances",
            "tags": ["federal", "dea", "disposal", "destruction", "reverse-distributor", "info"],
            "severity": "info",
            "effective_date": "2014-10-09",
            "source_url": "https://www.ecfr.gov/current/title-21/chapter-II/part-1317"
        },
        {
            "id": "csf_facility_emergency_015",
            "title": "Emergency controlled substance procurement and dispensing",
            "jurisdiction": "US-FEDERAL",
            "applies_to": "facility",
            "requirement": "In emergency situations, facilities may procure controlled substances from other DEA registrants with proper documentation. Emergency dispensing to patients must comply with state and federal requirements.",
            "rationale": "21 CFR §1306.11 permits emergency dispensing of controlled substances under specific conditions. Facilities should have policies addressing emergency procurement and dispensing scenarios.",
            "citation_label": "21 CFR §1306.11",
            "citation_text": "21 CFR § 1306.11 - Emergency dispensing",
            "tags": ["federal", "dea", "emergency", "procurement", "dispensing", "info"],
            "severity": "info",
            "effective_date": "1971-05-01",
            "source_url": "https://www.ecfr.gov/current/title-21/chapter-II/part-1306/section-1306.11"
        },
    ]


def get_csf_facility_sources() -> List[Dict[str, Any]]:
    """
    Returns regulatory sources (documents, statutes, guidance) for facility CSF registration.
    
    These are used for RAG preview and search.
    """
    
    return [
        {
            "id": "csf_facility_cfr_1301",
            "title": "21 CFR Part 1301 - Registration of Manufacturers, Distributors, and Dispensers",
            "jurisdiction": "US-FEDERAL",
            "tags": ["federal", "dea", "registration", "cfr", "facility"],
            "snippet": "21 CFR Part 1301 establishes DEA registration requirements for all entities handling controlled substances, including healthcare facilities. Covers registration procedures, renewal, security requirements, and suspension/revocation procedures.",
            "citation": "21 CFR Part 1301",
            "url": "https://www.ecfr.gov/current/title-21/chapter-II/part-1301"
        },
        {
            "id": "csf_facility_cfr_1304",
            "title": "21 CFR Part 1304 - Records and Reports of Registrants",
            "jurisdiction": "US-FEDERAL",
            "tags": ["federal", "dea", "recordkeeping", "cfr", "facility"],
            "snippet": "21 CFR Part 1304 specifies controlled substance recordkeeping and reporting requirements for DEA registrants. Covers inventory requirements, prescription records, acquisition/distribution records, and reporting obligations.",
            "citation": "21 CFR Part 1304",
            "url": "https://www.ecfr.gov/current/title-21/chapter-II/part-1304"
        },
        {
            "id": "csf_facility_security_standards",
            "title": "DEA Physical Security and Controlled Substance Storage Requirements",
            "jurisdiction": "US-FEDERAL",
            "tags": ["federal", "dea", "security", "storage", "facility"],
            "snippet": "21 CFR §1301.71-76 establish physical security requirements for controlled substances including storage in locked cabinets/safes, access controls, alarm systems, and surveillance. Schedule II substances require enhanced security measures.",
            "citation": "21 CFR §1301.71-76",
            "url": "https://www.deadiversion.usdoj.gov/faq/registrants_security.htm"
        },
        {
            "id": "csf_facility_diversion_guidance",
            "title": "DEA Diversion Control Division Guidance for Healthcare Facilities",
            "jurisdiction": "US-FEDERAL",
            "tags": ["federal", "dea", "diversion", "guidance", "facility"],
            "snippet": "DEA Diversion Control Division provides comprehensive guidance on diversion prevention, audit procedures, employee screening, and compliance best practices for healthcare facilities. Includes recommendations for automated dispensing systems and monitoring programs.",
            "citation": "DEA Diversion Control Division",
            "url": "https://www.deadiversion.usdoj.gov/"
        },
        {
            "id": "csf_facility_practitioner_manual",
            "title": "DEA Practitioner's Manual",
            "jurisdiction": "US-FEDERAL",
            "tags": ["federal", "dea", "practitioner", "manual", "guidance"],
            "snippet": "The DEA Practitioner's Manual provides detailed guidance on controlled substance regulations for healthcare practitioners and facilities. Covers registration, prescribing, recordkeeping, security, and disposal requirements.",
            "citation": "DEA Practitioner's Manual (2006 Edition)",
            "url": "https://www.deadiversion.usdoj.gov/pubs/manuals/pract/"
        },
        {
            "id": "csf_facility_disposal_rule",
            "title": "Controlled Substance Disposal Regulations (21 CFR Part 1317)",
            "jurisdiction": "US-FEDERAL",
            "tags": ["federal", "dea", "disposal", "cfr", "facility"],
            "snippet": "21 CFR Part 1317 establishes procedures for secure disposal of controlled substances by facilities. Permits use of DEA-registered reverse distributors, on-site destruction with DEA oversight, and authorized take-back programs.",
            "citation": "21 CFR Part 1317",
            "url": "https://www.ecfr.gov/current/title-21/chapter-II/part-1317"
        },
        {
            "id": "csf_facility_inspection_procedures",
            "title": "DEA Administrative Inspection Authority (21 CFR Part 1316)",
            "jurisdiction": "US-FEDERAL",
            "tags": ["federal", "dea", "inspection", "cfr", "facility"],
            "snippet": "21 CFR Part 1316 establishes DEA's authority to conduct administrative inspections of registrant premises, records, and controlled substances. Registrants must permit inspections during business hours and provide requested documentation.",
            "citation": "21 CFR Part 1316",
            "url": "https://www.ecfr.gov/current/title-21/chapter-II/part-1316"
        },
        {
            "id": "csf_facility_state_licensing",
            "title": "State Healthcare Facility Licensing Requirements",
            "jurisdiction": "US-STATE",
            "tags": ["state", "facility", "license", "hospital", "clinic"],
            "snippet": "State health departments regulate healthcare facility licensing including hospitals, surgical centers, clinics, and long-term care facilities. Requirements vary by state but typically include facility standards, staffing requirements, and controlled substance policies.",
            "citation": "State Health Department Regulations",
            "url": "https://www.cms.gov/regulations-and-guidance/legislation/clia"
        },
        {
            "id": "csf_facility_jcaho_standards",
            "title": "Joint Commission Medication Management Standards",
            "jurisdiction": "US-ACCREDITATION",
            "tags": ["accreditation", "joint-commission", "medication-management", "facility"],
            "snippet": "The Joint Commission establishes medication management standards for accredited healthcare facilities including controlled substance security, formulary management, medication reconciliation, and quality monitoring.",
            "citation": "The Joint Commission Standards",
            "url": "https://www.jointcommission.org/standards/standard-faqs/hospital/"
        },
        {
            "id": "csf_facility_adc_guidance",
            "title": "Automated Dispensing Cabinet Implementation Guidance",
            "jurisdiction": "US-FEDERAL",
            "tags": ["federal", "dea", "adc", "automation", "facility"],
            "snippet": "Guidance on implementing automated dispensing cabinets (ADCs) in healthcare facilities including DEA security requirements, audit procedures, user access controls, and integration with pharmacy systems.",
            "citation": "DEA Automation Guidance",
            "url": "https://www.ismp.org/resources/automated-dispensing-cabinets-guidelines-safe-use"
        },
        {
            "id": "csf_facility_emergency_protocols",
            "title": "Emergency Controlled Substance Procurement and Dispensing Protocols",
            "jurisdiction": "US-FEDERAL",
            "tags": ["federal", "dea", "emergency", "procurement", "facility"],
            "snippet": "Guidelines for emergency procurement and dispensing of controlled substances in healthcare facilities during shortages, disasters, or urgent patient needs. Covers temporary procurement authorizations and emergency prescription dispensing.",
            "citation": "21 CFR §1306.11",
            "url": "https://www.deadiversion.usdoj.gov/faq/registrants.htm"
        },
        {
            "id": "csf_facility_cms_requirements",
            "title": "CMS Conditions of Participation - Pharmacy Services",
            "jurisdiction": "US-FEDERAL",
            "tags": ["federal", "cms", "medicare", "pharmacy", "facility"],
            "snippet": "CMS Conditions of Participation establish pharmacy service requirements for Medicare/Medicaid-participating hospitals and facilities. Includes controlled substance management, pharmaceutical services, and medication safety standards.",
            "citation": "42 CFR §482.25",
            "url": "https://www.cms.gov/regulations-and-guidance/guidance/manuals/downloads/som107ap_a_hospitals.pdf"
        },
    ]


def get_csf_facility_summary() -> Dict[str, Any]:
    """
    Returns a summary of the CSF facility rule set for metadata and debugging.
    """
    rules = get_csf_facility_rules()
    sources = get_csf_facility_sources()
    
    return {
        "decision_type": "csf_facility",
        "engine_family": "csf",
        "total_rules": len(rules),
        "block_rules": len([r for r in rules if r["severity"] == "block"]),
        "review_rules": len([r for r in rules if r["severity"] == "review"]),
        "info_rules": len([r for r in rules if r["severity"] == "info"]),
        "total_sources": len(sources),
        "jurisdictions": sorted(set(r["jurisdiction"] for r in rules)),
        "tags": sorted(set(tag for r in rules for tag in r["tags"])),
    }
