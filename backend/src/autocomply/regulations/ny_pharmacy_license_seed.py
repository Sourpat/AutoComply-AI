"""
NY Pharmacy License Rule Seed Dataset

Regulatory knowledge base for New York pharmacy license registration and renewal.
This is structured demo data for testing and development.

Each rule includes:
- Unique ID, title, jurisdiction
- Requirement text and rationale
- Legal citation
- Severity: block (hard fail) | review (needs human) | info (advisory)
- Searchable tags

Distribution:
- 4 "block" rules (hard requirements)
- 5 "review" rules (needs human judgment)
- 5 "info" rules (best practices/guidance)
"""

from typing import List, Dict, Any


def get_ny_pharmacy_license_rules() -> List[Dict[str, Any]]:
    """
    Returns the seed dataset for ny_pharmacy_license decision type.
    
    These rules are used by:
    - /rag/regulatory/preview (decision_type="ny_pharmacy_license")
    - /rag/regulatory/search (queries matching NY pharmacy)
    - /rag/regulatory-explain (NY pharmacy license decisions)
    """
    
    return [
        # ===== BLOCK Rules (4) =====
        {
            "id": "ny_pharm_license_001",
            "title": "Valid NY pharmacy license required",
            "jurisdiction": "US-NY",
            "applies_to": "pharmacy",
            "requirement": "Pharmacy must possess a current, non-expired New York pharmacy license issued by the New York State Education Department (NYSED). License must be in 'Current' or 'Registered' status and not suspended, revoked, or under probation.",
            "rationale": "New York Education Law §6801 requires all pharmacies operating in New York to hold a valid pharmacy license. Expired or suspended licenses disqualify approval immediately.",
            "citation_label": "NY Educ. Law §6801",
            "citation_text": "New York Education Law § 6801 - Practice of pharmacy",
            "tags": ["new-york", "ny", "pharmacy", "license", "expiry", "nysed", "block"],
            "severity": "block",
            "effective_date": "1972-01-01",
            "source_url": "https://www.nysenate.gov/legislation/laws/EDN/6801"
        },
        {
            "id": "ny_pharm_pharmacist_002",
            "title": "Licensed pharmacist-in-charge designation required",
            "jurisdiction": "US-NY",
            "applies_to": "pharmacy",
            "requirement": "Pharmacy must designate a licensed pharmacist-in-charge (PIC) who holds an active, unrestricted New York pharmacy license. The PIC must be physically present during all hours of operation and maintain responsibility for pharmacy operations.",
            "rationale": "8 NYCRR §63.6 requires every registered pharmacy to have a designated pharmacist-in-charge responsible for compliance with all pharmacy laws and regulations. Absence of qualified PIC is a categorical block.",
            "citation_label": "8 NYCRR §63.6",
            "citation_text": "8 NYCRR § 63.6 - Pharmacist-in-charge requirements",
            "tags": ["new-york", "ny", "pharmacist", "pic", "responsible_person", "block"],
            "severity": "block",
            "effective_date": "2010-03-01",
            "source_url": "https://regs.health.ny.gov/content/section-636-pharmacist-charge"
        },
        {
            "id": "ny_pharm_registration_003",
            "title": "Pharmacy registration with NYS Department of Health required",
            "jurisdiction": "US-NY",
            "applies_to": "pharmacy",
            "requirement": "In addition to NYSED licensing, pharmacy must be registered with the New York State Department of Health (NYSDOH). Registration must be current and renewed triennially.",
            "rationale": "New York Public Health Law §206 requires pharmacies to register with NYSDOH for public health oversight purposes. Missing or expired NYSDOH registration blocks approval.",
            "citation_label": "NY Pub. Health Law §206",
            "citation_text": "New York Public Health Law § 206 - General functions and duties of department",
            "tags": ["new-york", "ny", "registration", "nysdoh", "health_department", "block"],
            "severity": "block",
            "effective_date": "2008-01-01",
            "source_url": "https://www.nysenate.gov/legislation/laws/PBH/206"
        },
        {
            "id": "ny_pharm_controlled_004",
            "title": "NYS Bureau of Narcotic Enforcement registration for controlled substances",
            "jurisdiction": "US-NY",
            "applies_to": "pharmacy",
            "requirement": "Pharmacies dispensing controlled substances must register with the New York State Bureau of Narcotic Enforcement (BNE). BNE registration must be active and renewed annually alongside DEA registration.",
            "rationale": "New York Public Health Law §3302 requires state-level registration for controlled substance activities in addition to federal DEA registration. Expired BNE registration blocks dispensing authorization.",
            "citation_label": "NY Pub. Health Law §3302",
            "citation_text": "New York Public Health Law § 3302 - Registration requirements",
            "tags": ["new-york", "ny", "controlled-substances", "bne", "registration", "block"],
            "severity": "block",
            "effective_date": "1973-09-01",
            "source_url": "https://www.nysenate.gov/legislation/laws/PBH/3302"
        },
        
        # ===== REVIEW Rules (5) =====
        {
            "id": "ny_pharm_facility_005",
            "title": "Pharmacy facility standards and inspection compliance",
            "jurisdiction": "US-NY",
            "applies_to": "pharmacy",
            "requirement": "Pharmacy facility must meet NYS standards for space, equipment, security, and sanitation per 8 NYCRR §63.3. Recent NYSDOH inspections should show no critical violations.",
            "rationale": "8 NYCRR §63.3 establishes minimum facility standards for pharmacy operations. History of critical violations or uncorrected deficiencies may impact approval.",
            "citation_label": "8 NYCRR §63.3",
            "citation_text": "8 NYCRR § 63.3 - Pharmacy facility requirements",
            "tags": ["new-york", "ny", "facility", "inspection", "standards", "review"],
            "severity": "review",
            "effective_date": "2010-03-01",
            "source_url": "https://regs.health.ny.gov/content/section-633-facility-requirements"
        },
        {
            "id": "ny_pharm_pdmp_006",
            "title": "I-STOP prescription monitoring program compliance",
            "jurisdiction": "US-NY",
            "applies_to": "pharmacy",
            "requirement": "Pharmacies dispensing controlled substances must comply with New York's I-STOP Act requirements including checking the Prescription Monitoring Program (PMP) registry before dispensing and submitting timely dispense reports.",
            "rationale": "New York Public Health Law §3343-a requires PMP checks and reporting for all controlled substance prescriptions. Non-compliance triggers manual review and potential enforcement action.",
            "citation_label": "NY Pub. Health Law §3343-a",
            "citation_text": "New York Public Health Law § 3343-a - Prescription monitoring program requirements",
            "tags": ["new-york", "ny", "i-stop", "pmp", "monitoring", "controlled-substances", "review"],
            "severity": "review",
            "effective_date": "2013-08-27",
            "source_url": "https://www.nysenate.gov/legislation/laws/PBH/3343-A"
        },
        {
            "id": "ny_pharm_staffing_007",
            "title": "Adequate pharmacist and technician staffing levels",
            "jurisdiction": "US-NY",
            "applies_to": "pharmacy",
            "requirement": "Pharmacy must maintain adequate staffing to ensure safe medication dispensing and patient counseling. Pharmacist-to-technician ratios must comply with 8 NYCRR §63.9 requirements.",
            "rationale": "8 NYCRR §63.9 establishes pharmacist supervision requirements for pharmacy technicians. Insufficient staffing or improper supervision ratios require manual verification.",
            "citation_label": "8 NYCRR §63.9",
            "citation_text": "8 NYCRR § 63.9 - Pharmacy technician supervision requirements",
            "tags": ["new-york", "ny", "staffing", "technicians", "supervision", "review"],
            "severity": "review",
            "effective_date": "2015-01-01",
            "source_url": "https://regs.health.ny.gov/content/section-639-technician-requirements"
        },
        {
            "id": "ny_pharm_records_008",
            "title": "Prescription and dispensing records retention",
            "jurisdiction": "US-NY",
            "applies_to": "pharmacy",
            "requirement": "Pharmacy must maintain complete and accurate prescription records for a minimum of five years (seven years for controlled substances). Records must be readily retrievable for inspection.",
            "rationale": "8 NYCRR §63.14 mandates multi-year retention of prescription records. Missing or incomplete recordkeeping triggers compliance review.",
            "citation_label": "8 NYCRR §63.14",
            "citation_text": "8 NYCRR § 63.14 - Prescription record retention requirements",
            "tags": ["new-york", "ny", "records", "retention", "prescriptions", "review"],
            "severity": "review",
            "effective_date": "2010-03-01",
            "source_url": "https://regs.health.ny.gov/content/section-6314-recordkeeping"
        },
        {
            "id": "ny_pharm_compounding_009",
            "title": "Sterile and non-sterile compounding facility requirements",
            "jurisdiction": "US-NY",
            "applies_to": "pharmacy",
            "requirement": "Pharmacies engaged in sterile or non-sterile compounding must register as compounding facilities and meet USP <795> (non-sterile) or USP <797> (sterile) standards as adopted by 10 NYCRR §80.67.",
            "rationale": "10 NYCRR §80.67 requires separate registration and enhanced facility standards for compounding pharmacies. Compounding without proper registration or facility standards requires review.",
            "citation_label": "10 NYCRR §80.67",
            "citation_text": "10 NYCRR § 80.67 - Compounding pharmacy requirements",
            "tags": ["new-york", "ny", "compounding", "usp", "sterile", "review"],
            "severity": "review",
            "effective_date": "2016-07-01",
            "source_url": "https://regs.health.ny.gov/content/section-8067-compounding"
        },
        
        # ===== INFO Rules (5) =====
        {
            "id": "ny_pharm_renewal_010",
            "title": "Triennial pharmacy license renewal requirement",
            "jurisdiction": "US-NY",
            "applies_to": "pharmacy",
            "requirement": "New York pharmacy licenses must be renewed triennially (every three years) with the New York State Education Department. Renewal requires payment of fees and attestation of continued compliance.",
            "rationale": "8 NYCRR §63.2 establishes a three-year renewal cycle for pharmacy licenses. Timely renewal prevents operational disruptions and maintains regulatory standing.",
            "citation_label": "8 NYCRR §63.2",
            "citation_text": "8 NYCRR § 63.2 - Pharmacy license registration and renewal",
            "tags": ["new-york", "ny", "renewal", "triennial", "fees", "info"],
            "severity": "info",
            "effective_date": "2010-03-01",
            "source_url": "https://regs.health.ny.gov/content/section-632-registration"
        },
        {
            "id": "ny_pharm_ce_011",
            "title": "Pharmacist continuing education requirements",
            "jurisdiction": "US-NY",
            "applies_to": "pharmacy",
            "requirement": "Licensed pharmacists in New York must complete continuing education (CE) requirements for license renewal, including specific hours on topics like patient safety, controlled substance prescribing, and medication therapy management.",
            "rationale": "8 NYCRR §60.2 establishes mandatory continuing education for pharmacist license renewal. While applying to individual pharmacists rather than pharmacies, awareness demonstrates commitment to professional development.",
            "citation_label": "8 NYCRR §60.2",
            "citation_text": "8 NYCRR § 60.2 - Continuing education for pharmacists",
            "tags": ["new-york", "ny", "continuing-education", "ce", "pharmacist", "info"],
            "severity": "info",
            "effective_date": "2010-03-01",
            "source_url": "https://regs.health.ny.gov/content/section-602-continuing-education"
        },
        {
            "id": "ny_pharm_patient_counseling_012",
            "title": "Patient counseling and medication therapy management",
            "jurisdiction": "US-NY",
            "applies_to": "pharmacy",
            "requirement": "Pharmacies should offer patient counseling on all new prescriptions and significant prescription changes. Pharmacists should be available for medication therapy management consultations.",
            "rationale": "8 NYCRR §63.8 encourages patient counseling as a professional standard. While not strictly enforced in all cases, robust counseling practices reduce liability and improve patient outcomes.",
            "citation_label": "8 NYCRR §63.8",
            "citation_text": "8 NYCRR § 63.8 - Patient counseling requirements",
            "tags": ["new-york", "ny", "patient-counseling", "mtm", "consultation", "info"],
            "severity": "info",
            "effective_date": "2010-03-01",
            "source_url": "https://regs.health.ny.gov/content/section-638-counseling"
        },
        {
            "id": "ny_pharm_immunizations_013",
            "title": "Pharmacist immunization administration certification",
            "jurisdiction": "US-NY",
            "applies_to": "pharmacy",
            "requirement": "Pharmacies offering immunization services must ensure pharmacists complete approved immunization administration training and certification. Proper documentation and reporting to NYSIIS (immunization registry) are required.",
            "rationale": "10 NYCRR §85.5 authorizes pharmacist immunization administration with appropriate training. Proper certification demonstrates compliance with scope-of-practice regulations.",
            "citation_label": "10 NYCRR §85.5",
            "citation_text": "10 NYCRR § 85.5 - Pharmacist immunization administration",
            "tags": ["new-york", "ny", "immunizations", "vaccines", "training", "info"],
            "severity": "info",
            "effective_date": "2008-06-01",
            "source_url": "https://regs.health.ny.gov/content/section-855-immunizations"
        },
        {
            "id": "ny_pharm_automation_014",
            "title": "Automated dispensing system regulations",
            "jurisdiction": "US-NY",
            "applies_to": "pharmacy",
            "requirement": "Pharmacies utilizing automated dispensing systems, robotics, or other technology must ensure systems meet 8 NYCRR §63.10 standards for accuracy, audit trails, and pharmacist oversight.",
            "rationale": "8 NYCRR §63.10 establishes safety and oversight requirements for pharmacy automation. While technology is permitted, pharmacies must demonstrate proper validation and control procedures.",
            "citation_label": "8 NYCRR §63.10",
            "citation_text": "8 NYCRR § 63.10 - Automated dispensing systems",
            "tags": ["new-york", "ny", "automation", "technology", "dispensing", "info"],
            "severity": "info",
            "effective_date": "2015-01-01",
            "source_url": "https://regs.health.ny.gov/content/section-6310-automation"
        },
    ]


def get_ny_pharmacy_license_sources() -> List[Dict[str, Any]]:
    """
    Returns regulatory sources (documents, statutes, guidance) for NY pharmacy licensing.
    
    These are used for RAG preview and search.
    """
    
    return [
        {
            "id": "ny_pharm_education_law",
            "title": "NY Education Law Article 137 - Pharmacy",
            "jurisdiction": "US-NY",
            "tags": ["new-york", "ny", "pharmacy", "education-law", "statute"],
            "snippet": "New York Education Law Article 137 establishes the legal framework for pharmacy practice and licensing in New York State. Sections 6801-6832 govern pharmacy registration, professional conduct standards, and scope of practice.",
            "citation": "NY Educ. Law Art. 137",
            "url": "https://www.nysenate.gov/legislation/laws/EDN/A137"
        },
        {
            "id": "ny_pharm_nycrr_63",
            "title": "8 NYCRR Part 63 - Pharmacy Practice Requirements",
            "jurisdiction": "US-NY",
            "tags": ["new-york", "ny", "pharmacy", "nycrr", "regulations"],
            "snippet": "8 NYCRR Part 63 contains detailed regulations governing pharmacy operations in New York, including registration requirements, facility standards, pharmacist-in-charge responsibilities, technician supervision, and recordkeeping obligations.",
            "citation": "8 NYCRR Part 63",
            "url": "https://regs.health.ny.gov/regulations/part-63"
        },
        {
            "id": "ny_pharm_controlled_substances",
            "title": "NY Public Health Law Article 33 - Controlled Substances",
            "jurisdiction": "US-NY",
            "tags": ["new-york", "ny", "controlled-substances", "public-health", "statute"],
            "snippet": "New York Public Health Law Article 33 governs controlled substance regulation in New York, including registration requirements, prescription requirements, record-keeping, and the I-STOP prescription monitoring program.",
            "citation": "NY Pub. Health Law Art. 33",
            "url": "https://www.nysenate.gov/legislation/laws/PBH/A33"
        },
        {
            "id": "ny_pharm_istop_guide",
            "title": "I-STOP Prescription Monitoring Program Guide",
            "jurisdiction": "US-NY",
            "tags": ["new-york", "ny", "i-stop", "pmp", "monitoring", "guidance"],
            "snippet": "New York's Internet System for Tracking Over-Prescribing (I-STOP) requires prescribers and pharmacists to consult the Prescription Monitoring Program registry before prescribing or dispensing controlled substances. This guide covers compliance requirements, reporting timelines, and exemptions.",
            "citation": "NY Pub. Health Law §3343-a",
            "url": "https://www.health.ny.gov/professionals/narcotic/prescription_monitoring/"
        },
        {
            "id": "ny_pharm_compounding_standards",
            "title": "USP Compounding Standards Adopted in New York",
            "jurisdiction": "US-NY",
            "tags": ["new-york", "ny", "compounding", "usp", "standards"],
            "snippet": "New York has adopted United States Pharmacopeia (USP) standards for pharmaceutical compounding, including USP <795> for non-sterile compounding and USP <797> for sterile compounding. Pharmacies engaged in compounding must register as compounding facilities and demonstrate compliance.",
            "citation": "10 NYCRR §80.67",
            "url": "https://www.health.ny.gov/professionals/pharmacy/compounding/"
        },
        {
            "id": "ny_pharm_facility_inspection",
            "title": "NYS Pharmacy Inspection and Enforcement Procedures",
            "jurisdiction": "US-NY",
            "tags": ["new-york", "ny", "inspection", "enforcement", "compliance"],
            "snippet": "The New York State Department of Health conducts routine inspections of pharmacy facilities to verify compliance with pharmacy laws and regulations. Inspections assess facility standards, recordkeeping, controlled substance security, and pharmacist supervision.",
            "citation": "NY Pub. Health Law §206",
            "url": "https://www.health.ny.gov/professionals/pharmacy/inspection/"
        },
        {
            "id": "ny_pharm_technician_registration",
            "title": "Pharmacy Technician Registration and Supervision",
            "jurisdiction": "US-NY",
            "tags": ["new-york", "ny", "technician", "registration", "supervision"],
            "snippet": "New York requires pharmacy technicians to register with the State Education Department and work under direct pharmacist supervision. 8 NYCRR §63.9 establishes supervision ratios and scope-of-practice limitations for pharmacy technicians.",
            "citation": "8 NYCRR §63.9",
            "url": "https://www.op.nysed.gov/professions/pharmacy/pharmacy-technician"
        },
        {
            "id": "ny_pharm_immunization_protocol",
            "title": "Pharmacist Immunization Administration Protocol",
            "jurisdiction": "US-NY",
            "tags": ["new-york", "ny", "immunization", "vaccines", "protocol"],
            "snippet": "New York authorizes pharmacists to administer immunizations under 10 NYCRR §85.5. Pharmacists must complete approved immunization training, maintain liability insurance, and report all immunizations to the New York State Immunization Information System (NYSIIS).",
            "citation": "10 NYCRR §85.5",
            "url": "https://www.health.ny.gov/prevention/immunization/pharmacies/"
        },
        {
            "id": "ny_pharm_opioid_guidelines",
            "title": "NYS Opioid Prescribing and Dispensing Guidelines",
            "jurisdiction": "US-NY",
            "tags": ["new-york", "ny", "opioids", "prescribing", "guidelines"],
            "snippet": "New York has implemented comprehensive opioid prescribing and dispensing regulations including mandatory PMP checks, prescription limits for initial opioid prescriptions, and patient counseling requirements. Pharmacies play a critical role in implementing these public health measures.",
            "citation": "NY Pub. Health Law §3331",
            "url": "https://www.health.ny.gov/professionals/narcotic/opioid_prevention/"
        },
        {
            "id": "ny_pharm_covid_protocols",
            "title": "Emergency Pharmacy Practice Protocols (COVID-19 Response)",
            "jurisdiction": "US-NY",
            "tags": ["new-york", "ny", "emergency", "covid", "protocols"],
            "snippet": "During public health emergencies, New York may authorize expanded pharmacy practice authorities including emergency prescription refills, test-and-treat protocols, and therapeutic substitutions. Pharmacies should monitor NYSDOH guidance for current emergency protocols.",
            "citation": "10 NYCRR §80.68",
            "url": "https://www.health.ny.gov/professionals/pharmacy/covid19/"
        },
    ]


def get_ny_pharmacy_license_summary() -> Dict[str, Any]:
    """
    Returns a summary of the NY pharmacy license rule set for metadata and debugging.
    """
    rules = get_ny_pharmacy_license_rules()
    sources = get_ny_pharmacy_license_sources()
    
    return {
        "decision_type": "ny_pharmacy_license",
        "engine_family": "license",
        "total_rules": len(rules),
        "block_rules": len([r for r in rules if r["severity"] == "block"]),
        "review_rules": len([r for r in rules if r["severity"] == "review"]),
        "info_rules": len([r for r in rules if r["severity"] == "info"]),
        "total_sources": len(sources),
        "jurisdictions": sorted(set(r["jurisdiction"] for r in rules)),
        "tags": sorted(set(tag for r in rules for tag in r["tags"])),
    }
