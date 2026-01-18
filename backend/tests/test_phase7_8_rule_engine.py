"""
Phase 7.8 Tests - Rule-Based Confidence V1

Tests rule-based validation engine for all case types:
- csf_practitioner
- csf_facility
- csf (generic)
- csa

Verifies:
- Rule evaluation logic
- Confidence calculation with severity caps
- Failed rule details in API response
"""

import pytest
from app.intelligence.rules_engine import (
    evaluate_case,
    compute_confidence,
    get_rule_pack,
    RuleSeverity
)


# =============================================================================
# CSF Practitioner Tests
# =============================================================================

def test_csf_practitioner_perfect_submission():
    """Test CSF practitioner with all fields present - should get high confidence."""
    payload = {
        "name": "Dr. Jane Smith",
        "license_number": "MD-12345",
        "state": "CA",
        "specialty": "Pain Management",
        "years_experience": 10,
        "address": "123 Medical Plaza",
        "email": "dr.smith@medical.com",
        "zip": "90210",
        "phone": "555-1234",
        "dea_number": "BS1234563"
    }
    
    results = evaluate_case("csf_practitioner", payload)
    confidence, band, summary = compute_confidence(results)
    
    # Should pass all 10 rules
    assert summary["rules_total"] == 10
    assert summary["rules_passed"] == 10
    assert summary["rules_failed_count"] == 0
    assert len(summary["failed_rules"]) == 0
    
    # Perfect score
    assert confidence == 100.0
    assert band == "high"


def test_csf_practitioner_missing_critical_field():
    """Test CSF practitioner missing critical field - confidence capped at 40%."""
    payload = {
        # "name": missing (CRITICAL)
        "license_number": "MD-12345",
        "state": "CA",
        "specialty": "Pain Management",
        "years_experience": 10,
        "address": "123 Medical Plaza",
        "email": "dr.smith@medical.com",
        "zip": "90210",
        "phone": "555-1234",
        "dea_number": "BS1234563"
    }
    
    results = evaluate_case("csf_practitioner", payload)
    confidence, band, summary = compute_confidence(results)
    
    # Should fail 1 critical rule
    assert summary["rules_failed_count"] == 1
    assert summary["failed_by_severity"]["critical"] == 1
    
    # Critical failure caps at 40%
    assert confidence <= 40.0
    assert band == "low" or band == "medium"
    
    # Check failed rule details
    failed_rule = summary["failed_rules"][0]
    assert failed_rule["rule_id"] == "csf_prac_name_present"
    assert failed_rule["severity"] == "critical"
    assert "name" in failed_rule["message"].lower()


def test_csf_practitioner_three_medium_failures():
    """Test CSF practitioner with 3+ medium failures - confidence capped at 70%."""
    payload = {
        "name": "Dr. Jane Smith",
        "license_number": "MD-12345",
        "state": "CA",
        # "specialty": missing (MEDIUM)
        # "years_experience": missing (MEDIUM)
        # "address": missing (MEDIUM)
        "email": "invalid-email",  # Invalid format (MEDIUM)
        "zip": "90210",
        "phone": "555-1234",
        "dea_number": "BS1234563"
    }
    
    results = evaluate_case("csf_practitioner", payload)
    confidence, band, summary = compute_confidence(results)
    
    # Should have >=3 medium failures
    assert summary["failed_by_severity"]["medium"] >= 3
    
    # 3+ medium failures cap at 70%
    assert confidence <= 70.0
    assert band == "medium"


# =============================================================================
# CSF Facility Tests
# =============================================================================

def test_csf_facility_perfect_submission():
    """Test CSF facility with all fields present."""
    payload = {
        "facility_name": "Advanced Pain Clinic",
        "facility_license": "FAC-2024-001",
        "state": "TX",
        "address": "456 Healthcare Blvd",
        "facility_type": "Outpatient Clinic",
        "capacity": 50,
        "medical_director": "Dr. John Doe",
        "email": "info@advancedpain.com",
        "zip": "75001",
        "accreditation": "JCAHO"
    }
    
    results = evaluate_case("csf_facility", payload)
    confidence, band, summary = compute_confidence(results)
    
    # Should pass all 10 rules
    assert summary["rules_total"] == 10
    assert summary["rules_passed"] == 10
    assert confidence == 100.0
    assert band == "high"


def test_csf_facility_missing_license():
    """Test CSF facility missing critical license field."""
    payload = {
        "facility_name": "Advanced Pain Clinic",
        # "facility_license": missing (CRITICAL)
        "state": "TX",
        "address": "456 Healthcare Blvd",
        "facility_type": "Outpatient Clinic",
        "capacity": 50,
        "medical_director": "Dr. John Doe",
        "email": "info@advancedpain.com"
    }
    
    results = evaluate_case("csf_facility", payload)
    confidence, band, summary = compute_confidence(results)
    
    # Critical failure caps at 40%
    assert summary["failed_by_severity"]["critical"] >= 1
    assert confidence <= 40.0
    
    # Check failed rule
    failed_critical = [r for r in summary["failed_rules"] if r["severity"] == "critical"]
    assert any("license" in r["message"].lower() for r in failed_critical)


# =============================================================================
# CSF Generic Tests
# =============================================================================

def test_csf_generic_submission():
    """Test generic CSF with basic fields (8 rules)."""
    payload = {
        "name": "Medical Center Inc",
        "license_number": "CSF-001",
        "state": "NY",
        "address": "789 Health St",
        "specialty": "General Practice",
        "email": "contact@medcenter.com",
        "zip": "10001",
        "years_experience": 5
    }
    
    results = evaluate_case("csf", payload)
    confidence, band, summary = compute_confidence(results)
    
    # Should pass all 8 rules
    assert summary["rules_total"] == 8
    assert summary["rules_passed"] == 8
    assert confidence == 100.0
    assert band == "high"


def test_csf_generic_partial_submission():
    """Test generic CSF with some missing fields."""
    payload = {
        "name": "Medical Center Inc",
        "license_number": "CSF-001",
        "state": "NY",
        # Missing: address, specialty, email, zip, years_experience
    }
    
    results = evaluate_case("csf", payload)
    confidence, band, summary = compute_confidence(results)
    
    # Should fail 5 rules (3 critical passed, 5 non-critical failed)
    assert summary["rules_passed"] == 3
    assert summary["rules_failed_count"] == 5
    
    # Confidence should be 3/8 = 37.5%, but no critical failures
    # so shouldn't be capped at 40%
    assert confidence >= 5.0  # Minimum floor
    assert confidence < 80.0


# =============================================================================
# CSA Tests
# =============================================================================

def test_csa_perfect_submission():
    """Test CSA with all fields present."""
    payload = {
        "name": "ABC Pharmaceuticals",
        "address": "123 Business Park",
        "state": "CA",
        "authorization_type": "Schedule II",
        "purpose": "Pharmaceutical Distribution",
        "email": "compliance@abcpharma.com",
        "zip": "94101",
        "responsible_person": "Jane Director"
    }
    
    results = evaluate_case("csa", payload)
    confidence, band, summary = compute_confidence(results)
    
    # Should pass all 8 rules
    assert summary["rules_total"] == 8
    assert summary["rules_passed"] == 8
    assert confidence == 100.0
    assert band == "high"


def test_csa_missing_address():
    """Test CSA missing critical address field."""
    payload = {
        "name": "ABC Pharmaceuticals",
        # "address": missing (CRITICAL)
        "state": "CA",
        "authorization_type": "Schedule II",
        "purpose": "Pharmaceutical Distribution",
        "email": "compliance@abcpharma.com"
    }
    
    results = evaluate_case("csa", payload)
    confidence, band, summary = compute_confidence(results)
    
    # Critical failure caps at 40%
    assert summary["failed_by_severity"]["critical"] >= 1
    assert confidence <= 40.0
    
    # Check failed rule
    failed = [r for r in summary["failed_rules"] if r["rule_id"] == "csa_address_present"]
    assert len(failed) == 1
    assert failed[0]["severity"] == "critical"


# =============================================================================
# Confidence Banding Tests
# =============================================================================

def test_confidence_bands():
    """Test confidence band thresholds."""
    # High: >= 80%
    payload_high = {
        "name": "Dr. Smith",
        "license_number": "MD-123",
        "state": "CA",
        "specialty": "Cardiology",
        "years_experience": 15,
        "address": "123 Med",
        "email": "dr@med.com",
        "zip": "90210"
    }
    results = evaluate_case("csf", payload_high)
    _, band, _ = compute_confidence(results)
    assert band == "high"
    
    # Medium: 40-79%
    payload_medium = {
        "name": "Dr. Smith",
        "license_number": "MD-123",
        "state": "CA",
        # Missing 5 fields = 3/8 = 37.5%, but caps don't apply
    }
    results = evaluate_case("csf", payload_medium)
    conf, band, _ = compute_confidence(results)
    # 3/8 = 37.5% is technically "low", but let's verify the band assignment
    if conf >= 40:
        assert band == "medium"
    else:
        assert band == "low"


# =============================================================================
# Severity Cap Tests
# =============================================================================

def test_critical_failure_caps_at_40():
    """Verify ANY critical failure caps confidence at 40%."""
    # Even if we pass 9/10 rules, 1 critical failure = max 40%
    payload = {
        # Missing name (CRITICAL)
        "license_number": "MD-123",
        "state": "CA",
        "specialty": "Cardiology",
        "years_experience": 15,
        "address": "123 Med",
        "email": "dr@med.com",
        "zip": "90210",
        "phone": "555-1234",
        "dea_number": "BS1234563"
    }
    
    results = evaluate_case("csf_practitioner", payload)
    confidence, _, summary = compute_confidence(results)
    
    # 9/10 = 90% normally, but critical failure caps at 40%
    assert summary["failed_by_severity"]["critical"] == 1
    assert confidence <= 40.0


def test_three_medium_failures_cap_at_70():
    """Verify 3+ medium failures cap confidence at 70%."""
    # Pass all critical rules, but fail 3+ medium
    payload = {
        "name": "Dr. Smith",
        "license_number": "MD-123",
        "state": "CA",
        # Missing 3 medium: specialty, years_experience, address
        # Missing 1 medium: email (invalid counts as missing)
        "zip": "90210",
        "phone": "555-1234",
        "dea_number": "BS1234563"
    }
    
    results = evaluate_case("csf_practitioner", payload)
    confidence, _, summary = compute_confidence(results)
    
    # Should have >=3 medium failures
    assert summary["failed_by_severity"]["medium"] >= 3
    # 6/10 or 7/10 = 60-70%, should cap at 70%
    assert confidence <= 70.0


# =============================================================================
# API Response Format Tests
# =============================================================================

def test_failed_rules_structure():
    """Verify failed rules have correct structure for API response."""
    payload = {
        "name": "Dr. Smith",
        # Missing license_number (critical)
        # Missing state (critical)
        "specialty": "Cardiology"
    }
    
    results = evaluate_case("csf_practitioner", payload)
    _, _, summary = compute_confidence(results)
    
    failed_rules = summary["failed_rules"]
    assert len(failed_rules) >= 2
    
    # Check structure
    for rule in failed_rules:
        assert "rule_id" in rule
        assert "title" in rule
        assert "severity" in rule
        assert "message" in rule
        assert "weight" in rule
        # field_path may be None
        
        # Verify severity values
        assert rule["severity"] in ["critical", "medium", "low"]


def test_rule_summary_structure():
    """Verify rule summary has all required fields."""
    payload = {"name": "Test"}
    
    results = evaluate_case("csf", payload)
    _, _, summary = compute_confidence(results)
    
    assert "rules_total" in summary
    assert "rules_passed" in summary
    assert "rules_failed_count" in summary
    assert "failed_rules" in summary
    assert "failed_by_severity" in summary
    
    assert summary["rules_total"] > 0
    assert summary["rules_passed"] + summary["rules_failed_count"] == summary["rules_total"]
    
    # Check severity breakdown
    sev = summary["failed_by_severity"]
    assert "critical" in sev
    assert "medium" in sev
    assert "low" in sev


# =============================================================================
# Edge Cases
# =============================================================================

def test_empty_payload():
    """Test with completely empty payload."""
    payload = {}
    
    results = evaluate_case("csf_practitioner", payload)
    confidence, band, summary = compute_confidence(results)
    
    # Should fail all rules
    assert summary["rules_failed_count"] == summary["rules_total"]
    assert summary["rules_passed"] == 0
    
    # Should have critical failures (name, license, state all missing)
    assert summary["failed_by_severity"]["critical"] >= 3
    
    # Critical failures cap at 40%, but 0/10 would be 0%, so caps at 40%
    # But also has minimum floor of 5%
    assert confidence >= 5.0
    assert confidence <= 40.0
    assert band == "low"


def test_minimum_floor():
    """Verify 5% minimum floor is applied."""
    # Empty payload would normally be 0%, but should have 5% floor
    results = evaluate_case("csf", {})
    confidence, _, _ = compute_confidence(results)
    
    assert confidence >= 5.0


def test_invalid_case_type_defaults_to_csf():
    """Test that unknown case types default to CSF generic rules."""
    payload = {
        "name": "Test Entity",
        "license_number": "LIC-001",
        "state": "CA"
    }
    
    # Should fall back to CSF generic (8 rules)
    results = evaluate_case("unknown_type", payload)
    _, _, summary = compute_confidence(results)
    
    assert summary["rules_total"] == 8  # CSF generic has 8 rules


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
