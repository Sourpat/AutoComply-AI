"""
Rule-based confidence engine for Decision Intelligence.

Provides deterministic, explainable confidence scores based on
explicit validation rules applied to submission fields.
"""

from typing import List, Dict, Any, Optional
from dataclasses import dataclass
from datetime import datetime
import re


@dataclass
class RuleResult:
    """Result of evaluating a single rule."""
    rule_id: str
    passed: bool
    severity: str  # "critical" | "medium" | "low"
    reason: str
    field_path: Optional[str] = None


# Valid US state codes (2-letter abbreviations)
VALID_US_STATES = {
    "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
    "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
    "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
    "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
    "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY",
    "DC"  # District of Columbia
}


def safe_get(data: Dict[str, Any], path: str, default: Any = None) -> Any:
    """
    Safely navigate nested dict using dot notation.
    
    Args:
        data: Dict to navigate
        path: Dot-separated path like "address.state"
        default: Default value if path not found
        
    Returns:
        Value at path or default
        
    Example:
        >>> safe_get({"address": {"state": "CA"}}, "address.state")
        'CA'
        >>> safe_get({"name": "John"}, "address.state", "")
        ''
    """
    keys = path.split('.')
    current = data
    
    for key in keys:
        if isinstance(current, dict) and key in current:
            current = current[key]
        else:
            return default
    
    return current


def evaluate_csf_rules(form_data: Dict[str, Any]) -> List[RuleResult]:
    """
    Evaluate CSF (Controlled Substance Facility) validation rules.
    
    Rules:
    - Presence: name, license fields, specialty, experience
    - Format: state valid, email format
    - Completeness: minimum required fields
    
    Args:
        form_data: Submission form data dict
        
    Returns:
        List of RuleResult objects
    """
    results = []
    
    # Normalize field access (handle both flat and nested structures)
    name = safe_get(form_data, "name") or safe_get(form_data, "applicant_name") or safe_get(form_data, "practitioner_name")
    license_num = safe_get(form_data, "licenseNumber") or safe_get(form_data, "license_number") or safe_get(form_data, "license")
    specialty = safe_get(form_data, "specialty") or safe_get(form_data, "medical_specialty")
    experience = safe_get(form_data, "yearsOfExperience") or safe_get(form_data, "years_of_experience")
    
    email = safe_get(form_data, "email") or safe_get(form_data, "submitter_email") or safe_get(form_data, "contact_email")
    
    # Address fields (try both flat and nested)
    state = safe_get(form_data, "state") or safe_get(form_data, "address.state")
    zip_code = safe_get(form_data, "zip") or safe_get(form_data, "zipCode") or safe_get(form_data, "address.zip")
    address_line1 = safe_get(form_data, "address") or safe_get(form_data, "address.line1") or safe_get(form_data, "street")
    
    # Rule 1: Applicant name present (CRITICAL)
    results.append(RuleResult(
        rule_id="csf_name_present",
        passed=bool(name and str(name).strip()),
        severity="critical",
        reason="Applicant name must be provided",
        field_path="name"
    ))
    
    # Rule 2: License number present (CRITICAL)
    results.append(RuleResult(
        rule_id="csf_license_present",
        passed=bool(license_num and str(license_num).strip()),
        severity="critical",
        reason="License number must be provided",
        field_path="licenseNumber"
    ))
    
    # Rule 3: Specialty present (MEDIUM)
    results.append(RuleResult(
        rule_id="csf_specialty_present",
        passed=bool(specialty and str(specialty).strip()),
        severity="medium",
        reason="Specialty should be specified",
        field_path="specialty"
    ))
    
    # Rule 4: Years of experience present (MEDIUM)
    results.append(RuleResult(
        rule_id="csf_experience_present",
        passed=bool(experience is not None and str(experience).strip()),
        severity="medium",
        reason="Years of experience should be provided",
        field_path="yearsOfExperience"
    ))
    
    # Rule 5: Address present (CRITICAL)
    results.append(RuleResult(
        rule_id="csf_address_present",
        passed=bool(address_line1 and str(address_line1).strip()),
        severity="critical",
        reason="Address must be provided",
        field_path="address"
    ))
    
    # Rule 6: State valid (CRITICAL)
    state_str = str(state).strip().upper() if state else ""
    results.append(RuleResult(
        rule_id="csf_state_valid",
        passed=state_str in VALID_US_STATES if state_str else False,
        severity="critical",
        reason=f"State must be valid US state code (got: {state_str or 'missing'})",
        field_path="state"
    ))
    
    # Rule 7: ZIP code format (MEDIUM)
    zip_str = str(zip_code).strip() if zip_code else ""
    zip_valid = bool(re.match(r'^\d{5}(-\d{4})?$', zip_str)) if zip_str else False
    results.append(RuleResult(
        rule_id="csf_zip_format",
        passed=zip_valid,
        severity="medium",
        reason=f"ZIP code should be 5 digits (got: {zip_str or 'missing'})",
        field_path="zip"
    ))
    
    # Rule 8: Email format (LOW)
    email_str = str(email).strip() if email else ""
    email_valid = bool('@' in email_str and '.' in email_str) if email_str else False
    results.append(RuleResult(
        rule_id="csf_email_format",
        passed=email_valid,
        severity="low",
        reason=f"Email should be valid format (got: {email_str or 'missing'})",
        field_path="email"
    ))
    
    return results


def evaluate_csa_rules(form_data: Dict[str, Any]) -> List[RuleResult]:
    """
    Evaluate CSA (Controlled Substance Application) validation rules.
    
    CSA uses a subset of CSF rules focused on basic applicant info.
    
    Args:
        form_data: Submission form data dict
        
    Returns:
        List of RuleResult objects
    """
    results = []
    
    # Normalize field access
    name = safe_get(form_data, "name") or safe_get(form_data, "applicant_name") or safe_get(form_data, "business_name")
    email = safe_get(form_data, "email") or safe_get(form_data, "submitter_email") or safe_get(form_data, "contact_email")
    
    # Address fields
    state = safe_get(form_data, "state") or safe_get(form_data, "address.state")
    zip_code = safe_get(form_data, "zip") or safe_get(form_data, "zipCode") or safe_get(form_data, "address.zip")
    address_line1 = safe_get(form_data, "address") or safe_get(form_data, "address.line1") or safe_get(form_data, "street")
    
    # Rule 1: Applicant/Business name present (CRITICAL)
    results.append(RuleResult(
        rule_id="csa_name_present",
        passed=bool(name and str(name).strip()),
        severity="critical",
        reason="Applicant or business name must be provided",
        field_path="name"
    ))
    
    # Rule 2: Address present (CRITICAL)
    results.append(RuleResult(
        rule_id="csa_address_present",
        passed=bool(address_line1 and str(address_line1).strip()),
        severity="critical",
        reason="Address must be provided",
        field_path="address"
    ))
    
    # Rule 3: State valid (CRITICAL)
    state_str = str(state).strip().upper() if state else ""
    results.append(RuleResult(
        rule_id="csa_state_valid",
        passed=state_str in VALID_US_STATES if state_str else False,
        severity="critical",
        reason=f"State must be valid US state code (got: {state_str or 'missing'})",
        field_path="state"
    ))
    
    # Rule 4: ZIP code format (MEDIUM)
    zip_str = str(zip_code).strip() if zip_code else ""
    zip_valid = bool(re.match(r'^\d{5}(-\d{4})?$', zip_str)) if zip_str else False
    results.append(RuleResult(
        rule_id="csa_zip_format",
        passed=zip_valid,
        severity="medium",
        reason=f"ZIP code should be 5 digits (got: {zip_str or 'missing'})",
        field_path="zip"
    ))
    
    # Rule 5: Email format (MEDIUM)
    email_str = str(email).strip() if email else ""
    email_valid = bool('@' in email_str and '.' in email_str) if email_str else False
    results.append(RuleResult(
        rule_id="csa_email_format",
        passed=email_valid,
        severity="medium",
        reason=f"Email should be valid format (got: {email_str or 'missing'})",
        field_path="email"
    ))
    
    return results


def evaluate_rules(decision_type: str, submission: Optional[Any]) -> List[RuleResult]:
    """
    Evaluate validation rules for a decision type and submission.
    
    Args:
        decision_type: Type of decision (csf, csf_practitioner, csa, etc.)
        submission: Submission object with formData attribute, or None
        
    Returns:
        List of RuleResult objects
        
    Example:
        >>> from types import SimpleNamespace
        >>> sub = SimpleNamespace(formData={"name": "John Doe", "state": "CA"})
        >>> results = evaluate_rules("csf", sub)
        >>> len(results)
        8
    """
    # Handle missing submission
    if submission is None:
        # Return minimal ruleset indicating no submission
        return [
            RuleResult(
                rule_id="submission_missing",
                passed=False,
                severity="critical",
                reason="No submission data available",
                field_path=None
            )
        ]
    
    # Extract form data
    form_data = {}
    if hasattr(submission, 'formData'):
        form_data = submission.formData or {}
    elif isinstance(submission, dict):
        form_data = submission.get('formData', submission)
    
    # Route to appropriate rule set
    decision_type_lower = (decision_type or "").lower()
    
    if decision_type_lower in ["csf", "csf_practitioner", "csf_facility"]:
        return evaluate_csf_rules(form_data)
    elif decision_type_lower == "csa":
        return evaluate_csa_rules(form_data)
    else:
        # Default to CSF rules for unknown types
        return evaluate_csf_rules(form_data)


def compute_rule_based_confidence(rule_results: List[RuleResult]) -> tuple[float, str, Dict[str, Any]]:
    """
    Compute confidence score and band from rule results.
    
    Algorithm:
    - confidence = (passed_rules / total_rules) * 100
    - Apply minimum floor of 5.0 when submission exists but incomplete
    - confidence_band: >= 80 = high, >= 50 = medium, else = low
    
    Args:
        rule_results: List of RuleResult objects
        
    Returns:
        Tuple of (confidence_percent, confidence_band, rule_summary)
        
    Example:
        >>> results = [
        ...     RuleResult("r1", True, "critical", "OK"),
        ...     RuleResult("r2", False, "medium", "Missing field")
        ... ]
        >>> conf, band, summary = compute_rule_based_confidence(results)
        >>> conf
        50.0
        >>> band
        'medium'
    """
    if not rule_results:
        return 5.0, "low", {"total": 0, "passed": 0, "failed_critical": 0, "failed_medium": 0}
    
    total = len(rule_results)
    passed = sum(1 for r in rule_results if r.passed)
    
    failed_critical = [r for r in rule_results if not r.passed and r.severity == "critical"]
    failed_medium = [r for r in rule_results if not r.passed and r.severity == "medium"]
    failed_low = [r for r in rule_results if not r.passed and r.severity == "low"]
    
    # Calculate raw confidence
    if total > 0:
        raw_confidence = (passed / total) * 100
    else:
        raw_confidence = 5.0
    
    # Apply minimum floor of 5.0 to avoid "0% everywhere"
    # This prevents cases from showing 0% due to missing fields
    # Only exception: truly empty cases with no submission should still show 5% minimum
    if raw_confidence < 5.0:
        confidence = 5.0
    else:
        confidence = round(raw_confidence, 2)
    
    # Determine band
    if confidence >= 80:
        band = "high"
    elif confidence >= 50:
        band = "medium"
    else:
        band = "low"
    
    # Build summary
    rule_summary = {
        "total": total,
        "passed": passed,
        "failed_critical": len(failed_critical),
        "failed_medium": len(failed_medium),
        "failed_low": len(failed_low),
        "failed_critical_ids": [r.rule_id for r in failed_critical],
        "failed_medium_ids": [r.rule_id for r in failed_medium],
    }
    
    return confidence, band, rule_summary
