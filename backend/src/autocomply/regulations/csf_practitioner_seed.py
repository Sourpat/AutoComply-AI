"""
CSF Practitioner Rule Seed Dataset

Minimum viable rule set for DEA Practitioner CSF approval/explainability.
This is NOT legally authoritative - it's structured demo data for testing and development.

Each rule includes:
- Unique ID, title, jurisdiction
- Requirement text and rationale
- Legal citation
- Severity: block (hard fail) | review (needs human) | info (advisory)
- Searchable tags

Distribution:
- 3 "block" rules (hard requirements)
- 4 "review" rules (needs human judgment)
- 5 "info" rules (best practices/guidance)
"""

from typing import List, Dict, Any


def get_csf_practitioner_rules() -> List[Dict[str, Any]]:
    """
    Returns the seed dataset for csf_practitioner decision type.
    
    These rules are used by:
    - /rag/regulatory/preview (decision_type="csf_practitioner")
    - /rag/regulatory/search (queries matching practitioner CSF)
    - /rag/regulatory-explain (CSF practitioner decisions)
    """
    
    return [
        # ===== BLOCK Rules (3) =====
        {
            "id": "csf_pract_dea_001",
            "title": "Valid DEA registration required for practitioner CSF",
            "jurisdiction": "US-FEDERAL",
            "applies_to": "practitioner",
            "requirement": "Practitioner must possess a current, non-expired DEA registration certificate. DEA number must be verifiable and match the applicant's identity.",
            "rationale": "21 CFR 1301.13 requires all practitioners handling controlled substances to maintain valid DEA registration. Expired or suspended registrations disqualify CSF approval immediately.",
            "citation_label": "21 CFR 1301.13",
            "citation_text": "21 CFR § 1301.13 - Application for registration; time for filing; expiration date; registration for independent activities",
            "tags": ["dea", "registration", "expiry", "federal", "block"],
            "severity": "block",
            "effective_date": "1971-05-01",
            "source_url": "https://www.ecfr.gov/current/title-21/chapter-II/part-1301/section-1301.13"
        },
        {
            "id": "csf_pract_state_002",
            "title": "Active state medical or pharmacy license required",
            "jurisdiction": "US-MULTI",
            "applies_to": "practitioner",
            "requirement": "Practitioner must hold an active, unrestricted medical or pharmacy license issued by the state in which they practice. License status must be 'Active' or 'Current' - not suspended, revoked, or expired.",
            "rationale": "State licensure is a prerequisite for DEA registration per 21 USC 823(f). Most states also require active licensure as a condition for handling controlled substances within state borders.",
            "citation_label": "21 USC 823(f)",
            "citation_text": "21 U.S.C. § 823(f) - Registration requirements for practitioners",
            "tags": ["state_license", "medical_license", "pharmacy_license", "active", "block"],
            "severity": "block",
            "effective_date": "1970-10-27",
            "source_url": "https://www.govinfo.gov/content/pkg/USCODE-2021-title21/html/USCODE-2021-title21-chap13-subchapI-partD-sec823.htm"
        },
        {
            "id": "csf_pract_schedule_003",
            "title": "Practitioner DEA must authorize requested schedules",
            "jurisdiction": "US-FEDERAL",
            "applies_to": "practitioner",
            "requirement": "Practitioner's DEA registration must explicitly authorize handling of the controlled substance schedules (II, III, IV, V) being requested in the CSF application. Schedule I substances are prohibited for practitioners.",
            "rationale": "21 CFR 1301.71 limits practitioners to schedules for which they are registered. Requesting schedules outside the practitioner's DEA authority is a regulatory violation.",
            "citation_label": "21 CFR 1301.71",
            "citation_text": "21 CFR § 1301.71 - Security requirements generally",
            "tags": ["dea", "schedules", "authorization", "cii", "ciii", "civ", "cv", "block"],
            "severity": "block",
            "effective_date": "1971-05-01",
            "source_url": "https://www.ecfr.gov/current/title-21/chapter-II/part-1301/section-1301.71"
        },
        
        # ===== REVIEW Rules (4) =====
        {
            "id": "csf_pract_exp_004",
            "title": "DEA and license expiry dates must allow processing time",
            "jurisdiction": "US-MULTI",
            "applies_to": "practitioner",
            "requirement": "DEA registration and state license must not expire within 30 days of CSF application submission. Credentials expiring soon require additional review or renewal documentation.",
            "rationale": "Processing CSF applications can take 7-14 business days. Credentials expiring during this window create operational risk and may invalidate approval after issuance.",
            "citation_label": "Internal Policy",
            "citation_text": "AutoComply CSF Processing Guidelines § 4.2 - Credential Expiry Buffer",
            "tags": ["expiry", "processing_time", "renewal", "review"],
            "severity": "review",
            "effective_date": "2024-01-01",
            "source_url": None
        },
        {
            "id": "csf_pract_history_005",
            "title": "Practitioners with prior DEA violations require review",
            "jurisdiction": "US-FEDERAL",
            "applies_to": "practitioner",
            "requirement": "If DEA public records show prior violations, suspensions, or administrative actions against the practitioner, the CSF application must be flagged for compliance review before approval.",
            "rationale": "21 CFR 1301.36 grants DEA authority to revoke or deny registration based on past violations. While not an automatic block, prior issues warrant heightened scrutiny.",
            "citation_label": "21 CFR 1301.36",
            "citation_text": "21 CFR § 1301.36 - Suspension or revocation of registration",
            "tags": ["dea", "violations", "history", "compliance", "review"],
            "severity": "review",
            "effective_date": "1971-05-01",
            "source_url": "https://www.ecfr.gov/current/title-21/chapter-II/part-1301/section-1301.36"
        },
        {
            "id": "csf_pract_attestation_006",
            "title": "Ryan Haight Act attestation required for telemedicine practitioners",
            "jurisdiction": "US-FEDERAL",
            "applies_to": "practitioner",
            "requirement": "Practitioners intending to prescribe controlled substances via telemedicine must attest compliance with Ryan Haight Online Pharmacy Consumer Protection Act exceptions (in-person exam or qualifying telemedicine exemption).",
            "rationale": "21 USC 829(e) prohibits online prescribing of controlled substances without an in-person medical evaluation, except under narrow exemptions. Telemedicine practitioners must affirmatively acknowledge these requirements.",
            "citation_label": "21 USC 829(e)",
            "citation_text": "21 U.S.C. § 829(e) - Ryan Haight Online Pharmacy Consumer Protection Act",
            "tags": ["telemedicine", "ryan_haight", "attestation", "online_prescribing", "review"],
            "severity": "review",
            "effective_date": "2008-04-13",
            "source_url": "https://www.govinfo.gov/content/pkg/USCODE-2021-title21/html/USCODE-2021-title21-chap13-subchapI-partD-sec829.htm"
        },
        {
            "id": "csf_pract_multistate_007",
            "title": "Multi-state practitioners must document each jurisdiction",
            "jurisdiction": "US-MULTI",
            "applies_to": "practitioner",
            "requirement": "Practitioners licensed in multiple states and requesting multi-state CSF approval must provide active license documentation for each jurisdiction. Partial documentation requires review.",
            "rationale": "State-specific regulations vary significantly. Multi-state practice requires verification that the practitioner is compliant in every jurisdiction where they will handle controlled substances.",
            "citation_label": "State Pharmacy Board Guidelines",
            "citation_text": "Multi-state practitioner licensing requirements (varies by state)",
            "tags": ["multi_state", "licenses", "documentation", "jurisdiction", "review"],
            "severity": "review",
            "effective_date": "2020-01-01",
            "source_url": None
        },
        
        # ===== INFO Rules (5) =====
        {
            "id": "csf_pract_npi_008",
            "title": "National Provider Identifier (NPI) should be included",
            "jurisdiction": "US-FEDERAL",
            "applies_to": "practitioner",
            "requirement": "Practitioners are encouraged to provide their NPI number to expedite verification and cross-referencing with NPPES database.",
            "rationale": "NPI is a standard healthcare provider identifier that streamlines credential verification. While not legally required for CSF, it significantly reduces processing time.",
            "citation_label": "HIPAA Administrative Simplification",
            "citation_text": "45 CFR § 162.406 - Standard unique health identifier for health care providers",
            "tags": ["npi", "identifier", "verification", "optional", "info"],
            "severity": "info",
            "effective_date": "2007-05-23",
            "source_url": "https://www.ecfr.gov/current/title-45/subtitle-A/subchapter-C/part-162/subpart-D/section-162.406"
        },
        {
            "id": "csf_pract_renewal_009",
            "title": "Proactive DEA renewal recommended 90 days before expiry",
            "jurisdiction": "US-FEDERAL",
            "applies_to": "practitioner",
            "requirement": "Best practice: Initiate DEA registration renewal at least 90 days before expiration. This prevents lapses that could suspend CSF privileges.",
            "rationale": "DEA renewal processing can take 4-8 weeks. Early renewal ensures continuous authorization and avoids gaps in controlled substance handling authority.",
            "citation_label": "DEA Renewal Guidelines",
            "citation_text": "DEA Diversion Control Division - Registration Renewal Best Practices",
            "tags": ["renewal", "dea", "expiry", "proactive", "best_practice", "info"],
            "severity": "info",
            "effective_date": "2015-01-01",
            "source_url": "https://www.deadiversion.usdoj.gov/drugreg/index.html"
        },
        {
            "id": "csf_pract_cds_010",
            "title": "Integration with Prescription Drug Monitoring Program (PDMP) recommended",
            "jurisdiction": "US-MULTI",
            "applies_to": "practitioner",
            "requirement": "Practitioners should register with their state's PDMP to monitor patient prescription histories. Some states mandate PDMP checks before prescribing controlled substances.",
            "rationale": "PDMPs are state-run databases tracking controlled substance prescriptions. While not universally required for CSF approval, PDMP integration demonstrates commitment to responsible prescribing.",
            "citation_label": "State PDMP Regulations",
            "citation_text": "Prescription Drug Monitoring Program requirements (varies by state)",
            "tags": ["pdmp", "monitoring", "prescribing", "state", "info"],
            "severity": "info",
            "effective_date": "2010-01-01",
            "source_url": None
        },
        {
            "id": "csf_pract_training_011",
            "title": "Continuing education on controlled substance prescribing",
            "jurisdiction": "US-MULTI",
            "applies_to": "practitioner",
            "requirement": "Practitioners are encouraged to complete continuing education on safe opioid prescribing, addiction recognition, and DEA compliance. Some states require specific CE hours.",
            "rationale": "The opioid epidemic has led many states to mandate CE on controlled substance prescribing. Even where not required, such training reduces regulatory risk.",
            "citation_label": "State Medical Board CE Requirements",
            "citation_text": "Continuing Medical Education on Controlled Substances (varies by state)",
            "tags": ["training", "education", "opioids", "prescribing", "ce", "info"],
            "severity": "info",
            "effective_date": "2016-07-01",
            "source_url": None
        },
        {
            "id": "csf_pract_storage_012",
            "title": "Secure storage requirements for controlled substance samples",
            "jurisdiction": "US-FEDERAL",
            "applies_to": "practitioner",
            "requirement": "If practitioner stores controlled substance samples on-site, storage must meet DEA security requirements: locked cabinet, limited access, inventory logging.",
            "rationale": "21 CFR 1301.75 mandates secure storage for all controlled substances. Practitioners with on-site samples must implement appropriate physical security measures.",
            "citation_label": "21 CFR 1301.75",
            "citation_text": "21 CFR § 1301.75 - Physical security controls for practitioners",
            "tags": ["storage", "security", "samples", "inventory", "physical_security", "info"],
            "severity": "info",
            "effective_date": "1971-05-01",
            "source_url": "https://www.ecfr.gov/current/title-21/chapter-II/part-1301/section-1301.75"
        },
    ]


def get_csf_practitioner_sources() -> List[Dict[str, Any]]:
    """
    Returns regulatory sources (documents, statutes, guidance) for CSF practitioner registration.
    
    These are used for RAG preview and search.
    """
    
    return [
        {
            "id": "csf_pract_dea_cfr_1301",
            "title": "21 CFR Part 1301 - DEA Registration Requirements",
            "jurisdiction": "US-FEDERAL",
            "tags": ["federal", "dea", "registration", "cfr", "practitioner"],
            "snippet": "21 CFR Part 1301 establishes DEA registration requirements for practitioners prescribing or dispensing controlled substances. Covers registration procedures, renewal, modifications, and suspension/revocation.",
            "citation": "21 CFR Part 1301",
            "url": "https://www.ecfr.gov/current/title-21/chapter-II/part-1301"
        },
        {
            "id": "csf_pract_state_medical_board",
            "title": "State Medical Board Licensing and Discipline",
            "jurisdiction": "US-STATE",
            "tags": ["state", "medical-board", "license", "practitioner"],
            "snippet": "State medical boards regulate physician and practitioner licensing, including controlled substance prescribing authority. Boards may impose sanctions, restrictions, or license revocations for violations.",
            "citation": "State Medical Practice Acts",
            "url": "https://www.fsmb.org/"
        },
        {
            "id": "csf_pract_dea_schedules",
            "title": "DEA Controlled Substance Schedules",
            "jurisdiction": "US-FEDERAL",
            "tags": ["federal", "dea", "schedules", "controlled-substances"],
            "snippet": "The Controlled Substances Act establishes five schedules of controlled substances based on medical use, abuse potential, and safety. Practitioners must be authorized for specific schedules on their DEA registration.",
            "citation": "21 USC § 812",
            "url": "https://www.dea.gov/drug-information/drug-scheduling"
        },
        {
            "id": "csf_pract_npdb",
            "title": "National Practitioner Data Bank (NPDB)",
            "jurisdiction": "US-FEDERAL",
            "tags": ["federal", "npdb", "malpractice", "disciplinary-actions"],
            "snippet": "The NPDB maintains records of medical malpractice payments, adverse licensure actions, clinical privilege restrictions, and professional society membership actions against practitioners.",
            "citation": "Health Care Quality Improvement Act of 1986",
            "url": "https://www.npdb.hrsa.gov/"
        },
        {
            "id": "csf_pract_pdmp_programs",
            "title": "Prescription Drug Monitoring Programs (PDMPs)",
            "jurisdiction": "US-STATE",
            "tags": ["state", "pdmp", "monitoring", "prescriptions"],
            "snippet": "State-operated PDMPs track controlled substance prescriptions to identify potential diversion, doctor shopping, and inappropriate prescribing. Many states require prescriber consultation before prescribing controlled substances.",
            "citation": "State PDMP Statutes",
            "url": "https://www.pdmpassist.org/"
        },
        {
            "id": "csf_pract_npi_registry",
            "title": "National Provider Identifier (NPI) Registry",
            "jurisdiction": "US-FEDERAL",
            "tags": ["federal", "npi", "cms", "provider"],
            "snippet": "CMS maintains the NPI registry for all healthcare providers. NPIs are required for Medicare/Medicaid billing and are often used to verify provider identity and credentials.",
            "citation": "45 CFR § 162.406",
            "url": "https://npiregistry.cms.hhs.gov/"
        },
    ]


def get_csf_practitioner_summary() -> Dict[str, Any]:
    """
    Returns a summary of the CSF Practitioner rule set for metadata and debugging.
    """
    rules = get_csf_practitioner_rules()
    
    return {
        "decision_type": "csf_practitioner",
        "engine_family": "csf",
        "total_rules": len(rules),
        "block_rules": len([r for r in rules if r["severity"] == "block"]),
        "review_rules": len([r for r in rules if r["severity"] == "review"]),
        "info_rules": len([r for r in rules if r["severity"] == "info"]),
        "jurisdictions": sorted(set(r["jurisdiction"] for r in rules)),
        "tags": sorted(set(tag for r in rules for tag in r["tags"])),
    }
