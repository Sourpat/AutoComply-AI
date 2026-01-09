"""
Deterministic Ohio TDDD License Decision Evaluator

This module evaluates Ohio Terminal Distributor of Dangerous Drugs license applications
against the seeded knowledge rules and returns a structured decision.

NO LLM CALLS - purely rule-based evaluation for demo/testing purposes.
"""

from typing import Dict, Any, List, Literal, Optional
from pydantic import BaseModel, Field

from src.autocomply.regulations.ohio_tddd_seed import get_ohio_tddd_rules
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


class OhioTdddDecisionResult(BaseModel):
    """Result of evaluating an Ohio TDDD license application."""
    outcome: DecisionOutcome
    fired_rules: List[FiredRule] = Field(default_factory=list)
    evaluated_rules: List[EvaluatedRule] = Field(default_factory=list)
    satisfied_requirements: List[str] = Field(default_factory=list)
    missing_evidence: List[str] = Field(default_factory=list)
    next_steps: List[str] = Field(default_factory=list)
    explanation: str = ""
    decision_summary: str = ""
    sources: List[RegulatorySource] = Field(default_factory=list)


def evaluate_ohio_tddd_decision(
    evidence: Dict[str, Any],
    decision_type: str = "ohio_tddd",
) -> OhioTdddDecisionResult:
    """
    Evaluate an Ohio TDDD license application using deterministic rules.
    
    Args:
        evidence: Dictionary containing:
            - tddd_license_valid: bool (has valid Ohio TDDD license)
            - tddd_license_expiry_days: int (days until license expires)
            - tddd_category: str (e.g., "Category I", "Category II")
            - requested_substances: List[str] (dangerous drugs requested)
            - category_authorized_substances: List[str]
            - has_responsible_pharmacist: bool
            - responsible_pharmacist_license: str ("Active", "Expired", etc.)
            - storage_security_compliant: bool
            - recent_inspection_findings: str ("None", "Minor", "Critical")
            - dispensing_protocol_documented: bool
            - wholesale_records_complete: bool
            - oarrs_reporting_current: bool
            - staff_training_documented: bool
        decision_type: Always "ohio_tddd" for this evaluator
    
    Returns:
        OhioTdddDecisionResult with outcome, fired_rules, missing_evidence, next_steps
    """
    
    rules = get_ohio_tddd_rules()
    fired_rules: List[FiredRule] = []
    evaluated_rules: List[EvaluatedRule] = []
    satisfied_requirements: List[str] = []
    missing_evidence: List[str] = []
    next_steps: List[str] = []
    
    has_block = False
    has_review = False
    
    # Rule 1: Valid Ohio TDDD License (BLOCK)
    rule_license = next((r for r in rules if r["id"] == "ohio_tddd_license_001"), None)
    if not evidence.get("tddd_license_valid", False):
        if rule_license:
            fired_rules.append(_rule_to_fired_rule(rule_license))
            evaluated_rules.append(_rule_to_evaluated_rule(rule_license, "failed"))
            has_block = True
            missing_evidence.append("Valid Ohio TDDD license certificate")
            next_steps.append("Obtain Ohio TDDD license from Ohio Board of Pharmacy before reapplying")
    else:
        if rule_license:
            evaluated_rules.append(_rule_to_evaluated_rule(rule_license, "passed"))
            satisfied_requirements.append("Valid Ohio TDDD license confirmed")
    
    # Rule 2: Category Authorization (BLOCK)
    rule_category = next((r for r in rules if r["id"] == "ohio_tddd_category_002"), None)
    requested = set(evidence.get("requested_substances", []))
    authorized = set(evidence.get("category_authorized_substances", []))
    if requested and not requested.issubset(authorized):
        if rule_category:
            fired_rules.append(_rule_to_fired_rule(rule_category))
            evaluated_rules.append(_rule_to_evaluated_rule(rule_category, "failed"))
            has_block = True
            unauthorized = requested - authorized
            missing_evidence.append(f"TDDD category authorization for: {', '.join(sorted(unauthorized))}")
            next_steps.append(f"Upgrade TDDD category to authorize {', '.join(sorted(unauthorized))}")
    else:
        if rule_category and requested:
            evaluated_rules.append(_rule_to_evaluated_rule(rule_category, "passed"))
            category = evidence.get("tddd_category", "Unknown")
            satisfied_requirements.append(f"TDDD {category} authorizes all requested substances")
    
    # Rule 3: Responsible Pharmacist (BLOCK)
    rule_rph = next((r for r in rules if r["id"] == "ohio_tddd_rph_003"), None)
    if not evidence.get("has_responsible_pharmacist", False):
        if rule_rph:
            fired_rules.append(_rule_to_fired_rule(rule_rph))
            evaluated_rules.append(_rule_to_evaluated_rule(rule_rph, "failed"))
            has_block = True
            missing_evidence.append("Designated responsible pharmacist with active Ohio license")
            next_steps.append("Designate responsible pharmacist and submit license verification")
    else:
        rph_status = evidence.get("responsible_pharmacist_license", "").lower()
        if rph_status not in ["active", "current"]:
            if rule_rph:
                fired_rules.append(_rule_to_fired_rule(rule_rph))
                evaluated_rules.append(_rule_to_evaluated_rule(rule_rph, "failed"))
                has_block = True
                missing_evidence.append(f"Active pharmacist license (currently {rph_status})")
                next_steps.append("Responsible pharmacist must renew or reinstate Ohio license")
        else:
            if rule_rph:
                evaluated_rules.append(_rule_to_evaluated_rule(rule_rph, "passed"))
                satisfied_requirements.append("Responsible pharmacist with active Ohio license designated")
    
    # Rule 4: Storage Security (REVIEW)
    rule_storage = next((r for r in rules if r["id"] == "ohio_tddd_storage_004"), None)
    if not evidence.get("storage_security_compliant", True):
        if rule_storage:
            fired_rules.append(_rule_to_fired_rule(rule_storage))
            evaluated_rules.append(_rule_to_evaluated_rule(rule_storage, "failed"))
            has_review = True
            missing_evidence.append("Proof of secure storage facility (locked cabinets/safes)")
            next_steps.append("Submit facility security documentation for review")
    else:
        if rule_storage:
            evaluated_rules.append(_rule_to_evaluated_rule(rule_storage, "passed"))
            satisfied_requirements.append("Secure storage facility standards met")
    
    # Rule 5: Inspection History (REVIEW)
    rule_inspection = next((r for r in rules if r["id"] == "ohio_tddd_inspection_005"), None)
    findings = evidence.get("recent_inspection_findings", "None").lower()
    if findings == "critical":
        if rule_inspection:
            fired_rules.append(_rule_to_fired_rule(rule_inspection))
            evaluated_rules.append(_rule_to_evaluated_rule(rule_inspection, "failed"))
            has_review = True
            missing_evidence.append("Evidence of corrected critical inspection violations")
            next_steps.append("Provide Board of Pharmacy proof of violation remediation")
    elif findings == "minor":
        if rule_inspection:
            evaluated_rules.append(_rule_to_evaluated_rule(rule_inspection, "info"))
            satisfied_requirements.append("Minor inspection findings noted (acceptable)")
    else:
        if rule_inspection:
            evaluated_rules.append(_rule_to_evaluated_rule(rule_inspection, "passed"))
            satisfied_requirements.append("Clean inspection history confirmed")
    
    # Rule 6: Dispensing Protocol (REVIEW)
    rule_dispensing = next((r for r in rules if r["id"] == "ohio_tddd_dispensing_006"), None)
    if not evidence.get("dispensing_protocol_documented", True):
        if rule_dispensing:
            fired_rules.append(_rule_to_fired_rule(rule_dispensing))
            evaluated_rules.append(_rule_to_evaluated_rule(rule_dispensing, "failed"))
            has_review = True
            missing_evidence.append("Documented dispensing protocols and procedures")
            next_steps.append("Submit dispensing standard operating procedures for review")
    
    # Rule 7: Wholesale Records (REVIEW)
    rule_wholesale = next((r for r in rules if r["id"] == "ohio_tddd_wholesale_007"), None)
    if not evidence.get("wholesale_records_complete", True):
        if rule_wholesale:
            fired_rules.append(_rule_to_fired_rule(rule_wholesale))
            evaluated_rules.append(_rule_to_evaluated_rule(rule_wholesale, "failed"))
            has_review = True
            missing_evidence.append("Complete wholesale distribution pedigree documentation")
            next_steps.append("Provide distributor credentials and transaction records")
    
    # Rule 8: Biennial Renewal (INFO)
    rule_renewal = next((r for r in rules if r["id"] == "ohio_tddd_renewal_008"), None)
    expiry_days = evidence.get("tddd_license_expiry_days", 999)
    if expiry_days < 90 and rule_renewal:
        fired_rules.append(_rule_to_fired_rule(rule_renewal))
        evaluated_rules.append(_rule_to_evaluated_rule(rule_renewal, "info"))
        next_steps.append(f"TDDD license expires in {expiry_days} days - plan for renewal")
    
    # Rule 9: OARRS Reporting (INFO)
    rule_reporting = next((r for r in rules if r["id"] == "ohio_tddd_reporting_009"), None)
    if not evidence.get("oarrs_reporting_current", True) and rule_reporting:
        fired_rules.append(_rule_to_fired_rule(rule_reporting))
        evaluated_rules.append(_rule_to_evaluated_rule(rule_reporting, "info"))
        next_steps.append("Ensure OARRS inventory reporting is current")
    
    # Rule 10: Staff Training (INFO)
    rule_training = next((r for r in rules if r["id"] == "ohio_tddd_training_010"), None)
    if not evidence.get("staff_training_documented", True) and rule_training:
        fired_rules.append(_rule_to_fired_rule(rule_training))
        evaluated_rules.append(_rule_to_evaluated_rule(rule_training, "info"))
        next_steps.append("Document staff training on dangerous drug handling")
    
    # Determine outcome
    if has_block:
        outcome: DecisionOutcome = "blocked"
        explanation = "License application BLOCKED due to missing critical requirements."
        block_count = len([r for r in fired_rules if r.severity == "block"])
        decision_summary = f"Ohio TDDD license cannot be approved due to {block_count} blocking violation(s). Critical regulatory requirements must be satisfied before reapplication."
    elif has_review:
        outcome = "needs_review"
        explanation = "License application requires MANUAL REVIEW by Ohio Board of Pharmacy."
        review_count = len([r for r in fired_rules if r.severity == "review"])
        decision_summary = f"Ohio TDDD license flagged for manual review based on {review_count} advisory concern(s). A compliance officer will evaluate these items to determine final approval."
    else:
        outcome = "approved"
        explanation = "Ohio TDDD license application APPROVED. All requirements met."
        decision_summary = _build_approval_summary(satisfied_requirements, evaluated_rules)
        if not next_steps:
            next_steps.append("Proceed with dangerous drug distribution as authorized by TDDD category")
    
    sources = [_fired_rule_to_source(fr) for fr in fired_rules]
    
    return OhioTdddDecisionResult(
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
        f"This Ohio TDDD license application has been APPROVED based on complete satisfaction of all mandatory regulatory requirements.",
    ]
    
    if mandatory_count > 0:
        summary_parts.append(f"All {mandatory_count} critical compliance rule(s) were evaluated and passed.")
    
    if satisfied:
        summary_parts.append(f"Evidence confirmed: {len(satisfied)} requirement(s) verified.")
    
    summary_parts.append("The facility is authorized to distribute dangerous drugs as specified in the TDDD category.")
    
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
            "name": "BLOCKED - No Responsible Pharmacist",
            "description": "Valid TDDD license but no designated responsible pharmacist",
            "evidence": {
                "tddd_license_valid": True,
                "tddd_license_expiry_days": 365,
                "tddd_category": "Category II",
                "requested_substances": ["Oxycodone", "Hydrocodone"],
                "category_authorized_substances": ["Oxycodone", "Hydrocodone", "Morphine", "Fentanyl"],
                "has_responsible_pharmacist": False,  # BLOCKING
                "responsible_pharmacist_license": "",
                "storage_security_compliant": True,
                "recent_inspection_findings": "None",
                "dispensing_protocol_documented": True,
                "wholesale_records_complete": True,
                "oarrs_reporting_current": True,
                "staff_training_documented": True,
            }
        },
        "needs_review": {
            "name": "NEEDS REVIEW - Critical Inspection Findings",
            "description": "Valid license but recent critical inspection violations",
            "evidence": {
                "tddd_license_valid": True,
                "tddd_license_expiry_days": 200,
                "tddd_category": "Category I",
                "requested_substances": ["Oxycodone"],
                "category_authorized_substances": ["Oxycodone", "Hydrocodone"],
                "has_responsible_pharmacist": True,
                "responsible_pharmacist_license": "Active",
                "storage_security_compliant": True,
                "recent_inspection_findings": "Critical",  # REVIEW
                "dispensing_protocol_documented": False,  # REVIEW
                "wholesale_records_complete": True,
                "oarrs_reporting_current": True,
                "staff_training_documented": True,
            }
        },
        "approved": {
            "name": "APPROVED - All Requirements Met",
            "description": "Valid TDDD license, responsible pharmacist, clean record",
            "evidence": {
                "tddd_license_valid": True,
                "tddd_license_expiry_days": 500,
                "tddd_category": "Category III",
                "requested_substances": ["Hydrocodone", "Tramadol"],
                "category_authorized_substances": ["Hydrocodone", "Tramadol", "Codeine"],
                "has_responsible_pharmacist": True,
                "responsible_pharmacist_license": "Active",
                "storage_security_compliant": True,
                "recent_inspection_findings": "None",
                "dispensing_protocol_documented": True,
                "wholesale_records_complete": True,
                "oarrs_reporting_current": True,
                "staff_training_documented": True,
            }
        },
    }
