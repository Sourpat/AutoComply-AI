"""
Tests for Phase 7.14 - Field-Level Validation

Tests cover:
- Individual validator functions
- Per decision_type validation maps
- Confidence penalty calculations
- End-to-end integration with intelligence computation
"""

import pytest
from datetime import datetime, timedelta
from app.intelligence.field_validators import (
    required_nonempty,
    min_length,
    regex_match,
    placeholder_check,
    date_parse,
    date_not_past,
    date_order,
    email_format,
    phone_format,
    state_code_valid,
    zip_valid,
    npi_format,
    dea_format,
    validate_submission_fields,
    calculate_field_validation_impact,
    get_field_validation_stats,
    FieldIssue,
)


# ============================================================================
# Validator Function Tests
# ============================================================================

def test_required_nonempty_missing():
    """Test required_nonempty detects missing values"""
    issue = required_nonempty(None, "test_field")
    assert issue is not None
    assert issue.severity == "critical"
    assert issue.check == "required_nonempty"
    assert "missing" in issue.message.lower()


def test_required_nonempty_empty_string():
    """Test required_nonempty detects empty strings"""
    issue = required_nonempty("", "test_field")
    assert issue is not None
    assert issue.severity == "critical"


def test_required_nonempty_whitespace():
    """Test required_nonempty detects whitespace-only strings"""
    issue = required_nonempty("   ", "test_field")
    assert issue is not None
    assert issue.severity == "critical"


def test_required_nonempty_valid():
    """Test required_nonempty passes valid value"""
    issue = required_nonempty("valid value", "test_field")
    assert issue is None


def test_min_length_too_short():
    """Test min_length detects short values"""
    issue = min_length("abc", "test_field", 5)
    assert issue is not None
    assert issue.severity == "medium"
    assert "at least 5 characters" in issue.message


def test_min_length_valid():
    """Test min_length passes sufficient length"""
    issue = min_length("abcdef", "test_field", 5)
    assert issue is None


def test_email_format_invalid():
    """Test email_format detects invalid emails"""
    issue = email_format("not-an-email", "email")
    assert issue is not None
    assert issue.severity == "medium"


def test_email_format_valid():
    """Test email_format passes valid email"""
    issue = email_format("user@example.com", "email")
    assert issue is None


def test_phone_format_invalid():
    """Test phone_format detects invalid phone numbers"""
    issue = phone_format("123", "phone")
    assert issue is not None
    assert "10 digits" in issue.message


def test_phone_format_valid():
    """Test phone_format passes valid phone with separators"""
    issue = phone_format("(555) 123-4567", "phone")
    assert issue is None


def test_state_code_invalid():
    """Test state_code_valid detects invalid state codes"""
    issue = state_code_valid("XX", "state")
    assert issue is not None
    assert issue.severity == "medium"


def test_state_code_valid():
    """Test state_code_valid passes valid state codes"""
    assert state_code_valid("CA", "state") is None
    assert state_code_valid("NY", "state") is None
    assert state_code_valid("DC", "state") is None


def test_zip_valid_invalid():
    """Test zip_valid detects invalid ZIP codes"""
    issue = zip_valid("123", "zip")
    assert issue is not None
    assert "5 or 9 digits" in issue.message


def test_zip_valid_5_digit():
    """Test zip_valid passes 5-digit ZIP"""
    issue = zip_valid("12345", "zip")
    assert issue is None


def test_zip_valid_9_digit():
    """Test zip_valid passes ZIP+4"""
    issue = zip_valid("12345-6789", "zip")
    assert issue is None


def test_npi_format_invalid():
    """Test npi_format detects invalid NPI"""
    issue = npi_format("123", "npi")
    assert issue is not None
    assert issue.severity == "critical"
    assert "10 digits" in issue.message


def test_npi_format_valid():
    """Test npi_format passes valid 10-digit NPI"""
    issue = npi_format("1234567890", "npi")
    assert issue is None


def test_dea_format_invalid():
    """Test dea_format detects invalid DEA number"""
    issue = dea_format("123456", "dea_number")
    assert issue is not None
    assert issue.severity == "critical"


def test_dea_format_valid():
    """Test dea_format passes valid DEA number"""
    issue = dea_format("AB1234567", "dea_number")
    assert issue is None


def test_date_parse_invalid():
    """Test date_parse detects unparseable dates"""
    issue = date_parse("not-a-date", "date_field")
    assert issue is not None
    assert issue.severity == "medium"


def test_date_parse_valid():
    """Test date_parse accepts valid date formats"""
    assert date_parse("2026-01-15", "date_field") is None
    assert date_parse("01/15/2026", "date_field") is None


def test_date_not_past_expired():
    """Test date_not_past detects expired dates"""
    past_date = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")
    issue = date_not_past(past_date, "expiry_date")
    assert issue is not None
    assert issue.severity == "critical"
    assert "expired" in issue.message.lower()


def test_date_not_past_future():
    """Test date_not_past passes future dates"""
    future_date = (datetime.now() + timedelta(days=30)).strftime("%Y-%m-%d")
    issue = date_not_past(future_date, "expiry_date")
    assert issue is None


def test_date_order_invalid():
    """Test date_order detects start after end"""
    issue = date_order("2026-12-31", "2026-01-01", "start_date", "end_date")
    assert issue is not None
    assert issue.severity == "medium"


def test_date_order_valid():
    """Test date_order passes correct ordering"""
    issue = date_order("2026-01-01", "2026-12-31", "start_date", "end_date")
    assert issue is None


def test_placeholder_check_detected():
    """Test placeholder_check detects common placeholders"""
    issue = placeholder_check("test", "name", ["test", "tbd", "n/a"])
    assert issue is not None
    assert issue.severity == "low"


def test_placeholder_check_valid():
    """Test placeholder_check passes real values"""
    issue = placeholder_check("John Doe", "name", ["test", "tbd", "n/a"])
    assert issue is None


# ============================================================================
# Decision Type Validation Tests
# ============================================================================

def test_csf_practitioner_missing_required_fields():
    """Test csf_practitioner validation catches missing required fields"""
    submission_data = {}
    
    issues = validate_submission_fields(submission_data, "csf_practitioner")
    
    # Should have critical issues for missing required fields
    critical_issues = [i for i in issues if i.severity == "critical"]
    assert len(critical_issues) > 0
    
    # Check for specific required fields
    field_names = [i.field for i in critical_issues]
    assert "practitioner_name" in field_names
    assert "npi" in field_names
    assert "dea_number" in field_names


def test_csf_practitioner_invalid_formats():
    """Test csf_practitioner validation catches format errors"""
    submission_data = {
        "practitioner_name": "Dr. Smith",
        "npi": "123",  # Too short
        "dea_number": "invalid",  # Wrong format
        "license_number": "LIC123",
        "state": "XX",  # Invalid state
        "email": "not-an-email",
        "phone": "123",
    }
    
    issues = validate_submission_fields(submission_data, "csf_practitioner")
    
    # Should have format issues
    format_issues = [i for i in issues if i.check in ["npi_format", "dea_format", "state_code_valid", "email_format", "phone_format"]]
    assert len(format_issues) >= 5


def test_csf_facility_validation():
    """Test csf_facility validation works"""
    submission_data = {
        "facility_name": "Test Hospital",
        "dea_registration": "AB1234567",
        "state_license": "LIC123",
        "state": "CA",
        "contact_email": "contact@hospital.com",
        "address": "123 Main St",
        "city": "Los Angeles",
        "zip": "90001",
    }
    
    issues = validate_submission_fields(submission_data, "csf_facility")
    
    # Should have minimal or no issues with valid data
    critical_issues = [i for i in issues if i.severity == "critical"]
    assert len(critical_issues) == 0


def test_csf_validation():
    """Test csf validation includes license expiry checks"""
    past_date = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")
    
    submission_data = {
        "license_number": "LIC123",
        "license_expiry_date": past_date,  # Expired
        "applicant_name": "John Doe",
        "state": "NY",
        "email": "john@example.com",
    }
    
    issues = validate_submission_fields(submission_data, "csf")
    
    # Should have critical issue for expired license
    critical_issues = [i for i in issues if i.severity == "critical"]
    expired_issues = [i for i in critical_issues if "expired" in i.message.lower()]
    assert len(expired_issues) > 0


def test_csa_validation():
    """Test csa validation works"""
    submission_data = {
        "applicant_name": "ABC Corporation",
        "application_type": "manufacturer",
        "substance_schedule": "Schedule II",
        "state": "TX",
        "contact_email": "contact@example.com",
        "business_address": "123 Business Blvd",
        "zip": "75001",
    }
    
    issues = validate_submission_fields(submission_data, "csa")
    
    # Should have no critical issues
    critical_issues = [i for i in issues if i.severity == "critical"]
    assert len(critical_issues) == 0


# ============================================================================
# Confidence Impact Tests
# ============================================================================

def test_critical_field_issue_caps_at_40():
    """Test critical field issue caps confidence at 40%"""
    base_confidence = 85.0
    field_issues = [
        FieldIssue("npi", "critical", "npi_format", "NPI must be 10 digits")
    ]
    
    adjusted, rationale = calculate_field_validation_impact(base_confidence, field_issues)
    
    assert adjusted == 40.0
    assert "40%" in rationale


def test_three_medium_issues_cap_at_70():
    """Test 3+ medium issues cap confidence at 70%"""
    base_confidence = 90.0
    field_issues = [
        FieldIssue("email", "medium", "email_format", "Invalid email"),
        FieldIssue("phone", "medium", "phone_format", "Invalid phone"),
        FieldIssue("state", "medium", "state_code_valid", "Invalid state"),
    ]
    
    adjusted, rationale = calculate_field_validation_impact(base_confidence, field_issues)
    
    assert adjusted == 70.0
    assert "70%" in rationale


def test_low_issues_reduce_by_1_percent_each():
    """Test low issues reduce confidence by 1% each"""
    base_confidence = 80.0
    field_issues = [
        FieldIssue("name", "low", "placeholder_value", "Placeholder detected"),
        FieldIssue("email", "low", "placeholder_value", "Placeholder detected"),
        FieldIssue("phone", "low", "placeholder_value", "Placeholder detected"),
    ]
    
    adjusted, rationale = calculate_field_validation_impact(base_confidence, field_issues)
    
    assert adjusted == 77.0  # 80 - 3
    assert "3 low-priority field issue(s)" in rationale


def test_low_issues_capped_at_10_percent_reduction():
    """Test low issues max reduction is 10%"""
    base_confidence = 90.0
    field_issues = [
        FieldIssue(f"field_{i}", "low", "placeholder_value", "Placeholder")
        for i in range(15)  # 15 low issues
    ]
    
    adjusted, rationale = calculate_field_validation_impact(base_confidence, field_issues)
    
    # Should reduce by max 10%, so 90 - 10 = 80
    assert adjusted == 80.0


def test_critical_caps_even_with_already_low_confidence():
    """Test critical issue doesn't raise confidence if already below cap"""
    base_confidence = 30.0  # Already below 40%
    field_issues = [
        FieldIssue("npi", "critical", "npi_format", "Invalid NPI")
    ]
    
    adjusted, rationale = calculate_field_validation_impact(base_confidence, field_issues)
    
    # Should stay at 30%, not raised to 40%
    assert adjusted == 30.0


def test_mixed_severity_issues():
    """Test combination of different severity issues"""
    base_confidence = 95.0
    field_issues = [
        FieldIssue("npi", "critical", "npi_format", "Invalid NPI"),
        FieldIssue("email", "medium", "email_format", "Invalid email"),
        FieldIssue("name", "low", "placeholder_value", "Placeholder"),
    ]
    
    adjusted, rationale = calculate_field_validation_impact(base_confidence, field_issues)
    
    # Critical issue caps at 40%
    assert adjusted == 40.0


# ============================================================================
# Stats Tests
# ============================================================================

def test_field_validation_stats():
    """Test field validation stats calculation"""
    field_issues = [
        FieldIssue("npi", "critical", "npi_format", "Invalid"),
        FieldIssue("email", "medium", "email_format", "Invalid"),
    ]
    
    stats = get_field_validation_stats(field_issues, "csf_practitioner")
    
    # csf_practitioner has ~15 validation checks
    assert stats["field_checks_total"] > 10
    # With 2 failures, passed should be total - 2
    assert stats["field_checks_passed"] == stats["field_checks_total"] - 2


# ============================================================================
# Integration Tests
# ============================================================================

def test_end_to_end_validation_flow():
    """Test complete validation flow from submission to confidence adjustment"""
    submission_data = {
        "practitioner_name": "Dr. Jane Smith",
        "npi": "123",  # Invalid - too short
        "dea_number": "AB1234567",  # Valid
        "license_number": "LIC123",
        "state": "CA",
        "email": "jane.smith@example.com",
        "phone": "(555) 123-4567",
        "address": "123 Medical Plaza",
        "city": "San Francisco",
        "zip": "94102",
    }
    
    # Step 1: Validate
    issues = validate_submission_fields(submission_data, "csf_practitioner")
    
    # Step 2: Check we found the NPI issue
    npi_issues = [i for i in issues if i.field == "npi"]
    assert len(npi_issues) > 0
    assert any(i.severity == "critical" for i in npi_issues)
    
    # Step 3: Calculate impact
    base_confidence = 80.0
    adjusted, rationale = calculate_field_validation_impact(base_confidence, issues)
    
    # Should be capped at 40% due to critical NPI issue
    assert adjusted == 40.0
    assert "critical" in rationale.lower()


def test_perfect_submission_no_issues():
    """Test that perfect submission generates no issues"""
    future_date = (datetime.now() + timedelta(days=365)).strftime("%Y-%m-%d")
    
    submission_data = {
        "license_number": "LIC123456",
        "license_expiry_date": future_date,
        "applicant_name": "John Smith",
        "state": "NY",
        "email": "john.smith@example.com",
        "phone": "555-123-4567",
        "zip": "10001",
    }
    
    issues = validate_submission_fields(submission_data, "csf")
    
    # Should have no critical or medium issues
    critical_issues = [i for i in issues if i.severity == "critical"]
    medium_issues = [i for i in issues if i.severity == "medium"]
    
    assert len(critical_issues) == 0
    assert len(medium_issues) == 0


def test_multiple_decision_types():
    """Test that each decision type has validation checks"""
    for decision_type in ["csf_practitioner", "csf_facility", "csf", "csa"]:
        issues = validate_submission_fields({}, decision_type)
        # Empty submission should trigger required field issues
        assert len(issues) > 0
