"""
Deterministic CSF Facility Decision Evaluator

This module evaluates CSF facility (hospital/clinic) applications against the seeded
knowledge rules and returns a structured decision.

NO LLM CALLS - purely rule-based evaluation for demo/testing purposes.
"""

from typing import Dict, Any, List, Literal, Optional
from pydantic import BaseModel, Field

from src.autocomply.regulations.csf_facility_seed import get_csf_facility_rules
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


class CsfFacilityDecisionResult(BaseModel):
    """Result of evaluating a CSF facility application."""
    outcome: DecisionOutcome
    fired_rules: List[FiredRule] = Field(default_factory=list)
    evaluated_rules: List[EvaluatedRule] = Field(default_factory=list)
    satisfied_requirements: List[str] = Field(default_factory=list)
    missing_evidence: List[str] = Field(default_factory=list)
    next_steps: List[str] = Field(default_factory=list)
    explanation: str = ""
    decision_summary: str = ""
    sources: List[RegulatorySource] = Field(default_factory=list)


def evaluate_csf_facility_decision(
    evidence: Dict[str, Any],
    decision_type: str = "csf_facility",
) -> CsfFacilityDecisionResult:
    """
    Evaluate a CSF facility (hospital/clinic) application using deterministic rules.
    
    Args:
        evidence: Dictionary containing:
            - facility_dea_registration: bool
            - facility_dea_expiry_days: int
            - state_facility_license_status: str ("Active", "Expired", "Suspended")
            - state_facility_license_expiry_days: int
            - has_responsible_pharmacist: bool
            - responsible_pharmacist_dea: bool
            - responsible_person_type: str ("pharmacist", "physician", "none")
            - storage_security_compliant: bool
            - storage_has_locked_cabinets: bool
            - recordkeeping_system_compliant: bool
            - records_retention_years: int
            - biennial_inventory_current: bool
            - last_inventory_days_ago: int
            - diversion_prevention_program: bool
            - staff_training_documented: bool
            - theft_loss_procedures_documented: bool
            - recent_inspection_findings: str ("None", "Minor", "Critical")
        decision_type: Always "csf_facility" for this evaluator
    
    Returns:
        CsfFacilityDecisionResult with outcome, fired_rules, missing_evidence, next_steps
    """
    
    rules = get_csf_facility_rules()
    fired_rules: List[FiredRule] = []
    evaluated_rules: List[EvaluatedRule] = []
    satisfied_requirements: List[str] = []
    missing_evidence: List[str] = []
    next_steps: List[str] = []
    
    has_block = False
    has_review = False
    
    # Rule 1: Valid DEA Registration (BLOCK)
    rule_dea = next((r for r in rules if r["id"] == "csf_facility_dea_001"), None)
    if not evidence.get("facility_dea_registration", False):
        if rule_dea:
            fired_rules.append(_rule_to_fired_rule(rule_dea))
            evaluated_rules.append(_rule_to_evaluated_rule(rule_dea, "failed"))
            has_block = True
            missing_evidence.append("Valid DEA registration for healthcare facility")
            next_steps.append("Obtain DEA registration for facility before reapplying")
    else:
        if rule_dea:
            evaluated_rules.append(_rule_to_evaluated_rule(rule_dea, "passed"))
            satisfied_requirements.append("Valid facility DEA registration confirmed")
    
    # Rule 2: State Facility License (BLOCK)
    rule_state = next((r for r in rules if r["id"] == "csf_facility_state_002"), None)
    facility_status = evidence.get("state_facility_license_status", "").lower()
    if facility_status not in ["active", "current", "licensed"]:
        if rule_state:
            fired_rules.append(_rule_to_fired_rule(rule_state))
            evaluated_rules.append(_rule_to_evaluated_rule(rule_state, "failed"))
            has_block = True
            missing_evidence.append(f"Active state healthcare facility license (currently {facility_status})")
            next_steps.append("Renew or reinstate state healthcare facility license")
    else:
        if rule_state:
            evaluated_rules.append(_rule_to_evaluated_rule(rule_state, "passed"))
            satisfied_requirements.append(f"State healthcare facility license: {facility_status.upper()}")
    
    # Rule 3: Responsible Pharmacist/Physician (BLOCK)
    rule_responsible = next((r for r in rules if r["id"] == "csf_facility_responsible_003"), None)
    responsible_type = evidence.get("responsible_person_type", "none").lower()
    if responsible_type == "none":
        if rule_responsible:
            fired_rules.append(_rule_to_fired_rule(rule_responsible))
            evaluated_rules.append(_rule_to_evaluated_rule(rule_responsible, "failed"))
            has_block = True
            missing_evidence.append("Designated responsible pharmacist or physician with DEA registration")
            next_steps.append("Designate responsible pharmacist or physician for controlled substance management")
    else:
        # Check if responsible person has DEA
        if not evidence.get("responsible_pharmacist_dea", False):
            if rule_responsible:
                fired_rules.append(_rule_to_fired_rule(rule_responsible))
                evaluated_rules.append(_rule_to_evaluated_rule(rule_responsible, "failed"))
                has_block = True
                missing_evidence.append(f"DEA registration for responsible {responsible_type}")
                next_steps.append(f"Responsible {responsible_type} must obtain DEA registration")
        else:
            if rule_responsible:
                evaluated_rules.append(_rule_to_evaluated_rule(rule_responsible, "passed"))
                satisfied_requirements.append(f"Responsible {responsible_type} with DEA registration designated")
    
    # Rule 4: Storage Security (BLOCK)
    rule_storage = next((r for r in rules if r["id"] == "csf_facility_storage_004"), None)
    if not evidence.get("storage_security_compliant", False):
        if rule_storage:
            fired_rules.append(_rule_to_fired_rule(rule_storage))
            evaluated_rules.append(_rule_to_evaluated_rule(rule_storage, "failed"))
            has_block = True
            if not evidence.get("storage_has_locked_cabinets", False):
                missing_evidence.append("Locked cabinets/safes for controlled substance storage")
                next_steps.append("Install DEA-compliant locked storage for controlled substances")
            else:
                missing_evidence.append("Complete storage security documentation")
                next_steps.append("Provide proof of DEA-compliant storage security measures")
    else:
        if rule_storage:
            evaluated_rules.append(_rule_to_evaluated_rule(rule_storage, "passed"))
            satisfied_requirements.append("DEA-compliant storage security confirmed")
    
    # Rule 5: Recordkeeping System (BLOCK)
    rule_recordkeeping = next((r for r in rules if r["id"] == "csf_facility_recordkeeping_005"), None)
    if not evidence.get("recordkeeping_system_compliant", False):
        if rule_recordkeeping:
            fired_rules.append(_rule_to_fired_rule(rule_recordkeeping))
            evaluated_rules.append(_rule_to_evaluated_rule(rule_recordkeeping, "failed"))
            has_block = True
            retention_years = evidence.get("records_retention_years", 0)
            if retention_years < 2:
                missing_evidence.append(f"2-year minimum recordkeeping (currently {retention_years} years)")
                next_steps.append("Implement DEA-compliant recordkeeping with 2+ year retention")
            else:
                missing_evidence.append("Complete controlled substance recordkeeping system")
                next_steps.append("Provide documentation of recordkeeping procedures and audit trails")
    else:
        if rule_recordkeeping:
            evaluated_rules.append(_rule_to_evaluated_rule(rule_recordkeeping, "passed"))
            satisfied_requirements.append("DEA-compliant recordkeeping system confirmed")
    
    # Rule 6: Biennial Inventory (REVIEW)
    rule_inventory = next((r for r in rules if r["id"] == "csf_facility_inventory_006"), None)
    if not evidence.get("biennial_inventory_current", True):
        if rule_inventory:
            fired_rules.append(_rule_to_fired_rule(rule_inventory))
            evaluated_rules.append(_rule_to_evaluated_rule(rule_inventory, "failed"))
            has_review = True
            days_ago = evidence.get("last_inventory_days_ago", 999)
            missing_evidence.append(f"Current biennial inventory (last completed {days_ago} days ago)")
            next_steps.append("Conduct and document comprehensive controlled substance inventory")
    else:
        if rule_inventory:
            evaluated_rules.append(_rule_to_evaluated_rule(rule_inventory, "passed"))
            satisfied_requirements.append("Biennial controlled substance inventory current")
    
    # Rule 7: Diversion Prevention Program (REVIEW)
    rule_diversion = next((r for r in rules if r["id"] == "csf_facility_diversion_007"), None)
    if not evidence.get("diversion_prevention_program", True):
        if rule_diversion:
            fired_rules.append(_rule_to_fired_rule(rule_diversion))
            evaluated_rules.append(_rule_to_evaluated_rule(rule_diversion, "failed"))
            has_review = True
            missing_evidence.append("Documented diversion prevention and monitoring program")
            next_steps.append("Implement diversion prevention program with audit trails and variance investigations")
    
    # Rule 8: Staff Training (REVIEW)
    rule_staff = next((r for r in rules if r["id"] == "csf_facility_staff_008"), None)
    if not evidence.get("staff_training_documented", True):
        if rule_staff:
            fired_rules.append(_rule_to_fired_rule(rule_staff))
            evaluated_rules.append(_rule_to_evaluated_rule(rule_staff, "failed"))
            has_review = True
            missing_evidence.append("Staff training documentation on controlled substance handling")
            next_steps.append("Document staff training on DEA regulations and security procedures")
    
    # Rule 9: Theft/Loss Procedures (REVIEW)
    rule_theft = next((r for r in rules if r["id"] == "csf_facility_theft_009"), None)
    if not evidence.get("theft_loss_procedures_documented", True):
        if rule_theft:
            fired_rules.append(_rule_to_fired_rule(rule_theft))
            evaluated_rules.append(_rule_to_evaluated_rule(rule_theft, "failed"))
            has_review = True
            missing_evidence.append("Theft/loss reporting and investigation procedures")
            next_steps.append("Document procedures for reporting controlled substance theft or loss to DEA")
    
    # Rule 10: Inspection Compliance (REVIEW)
    rule_inspection = next((r for r in rules if r["id"] == "csf_facility_inspection_010"), None)
    findings = evidence.get("recent_inspection_findings", "None").lower()
    if "critical" in findings:
        if rule_inspection:
            fired_rules.append(_rule_to_fired_rule(rule_inspection))
            evaluated_rules.append(_rule_to_evaluated_rule(rule_inspection, "failed"))
            has_review = True
            missing_evidence.append("Proof of corrected critical DEA inspection violations")
            next_steps.append("Remediate critical inspection findings and provide DEA verification")
    
    # Rule 11: DEA Renewal (INFO)
    rule_renewal = next((r for r in rules if r["id"] == "csf_facility_renewal_011"), None)
    dea_expiry = evidence.get("facility_dea_expiry_days", 999)
    if dea_expiry < 180 and rule_renewal:
        fired_rules.append(_rule_to_fired_rule(rule_renewal))
        evaluated_rules.append(_rule_to_evaluated_rule(rule_renewal, "info"))
        next_steps.append(f"Facility DEA registration expires in {dea_expiry} days - plan for renewal")
    
    # Determine outcome
    if has_block:
        outcome: DecisionOutcome = "blocked"
        explanation = "CSF facility application BLOCKED due to missing critical requirements."
        block_count = len([r for r in fired_rules if r.severity == "block"])
        decision_summary = f"CSF facility registration cannot be approved due to {block_count} blocking violation(s). Critical regulatory requirements must be satisfied before reapplication."
    elif has_review:
        outcome = "needs_review"
        explanation = "CSF facility application requires MANUAL REVIEW by DEA compliance officer."
        review_count = len([r for r in fired_rules if r.severity == "review"])
        decision_summary = f"CSF facility registration flagged for manual review based on {review_count} advisory concern(s). A compliance officer will evaluate these items to determine final approval."
    else:
        outcome = "approved"
        explanation = "CSF facility application APPROVED. All requirements met."
        decision_summary = _build_approval_summary(satisfied_requirements, evaluated_rules)
        if not next_steps:
            next_steps.append("Proceed with controlled substance operations as authorized by facility DEA registration")
    
    sources = [_fired_rule_to_source(fr) for fr in fired_rules]
    
    return CsfFacilityDecisionResult(
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
        f"This CSF facility application has been APPROVED based on complete satisfaction of all mandatory regulatory requirements.",
    ]
    
    if mandatory_count > 0:
        summary_parts.append(f"All {mandatory_count} critical compliance rule(s) were evaluated and passed.")
    
    if satisfied:
        summary_parts.append(f"Evidence confirmed: {len(satisfied)} requirement(s) verified.")
    
    summary_parts.append("The facility is authorized to handle controlled substances in accordance with 21 CFR Parts 1301 and 1304.")
    
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
            "name": "BLOCKED - Non-Compliant Storage Security",
            "description": "Valid licenses but inadequate controlled substance storage security",
            "evidence": {
                "facility_dea_registration": True,
                "facility_dea_expiry_days": 500,
                "state_facility_license_status": "Active",
                "state_facility_license_expiry_days": 600,
                "has_responsible_pharmacist": True,
                "responsible_pharmacist_dea": True,
                "responsible_person_type": "pharmacist",
                "storage_security_compliant": False,  # BLOCKING
                "storage_has_locked_cabinets": False,  # BLOCKING
                "recordkeeping_system_compliant": True,
                "records_retention_years": 3,
                "biennial_inventory_current": True,
                "last_inventory_days_ago": 200,
                "diversion_prevention_program": True,
                "staff_training_documented": True,
                "theft_loss_procedures_documented": True,
                "recent_inspection_findings": "None",
            }
        },
        "needs_review": {
            "name": "NEEDS REVIEW - Missing Diversion Program + Critical Inspection Findings",
            "description": "Valid credentials but no diversion prevention and critical violations",
            "evidence": {
                "facility_dea_registration": True,
                "facility_dea_expiry_days": 400,
                "state_facility_license_status": "Active",
                "state_facility_license_expiry_days": 500,
                "has_responsible_pharmacist": True,
                "responsible_pharmacist_dea": True,
                "responsible_person_type": "physician",
                "storage_security_compliant": True,
                "storage_has_locked_cabinets": True,
                "recordkeeping_system_compliant": True,
                "records_retention_years": 2,
                "biennial_inventory_current": False,  # REVIEW
                "last_inventory_days_ago": 800,
                "diversion_prevention_program": False,  # REVIEW
                "staff_training_documented": False,  # REVIEW
                "theft_loss_procedures_documented": True,
                "recent_inspection_findings": "Critical",  # REVIEW
            }
        },
        "approved": {
            "name": "APPROVED - All Requirements Met",
            "description": "Valid DEA, state license, compliant storage, recordkeeping, and procedures",
            "evidence": {
                "facility_dea_registration": True,
                "facility_dea_expiry_days": 700,
                "state_facility_license_status": "Licensed",
                "state_facility_license_expiry_days": 800,
                "has_responsible_pharmacist": True,
                "responsible_pharmacist_dea": True,
                "responsible_person_type": "pharmacist",
                "storage_security_compliant": True,
                "storage_has_locked_cabinets": True,
                "recordkeeping_system_compliant": True,
                "records_retention_years": 5,
                "biennial_inventory_current": True,
                "last_inventory_days_ago": 300,
                "diversion_prevention_program": True,
                "staff_training_documented": True,
                "theft_loss_procedures_documented": True,
                "recent_inspection_findings": "None",
            }
        },
    }
