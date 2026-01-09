"""
Deterministic NY Pharmacy License Decision Evaluator

This module evaluates New York pharmacy license applications against the seeded
knowledge rules and returns a structured decision.

NO LLM CALLS - purely rule-based evaluation for demo/testing purposes.
"""

from typing import Dict, Any, List, Literal, Optional
from pydantic import BaseModel, Field

from src.autocomply.regulations.ny_pharmacy_license_seed import get_ny_pharmacy_license_rules
from src.api.models.compliance_models import RegulatorySource


DecisionOutcome = Literal["approved", "needs_review", "blocked"]


class FiredRule(BaseModel):
    """A rule that was triggered during evaluation."""
    id: str
    title: str
    severity: str  # "block" | "review" | "info"
    jurisdiction: str
    citation: str
    rationale: str
    snippet: str
    requirement: str


class EvaluatedRule(BaseModel):
    """A rule that was evaluated (may or may not have fired)."""
    id: str
    title: str
    severity: str
    jurisdiction: str
    citation: str
    rationale: str
    requirement: str
    status: str  # "passed" | "failed" | "info"


class NyPharmacyLicenseDecisionResult(BaseModel):
    """Result of evaluating a NY pharmacy license application."""
    outcome: DecisionOutcome
    fired_rules: List[FiredRule] = Field(default_factory=list)
    evaluated_rules: List[EvaluatedRule] = Field(default_factory=list)
    satisfied_requirements: List[str] = Field(default_factory=list)
    missing_evidence: List[str] = Field(default_factory=list)
    next_steps: List[str] = Field(default_factory=list)
    explanation: str = ""
    decision_summary: str = ""
    sources: List[RegulatorySource] = Field(default_factory=list)


def evaluate_ny_pharmacy_license_decision(
    evidence: Dict[str, Any],
    decision_type: str = "ny_pharmacy_license",
) -> NyPharmacyLicenseDecisionResult:
    """
    Evaluate a NY pharmacy license application using deterministic rules.
    
    Args:
        evidence: Dictionary containing:
            - ny_pharmacy_license_valid: bool
            - ny_pharmacy_license_expiry_days: int
            - has_pharmacist_in_charge: bool
            - pic_license_status: str ("Active", "Expired", etc.)
            - nysdoh_registered: bool
            - nysdoh_registration_expiry_days: int
            - bne_registered: bool (Bureau of Narcotic Enforcement)
            - bne_registration_expiry_days: int
            - facility_inspection_status: str ("Pass", "Minor Violations", "Critical Violations")
            - istop_compliant: bool (I-STOP PMP compliance)
            - istop_violations_count: int
            - pharmacist_technician_ratio_compliant: bool
            - prescription_records_complete: bool
            - compounding_facility_registered: bool
            - does_compounding: bool
        decision_type: Always "ny_pharmacy_license" for this evaluator
    
    Returns:
        NyPharmacyLicenseDecisionResult with outcome, fired_rules, missing_evidence, next_steps
    """
    
    rules = get_ny_pharmacy_license_rules()
    fired_rules: List[FiredRule] = []
    evaluated_rules: List[EvaluatedRule] = []
    satisfied_requirements: List[str] = []
    missing_evidence: List[str] = []
    next_steps: List[str] = []
    
    has_block = False
    has_review = False
    
    # Rule 1: Valid NY Pharmacy License (BLOCK)
    rule_license = next((r for r in rules if r["id"] == "ny_pharm_license_001"), None)
    if not evidence.get("ny_pharmacy_license_valid", False):
        if rule_license:
            fired_rules.append(_rule_to_fired_rule(rule_license))
            evaluated_rules.append(_rule_to_evaluated_rule(rule_license, "failed"))
            has_block = True
            missing_evidence.append("Valid NY pharmacy license from NYSED")
            next_steps.append("Obtain or renew NY pharmacy license from State Education Department")
    else:
        if rule_license:
            evaluated_rules.append(_rule_to_evaluated_rule(rule_license, "passed"))
            satisfied_requirements.append("Valid NY pharmacy license confirmed")
    
    # Rule 2: Pharmacist-in-Charge (BLOCK)
    rule_pic = next((r for r in rules if r["id"] == "ny_pharm_pharmacist_002"), None)
    if not evidence.get("has_pharmacist_in_charge", False):
        if rule_pic:
            fired_rules.append(_rule_to_fired_rule(rule_pic))
            evaluated_rules.append(_rule_to_evaluated_rule(rule_pic, "failed"))
            has_block = True
            missing_evidence.append("Designated pharmacist-in-charge with active NY license")
            next_steps.append("Designate licensed pharmacist-in-charge and submit verification")
    else:
        pic_status = evidence.get("pic_license_status", "").lower()
        if pic_status not in ["active", "current"]:
            if rule_pic:
                fired_rules.append(_rule_to_fired_rule(rule_pic))
                evaluated_rules.append(_rule_to_evaluated_rule(rule_pic, "failed"))
                has_block = True
                missing_evidence.append(f"Active PIC license (currently {pic_status})")
                next_steps.append("Pharmacist-in-charge must renew NY pharmacy license")
        else:
            if rule_pic:
                evaluated_rules.append(_rule_to_evaluated_rule(rule_pic, "passed"))
                satisfied_requirements.append("Pharmacist-in-charge with active NY license designated")
    
    # Rule 3: NYSDOH Registration (BLOCK)
    rule_nysdoh = next((r for r in rules if r["id"] == "ny_pharm_registration_003"), None)
    if not evidence.get("nysdoh_registered", False):
        if rule_nysdoh:
            fired_rules.append(_rule_to_fired_rule(rule_nysdoh))
            evaluated_rules.append(_rule_to_evaluated_rule(rule_nysdoh, "failed"))
            has_block = True
            missing_evidence.append("NYS Department of Health pharmacy registration")
            next_steps.append("Register pharmacy with NYS Department of Health")
    else:
        if rule_nysdoh:
            evaluated_rules.append(_rule_to_evaluated_rule(rule_nysdoh, "passed"))
            satisfied_requirements.append("NYSDOH pharmacy registration confirmed")
    
    # Rule 4: BNE Registration for Controlled Substances (BLOCK)
    rule_bne = next((r for r in rules if r["id"] == "ny_pharm_controlled_004"), None)
    if not evidence.get("bne_registered", False):
        if rule_bne:
            fired_rules.append(_rule_to_fired_rule(rule_bne))
            evaluated_rules.append(_rule_to_evaluated_rule(rule_bne, "failed"))
            has_block = True
            missing_evidence.append("NYS Bureau of Narcotic Enforcement registration")
            next_steps.append("Register with NYS Bureau of Narcotic Enforcement for controlled substances")
    else:
        if rule_bne:
            evaluated_rules.append(_rule_to_evaluated_rule(rule_bne, "passed"))
            satisfied_requirements.append("BNE controlled substance registration confirmed")
    
    # Rule 5: Facility Inspection Status (REVIEW)
    rule_facility = next((r for r in rules if r["id"] == "ny_pharm_facility_005"), None)
    inspection_status = evidence.get("facility_inspection_status", "").lower()
    if "critical" in inspection_status:
        if rule_facility:
            fired_rules.append(_rule_to_fired_rule(rule_facility))
            evaluated_rules.append(_rule_to_evaluated_rule(rule_facility, "failed"))
            has_review = True
            missing_evidence.append("Proof of corrected critical facility violations")
            next_steps.append("Remediate critical inspection violations and provide documentation")
    elif "minor" in inspection_status:
        if rule_facility:
            evaluated_rules.append(_rule_to_evaluated_rule(rule_facility, "info"))
            satisfied_requirements.append("Minor facility violations noted (acceptable)")
    else:
        if rule_facility:
            evaluated_rules.append(_rule_to_evaluated_rule(rule_facility, "passed"))
            satisfied_requirements.append("Facility meets NYS pharmacy standards")
    
    # Rule 6: I-STOP PMP Compliance (REVIEW)
    rule_istop = next((r for r in rules if r["id"] == "ny_pharm_pdmp_006"), None)
    if not evidence.get("istop_compliant", True):
        if rule_istop:
            fired_rules.append(_rule_to_fired_rule(rule_istop))
            evaluated_rules.append(_rule_to_evaluated_rule(rule_istop, "failed"))
            has_review = True
            violations = evidence.get("istop_violations_count", 0)
            missing_evidence.append(f"I-STOP compliance ({violations} violations found)")
            next_steps.append("Address I-STOP prescription monitoring program violations")
    else:
        if rule_istop:
            evaluated_rules.append(_rule_to_evaluated_rule(rule_istop, "passed"))
            satisfied_requirements.append("I-STOP PMP compliance verified")
    
    # Rule 7: Staffing Ratios (REVIEW)
    rule_staffing = next((r for r in rules if r["id"] == "ny_pharm_staffing_007"), None)
    if not evidence.get("pharmacist_technician_ratio_compliant", True):
        if rule_staffing:
            fired_rules.append(_rule_to_fired_rule(rule_staffing))
            evaluated_rules.append(_rule_to_evaluated_rule(rule_staffing, "failed"))
            has_review = True
            missing_evidence.append("Pharmacist-to-technician ratio documentation")
            next_steps.append("Adjust staffing to meet NYS supervision requirements")
    
    # Rule 8: Prescription Records Retention (REVIEW)
    rule_records = next((r for r in rules if r["id"] == "ny_pharm_records_008"), None)
    if not evidence.get("prescription_records_complete", True):
        if rule_records:
            fired_rules.append(_rule_to_fired_rule(rule_records))
            evaluated_rules.append(_rule_to_evaluated_rule(rule_records, "failed"))
            has_review = True
            missing_evidence.append("Complete prescription records (5-year retention)")
            next_steps.append("Provide proof of prescription recordkeeping compliance")
    
    # Rule 9: Compounding Registration (REVIEW)
    rule_compounding = next((r for r in rules if r["id"] == "ny_pharm_compounding_009"), None)
    does_compounding = evidence.get("does_compounding", False)
    is_registered = evidence.get("compounding_facility_registered", False)
    if does_compounding and not is_registered:
        if rule_compounding:
            fired_rules.append(_rule_to_fired_rule(rule_compounding))
            evaluated_rules.append(_rule_to_evaluated_rule(rule_compounding, "failed"))
            has_review = True
            missing_evidence.append("Compounding facility registration with NYSDOH")
            next_steps.append("Register as compounding pharmacy and demonstrate USP compliance")
    
    # Rule 10: Triennial Renewal (INFO)
    rule_renewal = next((r for r in rules if r["id"] == "ny_pharm_renewal_010"), None)
    license_expiry = evidence.get("ny_pharmacy_license_expiry_days", 999)
    if license_expiry < 180 and rule_renewal:
        fired_rules.append(_rule_to_fired_rule(rule_renewal))
        evaluated_rules.append(_rule_to_evaluated_rule(rule_renewal, "info"))
        next_steps.append(f"NY pharmacy license expires in {license_expiry} days - plan for triennial renewal")
    
    # Determine outcome
    if has_block:
        outcome: DecisionOutcome = "blocked"
        explanation = "NY pharmacy license application BLOCKED due to missing critical requirements."
        block_count = len([r for r in fired_rules if r.severity == "block"])
        decision_summary = f"New York pharmacy license cannot be approved due to {block_count} blocking violation(s). Critical regulatory requirements must be satisfied before reapplication."
    elif has_review:
        outcome = "needs_review"
        explanation = "NY pharmacy license application requires MANUAL REVIEW by NYSED/NYSDOH."
        review_count = len([r for r in fired_rules if r.severity == "review"])
        decision_summary = f"New York pharmacy license flagged for manual review based on {review_count} advisory concern(s). A compliance officer will evaluate these items to determine final approval."
    else:
        outcome = "approved"
        explanation = "NY pharmacy license application APPROVED. All requirements met."
        decision_summary = _build_approval_summary(satisfied_requirements, evaluated_rules)
        if not next_steps:
            next_steps.append("Proceed with pharmacy operations in accordance with NY regulations")
    
    sources = [_fired_rule_to_source(fr) for fr in fired_rules]
    
    return NyPharmacyLicenseDecisionResult(
        outcome=outcome,
        fired_rules=fired_rules,
        evaluated_rules=evaluated_rules,
        satisfied_requirements=satisfied_requirements,
        missing_evidence=missing_evidence,
        next_steps=next_steps,
        explanation=explanation,
        decision_summary=decision_summary,
        sources=sources,
    )


def _rule_to_fired_rule(rule: Dict[str, Any]) -> FiredRule:
    """Convert a rule dict to a FiredRule object."""
    snippet = f"{rule['requirement']} — {rule['rationale']}"
    
    return FiredRule(
        id=rule["id"],
        title=rule["title"],
        severity=rule["severity"],
        jurisdiction=rule["jurisdiction"],
        citation=rule["citation_label"],
        rationale=rule["rationale"],
        snippet=snippet,
        requirement=rule["requirement"],
    )


def _rule_to_evaluated_rule(rule: Dict[str, Any], status: str) -> EvaluatedRule:
    """Convert a rule dict to an EvaluatedRule object."""
    return EvaluatedRule(
        id=rule["id"],
        title=rule["title"],
        severity=rule["severity"],
        jurisdiction=rule["jurisdiction"],
        citation=rule["citation_label"],
        rationale=rule["rationale"],
        requirement=rule["requirement"],
        status=status,
    )


def _build_approval_summary(satisfied: List[str], evaluated: List[EvaluatedRule]) -> str:
    """Build a narrative summary for APPROVED outcomes."""
    mandatory_count = len([r for r in evaluated if r.severity == "block" and r.status == "passed"])
    
    summary_parts = [
        f"This New York pharmacy license application has been APPROVED based on complete satisfaction of all mandatory regulatory requirements.",
    ]
    
    if mandatory_count > 0:
        summary_parts.append(f"All {mandatory_count} critical compliance rule(s) were evaluated and passed.")
    
    if satisfied:
        summary_parts.append(f"Evidence confirmed: {len(satisfied)} requirement(s) verified.")
    
    summary_parts.append("The pharmacy is authorized to operate in New York State in accordance with Education Law Article 137 and 8 NYCRR Part 63.")
    
    return " ".join(summary_parts)


def _fired_rule_to_source(fired_rule: FiredRule) -> RegulatorySource:
    """Convert a FiredRule to RegulatorySource for API compatibility."""
    return RegulatorySource(
        id=fired_rule.id,
        label=fired_rule.title,
        jurisdiction=fired_rule.jurisdiction,
        citation=fired_rule.citation,
        snippet=fired_rule.snippet,
        score=1.0,
        raw_score=1.0,
        source_type="rule",
    )


# Mock Scenarios for Testing
def get_mock_scenarios() -> Dict[str, Dict[str, Any]]:
    """
    Returns 3 mock scenarios for testing the evaluator.
    
    Scenario keys: "blocked", "needs_review", "approved"
    """
    return {
        "blocked": {
            "name": "BLOCKED - No BNE Registration",
            "description": "Valid pharmacy license but missing BNE controlled substance registration",
            "evidence": {
                "ny_pharmacy_license_valid": True,
                "ny_pharmacy_license_expiry_days": 400,
                "has_pharmacist_in_charge": True,
                "pic_license_status": "Active",
                "nysdoh_registered": True,
                "nysdoh_registration_expiry_days": 500,
                "bne_registered": False,  # BLOCKING
                "bne_registration_expiry_days": 0,
                "facility_inspection_status": "Pass",
                "istop_compliant": True,
                "istop_violations_count": 0,
                "pharmacist_technician_ratio_compliant": True,
                "prescription_records_complete": True,
                "compounding_facility_registered": False,
                "does_compounding": False,
            }
        },
        "needs_review": {
            "name": "NEEDS REVIEW - I-STOP Violations + Facility Issues",
            "description": "Valid licenses but I-STOP violations and critical facility findings",
            "evidence": {
                "ny_pharmacy_license_valid": True,
                "ny_pharmacy_license_expiry_days": 300,
                "has_pharmacist_in_charge": True,
                "pic_license_status": "Active",
                "nysdoh_registered": True,
                "nysdoh_registration_expiry_days": 400,
                "bne_registered": True,
                "bne_registration_expiry_days": 300,
                "facility_inspection_status": "Critical Violations",  # REVIEW
                "istop_compliant": False,  # REVIEW
                "istop_violations_count": 3,
                "pharmacist_technician_ratio_compliant": True,
                "prescription_records_complete": False,  # REVIEW
                "compounding_facility_registered": False,
                "does_compounding": False,
            }
        },
        "approved": {
            "name": "APPROVED - All Requirements Met",
            "description": "Valid licenses, clean inspections, I-STOP compliant",
            "evidence": {
                "ny_pharmacy_license_valid": True,
                "ny_pharmacy_license_expiry_days": 600,
                "has_pharmacist_in_charge": True,
                "pic_license_status": "Active",
                "nysdoh_registered": True,
                "nysdoh_registration_expiry_days": 700,
                "bne_registered": True,
                "bne_registration_expiry_days": 500,
                "facility_inspection_status": "Pass",
                "istop_compliant": True,
                "istop_violations_count": 0,
                "pharmacist_technician_ratio_compliant": True,
                "prescription_records_complete": True,
                "compounding_facility_registered": False,
                "does_compounding": False,
            }
        },
    }
