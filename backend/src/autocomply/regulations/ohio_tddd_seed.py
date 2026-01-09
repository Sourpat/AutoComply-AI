"""
Ohio TDDD License Rule Seed Dataset

Regulatory knowledge base for Ohio Terminal Distributor of Dangerous Drugs (TDDD) licensing.
This is structured demo data for testing and development.

Each rule includes:
- Unique ID, title, jurisdiction
- Requirement text and rationale
- Legal citation
- Severity: block (hard fail) | review (needs human) | info (advisory)
- Searchable tags

Distribution:
- 3 "block" rules (hard requirements)
- 4 "review" rules (needs human judgment)
- 3 "info" rules (best practices/guidance)
"""

from typing import List, Dict, Any


def get_ohio_tddd_rules() -> List[Dict[str, Any]]:
    """
    Returns the seed dataset for ohio_tddd decision type.
    
    These rules are used by:
    - /rag/regulatory/preview (decision_type="ohio_tddd")
    - /rag/regulatory/search (queries matching Ohio TDDD)
    - /rag/regulatory-explain (Ohio TDDD decisions)
    """
    
    return [
        # ===== BLOCK Rules (3) =====
        {
            "id": "ohio_tddd_license_001",
            "title": "Valid Ohio TDDD license required",
            "jurisdiction": "US-OH",
            "applies_to": "distributor",
            "requirement": "Applicant must possess a current, non-expired Ohio Terminal Distributor of Dangerous Drugs (TDDD) license. License must be in 'Active' status and not suspended, revoked, or under administrative action.",
            "rationale": "Ohio Revised Code §4729.54 requires all entities distributing dangerous drugs in Ohio to hold a valid TDDD license. Expired or suspended licenses disqualify approval immediately.",
            "citation_label": "ORC §4729.54",
            "citation_text": "Ohio Revised Code § 4729.54 - Terminal distributor of dangerous drugs license",
            "tags": ["ohio", "tddd", "license", "expiry", "active", "block"],
            "severity": "block",
            "effective_date": "2011-09-30",
            "source_url": "https://codes.ohio.gov/ohio-revised-code/section-4729.54"
        },
        {
            "id": "ohio_tddd_category_002",
            "title": "TDDD category must authorize requested substances",
            "jurisdiction": "US-OH",
            "applies_to": "distributor",
            "requirement": "The TDDD license category must explicitly authorize handling of the dangerous drug categories being requested. Categories include: retail pharmacy, institutional pharmacy, clinical research, pain management clinic, and others per OAC 4729:6-3-01.",
            "rationale": "Ohio Administrative Code 4729:6-3-01 establishes distinct TDDD categories with specific scope limitations. Operating outside authorized categories is a regulatory violation.",
            "citation_label": "OAC 4729:6-3-01",
            "citation_text": "Ohio Administrative Code § 4729:6-3-01 - Categories of terminal distributors of dangerous drugs",
            "tags": ["ohio", "tddd", "category", "authorization", "scope", "block"],
            "severity": "block",
            "effective_date": "2014-06-01",
            "source_url": "https://codes.ohio.gov/ohio-administrative-code/rule-4729:6-3-01"
        },
        {
            "id": "ohio_tddd_rph_003",
            "title": "Responsible pharmacist designation required",
            "jurisdiction": "US-OH",
            "applies_to": "distributor",
            "requirement": "Applicant must designate a responsible pharmacist (RPh) who holds an active, unrestricted Ohio pharmacy license. The RPh must be physically present during hours of operation and responsible for compliance oversight.",
            "rationale": "OAC 4729:5-3-01 requires TDDD license holders to maintain a designated responsible pharmacist for all dangerous drug activities. Absence of qualified RPh is a categorical block.",
            "citation_label": "OAC 4729:5-3-01",
            "citation_text": "Ohio Administrative Code § 4729:5-3-01 - Responsible person",
            "tags": ["ohio", "tddd", "pharmacist", "rph", "responsible_person", "block"],
            "severity": "block",
            "effective_date": "2011-09-30",
            "source_url": "https://codes.ohio.gov/ohio-administrative-code/rule-4729:5-3-01"
        },
        
        # ===== REVIEW Rules (4) =====
        {
            "id": "ohio_tddd_storage_004",
            "title": "Secure storage facility requirements",
            "jurisdiction": "US-OH",
            "applies_to": "distributor",
            "requirement": "Dangerous drugs must be stored in a secure, climate-controlled facility with limited access controls. Storage area must meet pharmacy board specifications for dangerous drug security.",
            "rationale": "OAC 4729:5-11-02 mandates secure storage for dangerous drugs to prevent diversion and ensure product integrity. Deficient security measures trigger manual review.",
            "citation_label": "OAC 4729:5-11-02",
            "citation_text": "Ohio Administrative Code § 4729:5-11-02 - Security and storage requirements",
            "tags": ["ohio", "tddd", "storage", "security", "facility", "review"],
            "severity": "review",
            "effective_date": "2015-03-01",
            "source_url": "https://codes.ohio.gov/ohio-administrative-code/rule-4729:5-11-02"
        },
        {
            "id": "ohio_tddd_inspection_005",
            "title": "Ohio Board of Pharmacy inspection history",
            "jurisdiction": "US-OH",
            "applies_to": "distributor",
            "requirement": "Applicant's TDDD facilities should have passed recent Ohio Board of Pharmacy inspections without critical violations. History of repeated violations or uncorrected deficiencies may impact approval.",
            "rationale": "Regular pharmacy board inspections assess compliance with dangerous drug regulations. Poor inspection history indicates heightened regulatory risk requiring human review.",
            "citation_label": "ORC §4729.55",
            "citation_text": "Ohio Revised Code § 4729.55 - Inspection and investigation",
            "tags": ["ohio", "tddd", "inspection", "compliance", "history", "review"],
            "severity": "review",
            "effective_date": "2011-09-30",
            "source_url": "https://codes.ohio.gov/ohio-revised-code/section-4729.55"
        },
        {
            "id": "ohio_tddd_dispensing_006",
            "title": "Dispensing protocol compliance verification",
            "jurisdiction": "US-OH",
            "applies_to": "distributor",
            "requirement": "For TDDD categories involving dispensing (e.g., retail pharmacy), applicant must demonstrate compliance with Ohio dispensing protocols including OARRS reporting, prescription verification, and patient counseling.",
            "rationale": "Ohio's prescription drug monitoring program (OARRS) requires terminal distributors to report all dispensing activity. Non-compliance with dispensing protocols triggers review.",
            "citation_label": "ORC §4729.75",
            "citation_text": "Ohio Revised Code § 4729.75 - Ohio automated Rx reporting system (OARRS)",
            "tags": ["ohio", "tddd", "dispensing", "oarrs", "prescription", "review"],
            "severity": "review",
            "effective_date": "2006-04-11",
            "source_url": "https://codes.ohio.gov/ohio-revised-code/section-4729.75"
        },
        {
            "id": "ohio_tddd_wholesale_007",
            "title": "Wholesale distribution documentation",
            "jurisdiction": "US-OH",
            "applies_to": "distributor",
            "requirement": "If engaging in wholesale distribution of dangerous drugs, applicant must maintain pedigree documentation, chain-of-custody records, and wholesale supplier verification per federal and state requirements.",
            "rationale": "OAC 4729:6-3-03 imposes strict recordkeeping requirements on wholesale TDDD activities. Missing or incomplete documentation requires manual verification.",
            "citation_label": "OAC 4729:6-3-03",
            "citation_text": "Ohio Administrative Code § 4729:6-3-03 - Wholesale distribution requirements",
            "tags": ["ohio", "tddd", "wholesale", "pedigree", "documentation", "review"],
            "severity": "review",
            "effective_date": "2016-01-01",
            "source_url": "https://codes.ohio.gov/ohio-administrative-code/rule-4729:6-3-03"
        },
        
        # ===== INFO Rules (3) =====
        {
            "id": "ohio_tddd_renewal_008",
            "title": "Biennial TDDD license renewal requirement",
            "jurisdiction": "US-OH",
            "applies_to": "distributor",
            "requirement": "Ohio TDDD licenses must be renewed biennially by September 1 of odd-numbered years. Renewal requires payment of fees and attestation of continued compliance with all Ohio pharmacy laws.",
            "rationale": "ORC §4729.54 establishes a two-year renewal cycle for TDDD licenses. Timely renewal prevents operational disruptions and maintains regulatory standing.",
            "citation_label": "ORC §4729.54",
            "citation_text": "Ohio Revised Code § 4729.54 - Terminal distributor license renewal",
            "tags": ["ohio", "tddd", "renewal", "biennial", "fees", "info"],
            "severity": "info",
            "effective_date": "2011-09-30",
            "source_url": "https://codes.ohio.gov/ohio-revised-code/section-4729.54"
        },
        {
            "id": "ohio_tddd_reporting_009",
            "title": "Annual dangerous drug inventory reporting",
            "jurisdiction": "US-OH",
            "applies_to": "distributor",
            "requirement": "TDDD license holders should conduct annual physical inventory counts of all dangerous drugs and maintain records for a minimum of three years. Inventory records must be available for pharmacy board inspection.",
            "rationale": "Accurate inventory tracking is a best practice that helps prevent diversion and facilitates regulatory audits. While not explicitly mandated for all categories, it demonstrates strong compliance posture.",
            "citation_label": "OAC 4729:5-11-01",
            "citation_text": "Ohio Administrative Code § 4729:5-11-01 - Inventory requirements",
            "tags": ["ohio", "tddd", "inventory", "reporting", "records", "info"],
            "severity": "info",
            "effective_date": "2015-03-01",
            "source_url": "https://codes.ohio.gov/ohio-administrative-code/rule-4729:5-11-01"
        },
        {
            "id": "ohio_tddd_training_010",
            "title": "Staff training on dangerous drug handling",
            "jurisdiction": "US-OH",
            "applies_to": "distributor",
            "requirement": "TDDD license holders are encouraged to provide staff training on safe dangerous drug handling, storage, and diversion prevention. Training should be documented and refreshed annually.",
            "rationale": "While not a statutory requirement for all TDDD categories, comprehensive staff training reduces compliance risks and demonstrates a culture of regulatory responsibility.",
            "citation_label": "Best Practice",
            "citation_text": "Ohio Board of Pharmacy Best Practices for Dangerous Drug Handling",
            "tags": ["ohio", "tddd", "training", "staff", "safety", "info"],
            "severity": "info",
            "effective_date": "2015-01-01",
            "source_url": None
        },
    ]


def get_ohio_tddd_sources() -> List[Dict[str, Any]]:
    """
    Returns regulatory sources (documents, statutes, guidance) for Ohio TDDD licensing.
    
    These are used for RAG preview and search.
    """
    
    return [
        {
            "id": "ohio_tddd_statute_base",
            "title": "Ohio Revised Code Chapter 4729 - Pharmacy; Dangerous Drugs",
            "jurisdiction": "US-OH",
            "tags": ["ohio", "tddd", "statute", "orc", "pharmacy"],
            "snippet": "Ohio Revised Code Chapter 4729 establishes the legal framework for pharmacy practice and dangerous drug regulation in Ohio. Sections 4729.54-4729.56 specifically govern Terminal Distributor of Dangerous Drugs licensing requirements, application procedures, and disciplinary grounds.",
            "citation": "ORC Chapter 4729",
            "url": "https://codes.ohio.gov/ohio-revised-code/chapter-4729"
        },
        {
            "id": "ohio_tddd_oac_categories",
            "title": "OAC 4729:6-3 - Terminal Distributor Categories and Requirements",
            "jurisdiction": "US-OH",
            "tags": ["ohio", "tddd", "oac", "categories", "rules"],
            "snippet": "Ohio Administrative Code 4729:6-3 defines the various categories of TDDD licenses (retail pharmacy, institutional pharmacy, clinic, researcher, etc.) and specifies the requirements, limitations, and operational standards for each category. Critical for determining scope of authorization.",
            "citation": "OAC 4729:6-3",
            "url": "https://codes.ohio.gov/ohio-administrative-code/rule-4729:6-3"
        },
        {
            "id": "ohio_tddd_security_standards",
            "title": "OAC 4729:5-11 - Security and Storage Requirements",
            "jurisdiction": "US-OH",
            "tags": ["ohio", "tddd", "security", "storage", "oac"],
            "snippet": "Ohio Administrative Code 4729:5-11 establishes minimum security and storage standards for dangerous drugs maintained by terminal distributors. Includes requirements for physical security, access controls, climate control, and inventory management.",
            "citation": "OAC 4729:5-11",
            "url": "https://codes.ohio.gov/ohio-administrative-code/rule-4729:5-11"
        },
        {
            "id": "ohio_tddd_oarrs_guide",
            "title": "Ohio OARRS Reporting Requirements for Terminal Distributors",
            "jurisdiction": "US-OH",
            "tags": ["ohio", "tddd", "oarrs", "reporting", "monitoring"],
            "snippet": "Ohio's Automated Rx Reporting System (OARRS) requires terminal distributors who dispense controlled substances to submit detailed transaction data. This guide covers reporting timelines, data format requirements, and compliance obligations under ORC 4729.75.",
            "citation": "ORC §4729.75",
            "url": "https://www.ohiopmp.gov/Portal/Resources.aspx"
        },
        {
            "id": "ohio_tddd_responsible_person",
            "title": "Responsible Person Requirements for TDDD Licenses",
            "jurisdiction": "US-OH",
            "tags": ["ohio", "tddd", "responsible_person", "pharmacist", "rph"],
            "snippet": "Every TDDD license must designate a responsible person (typically a licensed pharmacist) who is accountable for compliance with all Ohio pharmacy laws. This person must be present during operating hours and maintain oversight of dangerous drug activities.",
            "citation": "OAC 4729:5-3-01",
            "url": "https://codes.ohio.gov/ohio-administrative-code/rule-4729:5-3-01"
        },
        {
            "id": "ohio_tddd_inspection_procedures",
            "title": "Ohio Board of Pharmacy Inspection Procedures",
            "jurisdiction": "US-OH",
            "tags": ["ohio", "tddd", "inspection", "compliance", "board"],
            "snippet": "The Ohio Board of Pharmacy conducts routine inspections of TDDD facilities to verify compliance with dangerous drug regulations. Inspections assess security, recordkeeping, responsible person designation, and adherence to category-specific requirements.",
            "citation": "ORC §4729.55",
            "url": "https://pharmacy.ohio.gov/Inspections"
        },
        {
            "id": "ohio_tddd_wholesale_pedigree",
            "title": "Wholesale Distribution and Pedigree Requirements",
            "jurisdiction": "US-OH",
            "tags": ["ohio", "tddd", "wholesale", "pedigree", "distribution"],
            "snippet": "Terminal distributors engaged in wholesale distribution of dangerous drugs must maintain complete pedigree documentation showing chain of custody from manufacturer to final recipient. Requirements align with federal Drug Supply Chain Security Act (DSCSA) standards.",
            "citation": "OAC 4729:6-3-03",
            "url": "https://codes.ohio.gov/ohio-administrative-code/rule-4729:6-3-03"
        },
    ]


def get_ohio_tddd_summary() -> Dict[str, Any]:
    """
    Returns a summary of the Ohio TDDD rule set for metadata and debugging.
    """
    rules = get_ohio_tddd_rules()
    sources = get_ohio_tddd_sources()
    
    return {
        "decision_type": "ohio_tddd",
        "engine_family": "license",
        "total_rules": len(rules),
        "block_rules": len([r for r in rules if r["severity"] == "block"]),
        "review_rules": len([r for r in rules if r["severity"] == "review"]),
        "info_rules": len([r for r in rules if r["severity"] == "info"]),
        "total_sources": len(sources),
        "jurisdictions": sorted(set(r["jurisdiction"] for r in rules)),
        "tags": sorted(set(tag for r in rules for tag in r["tags"])),
    }
