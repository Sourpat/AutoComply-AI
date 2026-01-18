"""
Field-Level Validation for Submissions (Phase 7.14)

Deterministic field validation that checks submission data for:
- Required fields presence
- Format validation (email, phone, dates, codes)
- Data quality (placeholders, minimum lengths)

Generates field_issues with severity (critical/medium/low) that affect
confidence scoring through deterministic penalty rules.
"""

import re
from datetime import datetime
from typing import Dict, List, Any, Optional, Callable, Tuple
from dataclasses import dataclass


@dataclass
class FieldIssue:
    """Represents a field validation issue"""
    field: str
    severity: str  # 'critical', 'medium', 'low'
    check: str  # Name of validation check that failed
    message: str


# ============================================================================
# Core Validator Functions
# ============================================================================

def required_nonempty(value: Any, field_name: str) -> Optional[FieldIssue]:
    """Check if required field is present and non-empty"""
    if value is None or (isinstance(value, str) and not value.strip()):
        return FieldIssue(
            field=field_name,
            severity='critical',
            check='required_nonempty',
            message=f'{field_name} is required but missing or empty'
        )
    return None


def min_length(value: Any, field_name: str, min_len: int) -> Optional[FieldIssue]:
    """Check if string field meets minimum length"""
    if value is None:
        return None  # Handle missing separately with required_nonempty
    
    str_value = str(value).strip()
    if len(str_value) < min_len:
        return FieldIssue(
            field=field_name,
            severity='medium',
            check='min_length',
            message=f'{field_name} must be at least {min_len} characters (got {len(str_value)})'
        )
    return None


def regex_match(value: Any, field_name: str, pattern: str, label: str) -> Optional[FieldIssue]:
    """Check if field matches regex pattern"""
    if value is None:
        return None
    
    str_value = str(value).strip()
    if not str_value:
        return None
    
    if not re.match(pattern, str_value):
        return FieldIssue(
            field=field_name,
            severity='medium',
            check='regex_match',
            message=f'{field_name} has invalid {label} format'
        )
    return None


def placeholder_check(value: Any, field_name: str, placeholders: List[str]) -> Optional[FieldIssue]:
    """Check for common placeholder values"""
    if value is None:
        return None
    
    str_value = str(value).strip().lower()
    if str_value in [p.lower() for p in placeholders]:
        return FieldIssue(
            field=field_name,
            severity='low',
            check='placeholder_value',
            message=f'{field_name} contains placeholder value: {value}'
        )
    return None


# ============================================================================
# Date Validators
# ============================================================================

def date_parse(value: Any, field_name: str) -> Optional[FieldIssue]:
    """Check if date can be parsed"""
    if value is None:
        return None
    
    str_value = str(value).strip()
    if not str_value:
        return None
    
    # Try common date formats
    formats = ['%Y-%m-%d', '%m/%d/%Y', '%Y-%m-%d %H:%M:%S']
    for fmt in formats:
        try:
            datetime.strptime(str_value, fmt)
            return None
        except ValueError:
            continue
    
    return FieldIssue(
        field=field_name,
        severity='medium',
        check='date_parse',
        message=f'{field_name} has invalid date format: {value}'
    )


def date_not_past(value: Any, field_name: str) -> Optional[FieldIssue]:
    """Check if date is not in the past (for expiration dates)"""
    if value is None:
        return None
    
    str_value = str(value).strip()
    if not str_value:
        return None
    
    # Try to parse date
    formats = ['%Y-%m-%d', '%m/%d/%Y', '%Y-%m-%d %H:%M:%S']
    parsed_date = None
    for fmt in formats:
        try:
            parsed_date = datetime.strptime(str_value, fmt)
            break
        except ValueError:
            continue
    
    if parsed_date is None:
        return None  # Let date_parse handle invalid format
    
    if parsed_date < datetime.now():
        return FieldIssue(
            field=field_name,
            severity='critical',
            check='date_not_past',
            message=f'{field_name} has expired: {value}'
        )
    return None


def date_order(start_value: Any, end_value: Any, start_field: str, end_field: str) -> Optional[FieldIssue]:
    """Check if start date is before end date"""
    if start_value is None or end_value is None:
        return None
    
    formats = ['%Y-%m-%d', '%m/%d/%Y', '%Y-%m-%d %H:%M:%S']
    
    start_date = None
    for fmt in formats:
        try:
            start_date = datetime.strptime(str(start_value).strip(), fmt)
            break
        except ValueError:
            continue
    
    end_date = None
    for fmt in formats:
        try:
            end_date = datetime.strptime(str(end_value).strip(), fmt)
            break
        except ValueError:
            continue
    
    if start_date is None or end_date is None:
        return None  # Let date_parse handle invalid formats
    
    if start_date >= end_date:
        return FieldIssue(
            field=f'{start_field}, {end_field}',
            severity='medium',
            check='date_order',
            message=f'{start_field} must be before {end_field}'
        )
    return None


# ============================================================================
# Format Validators
# ============================================================================

def email_format(value: Any, field_name: str) -> Optional[FieldIssue]:
    """Check if email format is valid"""
    if value is None:
        return None
    
    str_value = str(value).strip()
    if not str_value:
        return None
    
    # Basic email regex
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    if not re.match(pattern, str_value):
        return FieldIssue(
            field=field_name,
            severity='medium',
            check='email_format',
            message=f'{field_name} has invalid email format'
        )
    return None


def phone_format(value: Any, field_name: str) -> Optional[FieldIssue]:
    """Check if phone format is valid (US)"""
    if value is None:
        return None
    
    str_value = str(value).strip()
    if not str_value:
        return None
    
    # Remove common separators
    digits_only = re.sub(r'[^0-9]', '', str_value)
    
    if len(digits_only) != 10:
        return FieldIssue(
            field=field_name,
            severity='medium',
            check='phone_format',
            message=f'{field_name} must be 10 digits (got {len(digits_only)})'
        )
    return None


def state_code_valid(value: Any, field_name: str) -> Optional[FieldIssue]:
    """Check if state code is valid 2-letter US state"""
    if value is None:
        return None
    
    str_value = str(value).strip().upper()
    if not str_value:
        return None
    
    valid_states = {
        'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
        'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
        'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
        'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
        'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
        'DC', 'PR', 'VI', 'GU', 'AS', 'MP'
    }
    
    if str_value not in valid_states:
        return FieldIssue(
            field=field_name,
            severity='medium',
            check='state_code_valid',
            message=f'{field_name} has invalid state code: {value}'
        )
    return None


def zip_valid(value: Any, field_name: str) -> Optional[FieldIssue]:
    """Check if ZIP code is valid (5 or 9 digits)"""
    if value is None:
        return None
    
    str_value = str(value).strip()
    if not str_value:
        return None
    
    # Remove hyphen for ZIP+4
    digits_only = re.sub(r'[^0-9]', '', str_value)
    
    if len(digits_only) not in [5, 9]:
        return FieldIssue(
            field=field_name,
            severity='medium',
            check='zip_valid',
            message=f'{field_name} must be 5 or 9 digits (got {len(digits_only)})'
        )
    return None


def npi_format(value: Any, field_name: str) -> Optional[FieldIssue]:
    """Check if NPI is valid (10 digits)"""
    if value is None:
        return None
    
    str_value = str(value).strip()
    if not str_value:
        return None
    
    digits_only = re.sub(r'[^0-9]', '', str_value)
    
    if len(digits_only) != 10:
        return FieldIssue(
            field=field_name,
            severity='critical',
            check='npi_format',
            message=f'{field_name} must be 10 digits (got {len(digits_only)})'
        )
    return None


def dea_format(value: Any, field_name: str) -> Optional[FieldIssue]:
    """Check if DEA number format is valid (2 letters + 7 digits)"""
    if value is None:
        return None
    
    str_value = str(value).strip()
    if not str_value:
        return None
    
    # DEA format: 2 letters + 7 digits
    pattern = r'^[A-Z]{2}[0-9]{7}$'
    if not re.match(pattern, str_value.upper()):
        return FieldIssue(
            field=field_name,
            severity='critical',
            check='dea_format',
            message=f'{field_name} must be 2 letters + 7 digits'
        )
    return None


# ============================================================================
# Per Decision Type Validation Maps
# ============================================================================

# Common placeholders to check for
COMMON_PLACEHOLDERS = [
    'test', 'tbd', 'n/a', 'na', 'unknown', 'pending',
    'xxx', '000', '0000000000', '1234567890'
]


def get_validation_checks(decision_type: str) -> List[Tuple[str, Callable, Dict[str, Any]]]:
    """
    Get validation checks for a given decision type.
    
    Returns list of tuples: (field_path, validator_func, kwargs)
    """
    
    if decision_type == 'csf_practitioner':
        return [
            # Critical required fields
            ('practitioner_name', required_nonempty, {}),
            ('npi', required_nonempty, {}),
            ('npi', npi_format, {}),
            ('dea_number', required_nonempty, {}),
            ('dea_number', dea_format, {}),
            ('license_number', required_nonempty, {}),
            ('state', required_nonempty, {}),
            ('state', state_code_valid, {}),
            
            # Medium priority
            ('email', email_format, {}),
            ('phone', phone_format, {}),
            ('address', min_length, {'min_len': 10}),
            ('city', min_length, {'min_len': 2}),
            ('zip', zip_valid, {}),
            
            # Low priority - placeholders
            ('practitioner_name', placeholder_check, {'placeholders': COMMON_PLACEHOLDERS}),
            ('email', placeholder_check, {'placeholders': COMMON_PLACEHOLDERS}),
        ]
    
    elif decision_type == 'csf_facility':
        return [
            # Critical required fields
            ('facility_name', required_nonempty, {}),
            ('dea_registration', required_nonempty, {}),
            ('dea_registration', dea_format, {}),
            ('state_license', required_nonempty, {}),
            ('state', required_nonempty, {}),
            ('state', state_code_valid, {}),
            
            # Medium priority
            ('contact_email', email_format, {}),
            ('contact_phone', phone_format, {}),
            ('address', min_length, {'min_len': 10}),
            ('city', min_length, {'min_len': 2}),
            ('zip', zip_valid, {}),
            
            # Low priority - placeholders
            ('facility_name', placeholder_check, {'placeholders': COMMON_PLACEHOLDERS}),
        ]
    
    elif decision_type == 'csf':
        return [
            # Critical required fields
            ('license_number', required_nonempty, {}),
            ('license_expiry_date', required_nonempty, {}),
            ('license_expiry_date', date_parse, {}),
            ('license_expiry_date', date_not_past, {}),
            ('applicant_name', required_nonempty, {}),
            ('state', required_nonempty, {}),
            ('state', state_code_valid, {}),
            
            # Medium priority
            ('email', email_format, {}),
            ('phone', phone_format, {}),
            ('zip', zip_valid, {}),
            
            # Low priority
            ('applicant_name', placeholder_check, {'placeholders': COMMON_PLACEHOLDERS}),
        ]
    
    elif decision_type == 'csa':
        return [
            # Critical required fields
            ('applicant_name', required_nonempty, {}),
            ('application_type', required_nonempty, {}),
            ('substance_schedule', required_nonempty, {}),
            ('state', required_nonempty, {}),
            ('state', state_code_valid, {}),
            
            # Medium priority
            ('contact_email', email_format, {}),
            ('contact_phone', phone_format, {}),
            ('business_address', min_length, {'min_len': 10}),
            ('zip', zip_valid, {}),
            
            # Low priority
            ('applicant_name', placeholder_check, {'placeholders': COMMON_PLACEHOLDERS}),
        ]
    
    else:
        # Default/unknown decision type - minimal checks
        return [
            ('applicant_name', required_nonempty, {}),
            ('state', state_code_valid, {}),
        ]


# ============================================================================
# Validation Runner
# ============================================================================

def validate_submission_fields(submission_data: Dict[str, Any], decision_type: str) -> List[FieldIssue]:
    """
    Run all field validations for a submission.
    
    Args:
        submission_data: Dictionary of submission fields
        decision_type: Type of decision (csf_practitioner, csf_facility, csf, csa)
    
    Returns:
        List of FieldIssue objects for failed validations
    """
    issues = []
    checks = get_validation_checks(decision_type)
    
    for field_path, validator_func, kwargs in checks:
        # Get field value (support nested paths with dot notation)
        value = submission_data.get(field_path)
        
        # Run validator
        try:
            issue = validator_func(value, field_path, **kwargs)
            if issue:
                issues.append(issue)
        except Exception as e:
            # If validator throws, log but don't fail entire validation
            print(f"[field_validators] Error running {validator_func.__name__} on {field_path}: {e}")
            continue
    
    return issues


def calculate_field_validation_impact(
    base_confidence: float,
    field_issues: List[FieldIssue]
) -> Tuple[float, str]:
    """
    Apply deterministic confidence penalties based on field issues.
    
    Penalty Rules:
    - Any critical field issue caps confidence at 40% (unless already lower)
    - 3+ medium issues cap confidence at 70%
    - Each low issue reduces by 1% (max 10% total reduction)
    
    Args:
        base_confidence: Starting confidence score (0-100)
        field_issues: List of field validation issues
    
    Returns:
        Tuple of (adjusted_confidence, rationale_text)
    """
    adjusted = base_confidence
    rationale_parts = []
    
    # Count by severity
    critical_count = sum(1 for i in field_issues if i.severity == 'critical')
    medium_count = sum(1 for i in field_issues if i.severity == 'medium')
    low_count = sum(1 for i in field_issues if i.severity == 'low')
    
    # Apply low-priority penalties first (1% each, max 10%)
    if low_count > 0:
        penalty = min(low_count, 10)
        adjusted = max(adjusted - penalty, 0)
        rationale_parts.append(f'{low_count} low-priority field issue(s) reduce confidence by {penalty}%')
    
    # Then apply caps (critical overrides medium)
    # 3+ medium issues cap at 70%
    if medium_count >= 3:
        if adjusted > 70:
            adjusted = 70
            rationale_parts.append(f'{medium_count} medium field issues cap confidence at 70%')
    
    # Critical field issues cap at 40% (most severe, applied last)
    if critical_count > 0:
        if adjusted > 40:
            adjusted = 40
            rationale_parts.append(f'{critical_count} critical field issue(s) cap confidence at 40%')
    
    rationale = '; '.join(rationale_parts) if rationale_parts else 'No field validation penalties applied'
    
    return adjusted, rationale


def get_field_validation_stats(field_issues: List[FieldIssue], decision_type: str) -> Dict[str, int]:
    """
    Get statistics about field validation results.
    
    Returns:
        Dict with field_checks_total and field_checks_passed
    """
    total_checks = len(get_validation_checks(decision_type))
    failed_checks = len(field_issues)
    passed_checks = total_checks - failed_checks
    
    return {
        'field_checks_total': total_checks,
        'field_checks_passed': max(passed_checks, 0)  # Ensure non-negative
    }
