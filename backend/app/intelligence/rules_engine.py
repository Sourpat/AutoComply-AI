"""
Rule-Based Confidence Engine V1 (Phase 7.8)

Deterministic, hard-coded validation rules for each case type.
Provides transparent, explainable confidence scores.

Supported case types:
- csf_practitioner: Controlled Substance Facility - Practitioner
- csf_facility: Controlled Substance Facility - Facility
- csf: Controlled Substance Facility (generic)
- csa: Controlled Substance Authorization
"""

from typing import List, Dict, Any, Callable, Optional
from dataclasses import dataclass, field
from enum import Enum
import re


class RuleSeverity(str, Enum):
    """Rule severity levels (impacts confidence caps)."""
    CRITICAL = "critical"  # Missing critical fields - cap at 40%
    MEDIUM = "medium"      # Missing important fields - 3+ caps at 70%
    LOW = "low"            # Nice-to-have fields - minimal impact


@dataclass
class Rule:
    """
    A single validation rule for a case type.
    
    Attributes:
        id: Unique rule identifier (e.g., "csf_prac_name_present")
        title: Human-readable rule title
        severity: Impact level (critical|medium|low)
        weight: Numeric weight for scoring (1-10, higher = more important)
        check: Function that validates the rule against case payload
        message_on_fail: Error message shown when rule fails
        field_path: Dot-notation path to field being validated
    """
    id: str
    title: str
    severity: RuleSeverity
    weight: int
    check: Callable[[Dict[str, Any]], bool]
    message_on_fail: str
    field_path: Optional[str] = None


@dataclass
class RuleResult:
    """Result of evaluating a single rule."""
    rule_id: str
    title: str
    passed: bool
    severity: str
    weight: int
    message: str
    field_path: Optional[str] = None


@dataclass
class RulePack:
    """Collection of rules for a specific case type."""
    case_type: str
    rules: List[Rule] = field(default_factory=list)
    
    def evaluate(self, case_payload: Dict[str, Any]) -> List[RuleResult]:
        """Evaluate all rules against case payload."""
        results = []
        for rule in self.rules:
            passed = rule.check(case_payload)
            results.append(RuleResult(
                rule_id=rule.id,
                title=rule.title,
                passed=passed,
                severity=rule.severity.value,
                weight=rule.weight,
                message=rule.message_on_fail if not passed else "",
                field_path=rule.field_path
            ))
        return results


# =============================================================================
# Helper Functions
# =============================================================================

VALID_US_STATES = {
    "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
    "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
    "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
    "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
    "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY",
    "DC"
}


def safe_get(data: Dict[str, Any], *paths: str, default: Any = None) -> Any:
    """
    Try multiple field paths, return first non-empty value.
    
    Args:
        data: Dict to search
        *paths: Multiple dot-notation paths to try
        default: Default if all paths fail
        
    Returns:
        First non-empty value found, or default
    """
    for path in paths:
        keys = path.split('.')
        current = data
        
        for key in keys:
            if isinstance(current, dict) and key in current:
                current = current[key]
            else:
                current = None
                break
        
        if current is not None and str(current).strip():
            return current
    
    return default


def is_valid_email(email: Any) -> bool:
    """Check if email is valid format."""
    if not email:
        return False
    email_str = str(email).strip()
    return bool(re.match(r'^[^@]+@[^@]+\.[^@]+$', email_str))


def is_valid_zip(zip_code: Any) -> bool:
    """Check if ZIP code is valid US format (5 or 5+4 digits)."""
    if not zip_code:
        return False
    zip_str = str(zip_code).strip()
    return bool(re.match(r'^\d{5}(-\d{4})?$', zip_str))


def is_valid_state(state: Any) -> bool:
    """Check if state is valid US state code."""
    if not state:
        return False
    state_str = str(state).strip().upper()
    return state_str in VALID_US_STATES


def is_present(value: Any) -> bool:
    """Check if value is present and non-empty."""
    return bool(value and str(value).strip())


def is_positive_number(value: Any, min_value: int = 0) -> bool:
    """Check if value is a positive number >= min_value."""
    if value is None:
        return False
    try:
        num = float(value)
        return num >= min_value
    except (ValueError, TypeError):
        return False


# =============================================================================
# Rule Packs by Case Type
# =============================================================================

def build_csf_practitioner_rules() -> RulePack:
    """
    Rules for CSF Practitioner applications.
    
    Validates: practitioner credentials, license, specialty, experience,
    address, contact info, professional background.
    
    Total: 10 rules (3 critical, 4 medium, 3 low)
    """
    pack = RulePack(case_type="csf_practitioner")
    
    # CRITICAL RULES (must pass for approval)
    pack.rules.append(Rule(
        id="csf_prac_name_present",
        title="Practitioner Name Present",
        severity=RuleSeverity.CRITICAL,
        weight=10,
        check=lambda d: is_present(safe_get(d, "name", "practitioner_name", "applicant_name")),
        message_on_fail="Practitioner name is required",
        field_path="name"
    ))
    
    pack.rules.append(Rule(
        id="csf_prac_license_present",
        title="License Number Present",
        severity=RuleSeverity.CRITICAL,
        weight=10,
        check=lambda d: is_present(safe_get(d, "license_number", "licenseNumber", "license")),
        message_on_fail="Medical license number is required",
        field_path="license_number"
    ))
    
    pack.rules.append(Rule(
        id="csf_prac_state_valid",
        title="State Valid",
        severity=RuleSeverity.CRITICAL,
        weight=9,
        check=lambda d: is_valid_state(safe_get(d, "state", "address.state", "practice_state")),
        message_on_fail="Valid US state code is required",
        field_path="state"
    ))
    
    # MEDIUM RULES (important but not critical)
    pack.rules.append(Rule(
        id="csf_prac_specialty_present",
        title="Medical Specialty Present",
        severity=RuleSeverity.MEDIUM,
        weight=7,
        check=lambda d: is_present(safe_get(d, "specialty", "medical_specialty", "practice_area")),
        message_on_fail="Medical specialty should be specified",
        field_path="specialty"
    ))
    
    pack.rules.append(Rule(
        id="csf_prac_experience_valid",
        title="Years of Experience Valid",
        severity=RuleSeverity.MEDIUM,
        weight=6,
        check=lambda d: is_positive_number(safe_get(d, "years_experience", "yearsOfExperience", "experience_years"), min_value=0),
        message_on_fail="Years of experience should be a positive number",
        field_path="years_experience"
    ))
    
    pack.rules.append(Rule(
        id="csf_prac_address_present",
        title="Practice Address Present",
        severity=RuleSeverity.MEDIUM,
        weight=6,
        check=lambda d: is_present(safe_get(d, "address", "street_address", "address.line1", "practice_address")),
        message_on_fail="Practice address is required",
        field_path="address"
    ))
    
    pack.rules.append(Rule(
        id="csf_prac_email_valid",
        title="Email Valid Format",
        severity=RuleSeverity.MEDIUM,
        weight=5,
        check=lambda d: is_valid_email(safe_get(d, "email", "contact_email", "practitioner_email")),
        message_on_fail="Valid email address is required",
        field_path="email"
    ))
    
    # LOW RULES (nice to have)
    pack.rules.append(Rule(
        id="csf_prac_zip_valid",
        title="ZIP Code Valid Format",
        severity=RuleSeverity.LOW,
        weight=3,
        check=lambda d: is_valid_zip(safe_get(d, "zip", "zipCode", "postal_code", "address.zip")),
        message_on_fail="ZIP code should be 5-digit format",
        field_path="zip"
    ))
    
    pack.rules.append(Rule(
        id="csf_prac_phone_present",
        title="Phone Number Present",
        severity=RuleSeverity.LOW,
        weight=2,
        check=lambda d: is_present(safe_get(d, "phone", "phone_number", "contact_phone")),
        message_on_fail="Phone number is recommended",
        field_path="phone"
    ))
    
    pack.rules.append(Rule(
        id="csf_prac_dea_present",
        title="DEA Number Present",
        severity=RuleSeverity.LOW,
        weight=4,
        check=lambda d: is_present(safe_get(d, "dea_number", "deaNumber", "dea")),
        message_on_fail="DEA registration number is recommended for controlled substance authorization",
        field_path="dea_number"
    ))
    
    return pack


def build_csf_facility_rules() -> RulePack:
    """
    Rules for CSF Facility applications.
    
    Validates: facility info, license, address, contact, capacity,
    accreditation, management.
    
    Total: 10 rules (3 critical, 5 medium, 2 low)
    """
    pack = RulePack(case_type="csf_facility")
    
    # CRITICAL RULES
    pack.rules.append(Rule(
        id="csf_fac_name_present",
        title="Facility Name Present",
        severity=RuleSeverity.CRITICAL,
        weight=10,
        check=lambda d: is_present(safe_get(d, "facility_name", "name", "business_name")),
        message_on_fail="Facility name is required",
        field_path="facility_name"
    ))
    
    pack.rules.append(Rule(
        id="csf_fac_license_present",
        title="Facility License Present",
        severity=RuleSeverity.CRITICAL,
        weight=10,
        check=lambda d: is_present(safe_get(d, "facility_license", "license_number", "license")),
        message_on_fail="Facility license number is required",
        field_path="facility_license"
    ))
    
    pack.rules.append(Rule(
        id="csf_fac_state_valid",
        title="State Valid",
        severity=RuleSeverity.CRITICAL,
        weight=9,
        check=lambda d: is_valid_state(safe_get(d, "state", "address.state", "facility_state")),
        message_on_fail="Valid US state code is required",
        field_path="state"
    ))
    
    # MEDIUM RULES
    pack.rules.append(Rule(
        id="csf_fac_address_present",
        title="Facility Address Present",
        severity=RuleSeverity.MEDIUM,
        weight=7,
        check=lambda d: is_present(safe_get(d, "address", "street_address", "address.line1", "facility_address")),
        message_on_fail="Facility physical address is required",
        field_path="address"
    ))
    
    pack.rules.append(Rule(
        id="csf_fac_type_present",
        title="Facility Type Present",
        severity=RuleSeverity.MEDIUM,
        weight=6,
        check=lambda d: is_present(safe_get(d, "facility_type", "type", "business_type")),
        message_on_fail="Facility type should be specified (hospital, clinic, pharmacy, etc.)",
        field_path="facility_type"
    ))
    
    pack.rules.append(Rule(
        id="csf_fac_capacity_valid",
        title="Facility Capacity Valid",
        severity=RuleSeverity.MEDIUM,
        weight=5,
        check=lambda d: is_positive_number(safe_get(d, "capacity", "bed_count", "patient_capacity"), min_value=1),
        message_on_fail="Facility capacity should be a positive number",
        field_path="capacity"
    ))
    
    pack.rules.append(Rule(
        id="csf_fac_director_present",
        title="Medical Director Present",
        severity=RuleSeverity.MEDIUM,
        weight=6,
        check=lambda d: is_present(safe_get(d, "medical_director", "director_name", "responsible_person")),
        message_on_fail="Medical director or responsible person should be identified",
        field_path="medical_director"
    ))
    
    pack.rules.append(Rule(
        id="csf_fac_email_valid",
        title="Email Valid Format",
        severity=RuleSeverity.MEDIUM,
        weight=5,
        check=lambda d: is_valid_email(safe_get(d, "email", "contact_email", "facility_email")),
        message_on_fail="Valid email address is required",
        field_path="email"
    ))
    
    # LOW RULES
    pack.rules.append(Rule(
        id="csf_fac_zip_valid",
        title="ZIP Code Valid Format",
        severity=RuleSeverity.LOW,
        weight=3,
        check=lambda d: is_valid_zip(safe_get(d, "zip", "zipCode", "postal_code", "address.zip")),
        message_on_fail="ZIP code should be 5-digit format",
        field_path="zip"
    ))
    
    pack.rules.append(Rule(
        id="csf_fac_accreditation_present",
        title="Accreditation Status Present",
        severity=RuleSeverity.LOW,
        weight=4,
        check=lambda d: is_present(safe_get(d, "accreditation", "accreditation_status", "jcaho")),
        message_on_fail="Accreditation status is recommended",
        field_path="accreditation"
    ))
    
    return pack


def build_csf_generic_rules() -> RulePack:
    """
    Rules for generic CSF applications (when type not specified).
    
    Validates: basic identity, license, location, contact.
    Simpler ruleset that works for both practitioners and facilities.
    
    Total: 8 rules (3 critical, 3 medium, 2 low)
    """
    pack = RulePack(case_type="csf")
    
    # CRITICAL RULES
    pack.rules.append(Rule(
        id="csf_name_present",
        title="Applicant Name Present",
        severity=RuleSeverity.CRITICAL,
        weight=10,
        check=lambda d: is_present(safe_get(d, "name", "applicant_name", "facility_name", "practitioner_name")),
        message_on_fail="Applicant name is required",
        field_path="name"
    ))
    
    pack.rules.append(Rule(
        id="csf_license_present",
        title="License Number Present",
        severity=RuleSeverity.CRITICAL,
        weight=10,
        check=lambda d: is_present(safe_get(d, "license_number", "licenseNumber", "license")),
        message_on_fail="License number is required",
        field_path="license_number"
    ))
    
    pack.rules.append(Rule(
        id="csf_state_valid",
        title="State Valid",
        severity=RuleSeverity.CRITICAL,
        weight=9,
        check=lambda d: is_valid_state(safe_get(d, "state", "address.state")),
        message_on_fail="Valid US state code is required",
        field_path="state"
    ))
    
    # MEDIUM RULES
    pack.rules.append(Rule(
        id="csf_address_present",
        title="Address Present",
        severity=RuleSeverity.MEDIUM,
        weight=7,
        check=lambda d: is_present(safe_get(d, "address", "street_address", "address.line1")),
        message_on_fail="Physical address is required",
        field_path="address"
    ))
    
    pack.rules.append(Rule(
        id="csf_specialty_present",
        title="Specialty/Type Present",
        severity=RuleSeverity.MEDIUM,
        weight=6,
        check=lambda d: is_present(safe_get(d, "specialty", "facility_type", "type")),
        message_on_fail="Specialty or facility type should be specified",
        field_path="specialty"
    ))
    
    pack.rules.append(Rule(
        id="csf_email_valid",
        title="Email Valid Format",
        severity=RuleSeverity.MEDIUM,
        weight=5,
        check=lambda d: is_valid_email(safe_get(d, "email", "contact_email")),
        message_on_fail="Valid email address is required",
        field_path="email"
    ))
    
    # LOW RULES
    pack.rules.append(Rule(
        id="csf_zip_valid",
        title="ZIP Code Valid Format",
        severity=RuleSeverity.LOW,
        weight=3,
        check=lambda d: is_valid_zip(safe_get(d, "zip", "zipCode", "address.zip")),
        message_on_fail="ZIP code should be 5-digit format",
        field_path="zip"
    ))
    
    pack.rules.append(Rule(
        id="csf_experience_present",
        title="Experience/Background Present",
        severity=RuleSeverity.LOW,
        weight=4,
        check=lambda d: is_present(safe_get(d, "years_experience", "experience_years", "years_in_operation")),
        message_on_fail="Experience or operational history is recommended",
        field_path="years_experience"
    ))
    
    return pack


def build_csa_rules() -> RulePack:
    """
    Rules for CSA (Controlled Substance Authorization) applications.
    
    Validates: business identity, authorization details, location, compliance.
    
    Total: 8 rules (3 critical, 3 medium, 2 low)
    """
    pack = RulePack(case_type="csa")
    
    # CRITICAL RULES
    pack.rules.append(Rule(
        id="csa_name_present",
        title="Business Name Present",
        severity=RuleSeverity.CRITICAL,
        weight=10,
        check=lambda d: is_present(safe_get(d, "name", "business_name", "company_name")),
        message_on_fail="Business or applicant name is required",
        field_path="name"
    ))
    
    pack.rules.append(Rule(
        id="csa_address_present",
        title="Address Present",
        severity=RuleSeverity.CRITICAL,
        weight=9,
        check=lambda d: is_present(safe_get(d, "address", "business_address", "address.line1")),
        message_on_fail="Business address is required",
        field_path="address"
    ))
    
    pack.rules.append(Rule(
        id="csa_state_valid",
        title="State Valid",
        severity=RuleSeverity.CRITICAL,
        weight=9,
        check=lambda d: is_valid_state(safe_get(d, "state", "address.state")),
        message_on_fail="Valid US state code is required",
        field_path="state"
    ))
    
    # MEDIUM RULES
    pack.rules.append(Rule(
        id="csa_authorization_type_present",
        title="Authorization Type Present",
        severity=RuleSeverity.MEDIUM,
        weight=7,
        check=lambda d: is_present(safe_get(d, "authorization_type", "auth_type", "license_type")),
        message_on_fail="Type of controlled substance authorization should be specified",
        field_path="authorization_type"
    ))
    
    pack.rules.append(Rule(
        id="csa_purpose_present",
        title="Business Purpose Present",
        severity=RuleSeverity.MEDIUM,
        weight=6,
        check=lambda d: is_present(safe_get(d, "purpose", "business_purpose", "intended_use")),
        message_on_fail="Purpose of controlled substance authorization should be stated",
        field_path="purpose"
    ))
    
    pack.rules.append(Rule(
        id="csa_email_valid",
        title="Email Valid Format",
        severity=RuleSeverity.MEDIUM,
        weight=5,
        check=lambda d: is_valid_email(safe_get(d, "email", "contact_email", "business_email")),
        message_on_fail="Valid email address is required",
        field_path="email"
    ))
    
    # LOW RULES
    pack.rules.append(Rule(
        id="csa_zip_valid",
        title="ZIP Code Valid Format",
        severity=RuleSeverity.LOW,
        weight=3,
        check=lambda d: is_valid_zip(safe_get(d, "zip", "zipCode", "address.zip")),
        message_on_fail="ZIP code should be 5-digit format",
        field_path="zip"
    ))
    
    pack.rules.append(Rule(
        id="csa_responsible_person_present",
        title="Responsible Person Present",
        severity=RuleSeverity.LOW,
        weight=4,
        check=lambda d: is_present(safe_get(d, "responsible_person", "contact_person", "manager_name")),
        message_on_fail="Responsible person should be identified",
        field_path="responsible_person"
    ))
    
    return pack


# =============================================================================
# Rule Engine Registry
# =============================================================================

_RULE_PACKS: Dict[str, RulePack] = {}


def get_rule_pack(case_type: str) -> RulePack:
    """Get rule pack for a case type (cached)."""
    case_type_lower = case_type.lower()
    
    if case_type_lower not in _RULE_PACKS:
        if case_type_lower == "csf_practitioner":
            _RULE_PACKS[case_type_lower] = build_csf_practitioner_rules()
        elif case_type_lower == "csf_facility":
            _RULE_PACKS[case_type_lower] = build_csf_facility_rules()
        elif case_type_lower == "csf":
            _RULE_PACKS[case_type_lower] = build_csf_generic_rules()
        elif case_type_lower == "csa":
            _RULE_PACKS[case_type_lower] = build_csa_rules()
        else:
            # Default to generic CSF for unknown types
            _RULE_PACKS[case_type_lower] = build_csf_generic_rules()
    
    return _RULE_PACKS[case_type_lower]


def evaluate_case(case_type: str, case_payload: Dict[str, Any]) -> List[RuleResult]:
    """
    Evaluate all rules for a case type against case payload.
    
    Args:
        case_type: Type of case (csf_practitioner, csf_facility, csf, csa)
        case_payload: Case form data dict
        
    Returns:
        List of RuleResult objects
    """
    pack = get_rule_pack(case_type)
    return pack.evaluate(case_payload)


def compute_confidence(rule_results: List[RuleResult]) -> tuple[float, str, Dict[str, Any]]:
    """
    Compute confidence score and band from rule results.
    
    Algorithm:
    1. Base confidence = (rules_passed / rules_total) * 100
    2. Apply severity penalties:
       - ANY critical failure => cap at 40%
       - 3+ medium failures => cap at 70%
    3. Determine band: >= 80 = high, 40-79 = medium, < 40 = low
    
    Args:
        rule_results: List of RuleResult objects
        
    Returns:
        Tuple of (confidence_score, confidence_band, summary_dict)
    """
    if not rule_results:
        return 5.0, "low", {
            "rules_total": 0,
            "rules_passed": 0,
            "rules_failed_count": 0,
            "failed_rules": []
        }
    
    total = len(rule_results)
    passed_results = [r for r in rule_results if r.passed]
    failed_results = [r for r in rule_results if not r.passed]
    
    passed = len(passed_results)
    failed = len(failed_results)
    
    # Categorize failures by severity
    failed_critical = [r for r in failed_results if r.severity == "critical"]
    failed_medium = [r for r in failed_results if r.severity == "medium"]
    failed_low = [r for r in failed_results if r.severity == "low"]
    
    # Calculate base confidence
    if total > 0:
        base_confidence = (passed / total) * 100
    else:
        base_confidence = 5.0
    
    # Apply severity-based caps
    confidence = base_confidence
    
    # Cap 1: ANY critical failure => max 40%
    if len(failed_critical) > 0:
        confidence = min(confidence, 40.0)
    
    # Cap 2: 3+ medium failures => max 70%
    if len(failed_medium) >= 3:
        confidence = min(confidence, 70.0)
    
    # Apply minimum floor of 5%
    confidence = max(confidence, 5.0)
    
    # Round to 1 decimal place
    confidence = round(confidence, 1)
    
    # Determine band
    if confidence >= 80:
        band = "high"
    elif confidence >= 40:
        band = "medium"
    else:
        band = "low"
    
    # Build summary
    summary = {
        "rules_total": total,
        "rules_passed": passed,
        "rules_failed_count": failed,
        "failed_rules": [
            {
                "rule_id": r.rule_id,
                "title": r.title,
                "severity": r.severity,
                "message": r.message,
                "field_path": r.field_path,
                "weight": r.weight
            }
            for r in failed_results
        ],
        "failed_by_severity": {
            "critical": len(failed_critical),
            "medium": len(failed_medium),
            "low": len(failed_low)
        }
    }
    
    return confidence, band, summary
