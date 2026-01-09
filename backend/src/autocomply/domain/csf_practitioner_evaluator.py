"""
Deterministic CSF Practitioner Decision Evaluator

This module evaluates CSF practitioner applications against the seeded knowledge rules
and returns a structured decision with fired rules, missing evidence, and next steps.

NO LLM CALLS - purely rule-based evaluation for demo/testing purposes.
"""

from typing import Dict, Any, List, Literal, Optional
from pydantic import BaseModel, Field

from src.autocomply.regulations.csf_practitioner_seed import get_csf_practitioner_rules
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


class CsfPractitionerDecisionResult(BaseModel):
    """Result of evaluating a CSF practitioner application."""
    outcome: DecisionOutcome
    fired_rules: List[FiredRule] = Field(default_factory=list)
    evaluated_rules: List[EvaluatedRule] = Field(default_factory=list)  # NEW: all rules checked
    satisfied_requirements: List[str] = Field(default_factory=list)  # NEW: requirements met
    missing_evidence: List[str] = Field(default_factory=list)
    next_steps: List[str] = Field(default_factory=list)
    explanation: str = ""
    decision_summary: str = ""  # NEW: narrative explanation
    sources: List[RegulatorySource] = Field(default_factory=list)


def evaluate_csf_practitioner_decision(
    evidence: Dict[str, Any],
    decision_type: str = "csf_practitioner",
) -> CsfPractitionerDecisionResult:
    """
    Evaluate a CSF practitioner application using deterministic rules.
    
    Args:
        evidence: Dictionary containing:
            - dea_registration: bool (has valid DEA)
            - dea_expiry_days: int (days until DEA expires)
            - state_license_status: str ("Active", "Expired", "Suspended", etc.)
            - state_license_expiry_days: int
            - authorized_schedules: List[str] (e.g., ["II", "III", "IV", "V"])
            - requested_schedules: List[str]
            - has_prior_violations: bool
            - telemedicine_practice: bool
            - has_ryan_haight_attestation: bool
            - multi_state: bool
            - documented_jurisdictions: List[str]
            - has_npi: bool
        decision_type: Always "csf_practitioner" for this evaluator
    
    Returns:
        CsfPractitionerDecisionResult with outcome, fired_rules, missing_evidence, next_steps
    """
    
    rules = get_csf_practitioner_rules()
    fired_rules: List[FiredRule] = []
    evaluated_rules: List[EvaluatedRule] = []
    satisfied_requirements: List[str] = []
    missing_evidence: List[str] = []
    next_steps: List[str] = []
    
    # Track highest severity triggered
    has_block = False
    has_review = False
    
    # Rule 1: DEA Registration (BLOCK)
    rule_dea = next((r for r in rules if r["id"] == "csf_pract_dea_001"), None)
    if not evidence.get("dea_registration", False):
        if rule_dea:
            fired_rules.append(_rule_to_fired_rule(rule_dea))
            evaluated_rules.append(_rule_to_evaluated_rule(rule_dea, "failed"))
            has_block = True
            missing_evidence.append("Valid DEA registration certificate")
            next_steps.append("Obtain or renew DEA registration before reapplying")
    else:
        if rule_dea:
            evaluated_rules.append(_rule_to_evaluated_rule(rule_dea, "passed"))
            satisfied_requirements.append("Valid DEA registration confirmed")
    
    # Rule 2: State License (BLOCK)
    rule_state = next((r for r in rules if r["id"] == "csf_pract_state_002"), None)
    state_status = evidence.get("state_license_status", "").lower()
    if state_status not in ["active", "current"]:
        if rule_state:
            fired_rules.append(_rule_to_fired_rule(rule_state))
            evaluated_rules.append(_rule_to_evaluated_rule(rule_state, "failed"))
            has_block = True
            if state_status == "expired":
                missing_evidence.append("Current state medical/pharmacy license")
                next_steps.append("Renew expired state license")
            elif state_status == "suspended":
                missing_evidence.append("Active state license (currently suspended)")
                next_steps.append("Resolve license suspension with state board")
            else:
                missing_evidence.append("Active state license")
                next_steps.append("Provide proof of active state medical/pharmacy license")
    else:
        if rule_state:
            evaluated_rules.append(_rule_to_evaluated_rule(rule_state, "passed"))
            satisfied_requirements.append(f"Active state license: {state_status.upper()}")
    
    # Rule 3: Schedule Authorization (BLOCK)
    rule_schedule = next((r for r in rules if r["id"] == "csf_pract_schedule_003"), None)
    authorized = set(evidence.get("authorized_schedules", []))
    requested = set(evidence.get("requested_schedules", []))
    if requested and not requested.issubset(authorized):
        if rule_schedule:
            fired_rules.append(_rule_to_fired_rule(rule_schedule))
            evaluated_rules.append(_rule_to_evaluated_rule(rule_schedule, "failed"))
            has_block = True
            unauthorized = requested - authorized
            missing_evidence.append(f"DEA authorization for schedules: {', '.join(sorted(unauthorized))}")
            next_steps.append(f"Update DEA registration to include schedules {', '.join(sorted(unauthorized))}")
    else:
        if rule_schedule and requested:
            evaluated_rules.append(_rule_to_evaluated_rule(rule_schedule, "passed"))
            satisfied_requirements.append(f"Schedule authorization confirmed: {', '.join(sorted(requested))}")
    
    # Rule 4: Expiry Buffer (REVIEW)
    dea_days = evidence.get("dea_expiry_days", 999)
    state_days = evidence.get("state_license_expiry_days", 999)
    if dea_days < 30 or state_days < 30:
        rule = next((r for r in rules if r["id"] == "csf_pract_exp_004"), None)
        if rule:
            fired_rules.append(_rule_to_fired_rule(rule))
            has_review = True
            if dea_days < 30:
                missing_evidence.append(f"DEA expiring in {dea_days} days (needs 30+ day buffer)")
                next_steps.append("Renew DEA registration or provide renewal confirmation")
            if state_days < 30:
                missing_evidence.append(f"State license expiring in {state_days} days (needs 30+ day buffer)")
                next_steps.append("Renew state license or provide renewal confirmation")
    
    # Rule 5: Prior Violations (REVIEW)
    if evidence.get("has_prior_violations", False):
        rule = next((r for r in rules if r["id"] == "csf_pract_history_005"), None)
        if rule:
            fired_rules.append(_rule_to_fired_rule(rule))
            has_review = True
            next_steps.append("Application flagged for compliance review due to prior DEA violations")
    
    # Rule 6: Ryan Haight Attestation (REVIEW)
    if evidence.get("telemedicine_practice", False) and not evidence.get("has_ryan_haight_attestation", False):
        rule = next((r for r in rules if r["id"] == "csf_pract_attestation_006"), None)
        if rule:
            fired_rules.append(_rule_to_fired_rule(rule))
            has_review = True
            missing_evidence.append("Ryan Haight Act compliance attestation for telemedicine")
            next_steps.append("Complete Ryan Haight Act attestation form")
    
    # Rule 7: Multi-State Documentation (REVIEW)
    if evidence.get("multi_state", False):
        documented = set(evidence.get("documented_jurisdictions", []))
        # If multi-state but incomplete documentation, flag for review
        if len(documented) < 2:  # Assuming multi-state means at least 2 jurisdictions
            rule = next((r for r in rules if r["id"] == "csf_pract_multistate_007"), None)
            if rule:
                fired_rules.append(_rule_to_fired_rule(rule))
                has_review = True
                missing_evidence.append("Complete license documentation for all practice jurisdictions")
                next_steps.append("Provide active license proof for each state of practice")
    
    # Rule 8: NPI Recommendation (INFO)
    rule_npi = next((r for r in rules if r["id"] == "csf_pract_npi_008"), None)
    if not evidence.get("has_npi", False):
        if rule_npi:
            fired_rules.append(_rule_to_fired_rule(rule_npi))
            evaluated_rules.append(_rule_to_evaluated_rule(rule_npi, "info"))
            next_steps.append("Consider providing NPI number to expedite verification")
    else:
        if rule_npi:
            evaluated_rules.append(_rule_to_evaluated_rule(rule_npi, "passed"))
            satisfied_requirements.append("NPI number provided for verification")
    
    # Rule 9 (INFO) - proactive renewal
    rule_renewal = next((r for r in rules if r["id"] == "csf_pract_renewal_009"), None)
    if rule_renewal and dea_days < 90:
        fired_rules.append(_rule_to_fired_rule(rule_renewal))
        evaluated_rules.append(_rule_to_evaluated_rule(rule_renewal, "info"))
    
    # Determine outcome
    if has_block:
        outcome: DecisionOutcome = "blocked"
        explanation = "Application BLOCKED due to missing critical requirements. Address blocking issues before reapplying."
        decision_summary = f"Application cannot proceed due to {len([r for r in fired_rules if r.severity == 'block'])} blocking violation(s). Critical regulatory requirements must be satisfied before reapplication."
    elif has_review:
        outcome = "needs_review"
        explanation = "Application requires MANUAL REVIEW. A compliance officer will evaluate the flagged items."
        decision_summary = f"Application flagged for manual review based on {len([r for r in fired_rules if r.severity == 'review'])} advisory concern(s). A compliance officer will evaluate these items to determine final approval."
    else:
        outcome = "approved"
        explanation = "Application APPROVED. All critical requirements met."
        decision_summary = _build_approval_summary(satisfied_requirements, evaluated_rules)
        if not next_steps:
            next_steps.append("Proceed with controlled substance checkout as authorized")
    
    # Convert fired rules to sources for compatibility
    sources = [_fired_rule_to_source(fr) for fr in fired_rules]
    
    return CsfPractitionerDecisionResult(
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
    advisory_count = len([r for r in evaluated if r.severity == "review" and r.status == "info"])
    
    summary_parts = [
        f"This application has been APPROVED based on complete satisfaction of all mandatory regulatory requirements.",
    ]
    
    if mandatory_count > 0:
        summary_parts.append(f"All {mandatory_count} critical compliance rule(s) were evaluated and passed.")
    
    if satisfied:
        summary_parts.append(f"Evidence confirmed: {len(satisfied)} requirement(s) verified.")
    
    summary_parts.append("The practitioner is authorized to proceed with controlled substance operations as specified in their DEA registration.")
    
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
            "name": "BLOCKED - Missing DEA Registration",
            "description": "Practitioner has no valid DEA registration",
            "evidence": {
                "dea_registration": False,  # BLOCKING
                "dea_expiry_days": 0,
                "state_license_status": "Active",
                "state_license_expiry_days": 180,
                "authorized_schedules": [],
                "requested_schedules": ["II", "III", "IV", "V"],
                "has_prior_violations": False,
                "telemedicine_practice": False,
                "has_ryan_haight_attestation": False,
                "multi_state": False,
                "documented_jurisdictions": ["OH"],
                "has_npi": True,
            }
        },
        "needs_review": {
            "name": "NEEDS REVIEW - DEA Expiring Soon + Telemedicine Missing Attestation",
            "description": "Valid credentials but DEA expires in 20 days and missing Ryan Haight attestation",
            "evidence": {
                "dea_registration": True,
                "dea_expiry_days": 20,  # REVIEW - less than 30 days
                "state_license_status": "Active",
                "state_license_expiry_days": 365,
                "authorized_schedules": ["II", "III", "IV", "V"],
                "requested_schedules": ["II", "III", "IV", "V"],
                "has_prior_violations": False,
                "telemedicine_practice": True,  # REVIEW - requires attestation
                "has_ryan_haight_attestation": False,  # REVIEW - missing
                "multi_state": False,
                "documented_jurisdictions": ["OH"],
                "has_npi": True,
            }
        },
        "approved": {
            "name": "APPROVED - All Requirements Met",
            "description": "Valid DEA, state license, all requirements satisfied",
            "evidence": {
                "dea_registration": True,
                "dea_expiry_days": 365,
                "state_license_status": "Active",
                "state_license_expiry_days": 400,
                "authorized_schedules": ["II", "III", "IV", "V"],
                "requested_schedules": ["III", "IV", "V"],
                "has_prior_violations": False,
                "telemedicine_practice": False,
                "has_ryan_haight_attestation": False,
                "multi_state": False,
                "documented_jurisdictions": ["OH"],
                "has_npi": True,
            }
        },
    }
