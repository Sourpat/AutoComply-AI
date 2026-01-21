"""
Phase 7.31: PII Scanner Tests
Tests for advanced PII detection and redaction reporting.

Author: AutoComply AI
Date: 2026-01-20
"""

import pytest
from app.intelligence.pii_scanner import (
    detect_pii,
    count_findings_by_rule,
    generate_findings_sample,
    get_unique_paths,
    PIIFinding
)
from app.intelligence.redaction import redact_export


# ============================================================================
# PII Scanner Tests
# ============================================================================

def test_scanner_detects_email():
    """Test email pattern detection."""
    data = {
        "contact": "john.doe@example.com",
        "notes": "Reach out to admin@company.org for help"
    }
    
    findings = detect_pii(data)
    email_findings = [f for f in findings if f.rule == "email"]
    
    assert len(email_findings) >= 1
    assert any("john.doe@example.com" in f.value_preview for f in email_findings)


def test_scanner_detects_phone():
    """Test phone number detection."""
    data = {
        "phone": "555-123-4567",
        "contact": "Call 555.987.6543 for info"
    }
    
    findings = detect_pii(data)
    phone_findings = [f for f in findings if f.rule == "phone"]
    
    assert len(phone_findings) >= 1
    assert any("555" in f.value_preview for f in phone_findings)


def test_scanner_detects_ssn():
    """Test SSN pattern detection."""
    data = {
        "ssn": "123-45-6789",
        "notes": "Patient SSN: 987-65-4321"
    }
    
    findings = detect_pii(data)
    ssn_findings = [f for f in findings if f.rule == "ssn"]
    
    assert len(ssn_findings) >= 1


def test_scanner_detects_dea_license():
    """Test DEA and license number detection."""
    data = {
        "dea_number": "DEA-AB1234567",
        "license": "LICENSE-NY123456"
    }
    
    findings = detect_pii(data)
    dea_findings = [f for f in findings if f.rule == "dea"]
    license_findings = [f for f in findings if f.rule == "license"]
    
    assert len(dea_findings) >= 1
    assert len(license_findings) >= 1


def test_scanner_detects_sensitive_field_names():
    """Test detection based on sensitive field names."""
    data = {
        "patient_name": "John Doe",
        "email": "test@example.com",
        "address": "123 Main St"
    }
    
    findings = detect_pii(data)
    field_findings = [f for f in findings if f.rule == "sensitive_field_name"]
    
    # Should detect patient_name, email, address as sensitive fields
    assert len(field_findings) >= 3
    field_names = {f.field_name for f in field_findings}
    assert "patient_name" in field_names
    assert "address" in field_names


def test_scanner_nested_traversal():
    """Test PII detection in nested structures."""
    data = {
        "history": [
            {
                "payload": {
                    "patient": {
                        "email": "patient@hospital.com",
                        "phone": "555-0001"
                    }
                }
            },
            {
                "evidence": {
                    "contact_info": "Call 555-0002"
                }
            }
        ]
    }
    
    findings = detect_pii(data)
    
    # Should find emails and phones in nested structures
    email_findings = [f for f in findings if f.rule == "email"]
    phone_findings = [f for f in findings if f.rule == "phone"]
    
    assert len(email_findings) >= 1
    assert len(phone_findings) >= 2
    
    # Check JSONPath-like paths
    paths = [f.path for f in findings]
    assert any("history[0]" in p for p in paths)
    assert any("history[1]" in p for p in paths)


def test_count_findings_by_rule():
    """Test aggregation of findings by rule type."""
    findings = [
        PIIFinding("$.email", "email", "email", "test@example.com"),
        PIIFinding("$.phone", "phone", "phone", "555-1234"),
        PIIFinding("$.email2", "email2", "email", "admin@example.com"),
    ]
    
    counts = count_findings_by_rule(findings)
    
    assert counts["email"] == 2
    assert counts["phone"] == 1
    assert len(counts) == 2


def test_generate_findings_sample_truncates():
    """Test findings sample generation respects max limit."""
    findings = [
        PIIFinding(f"$.field{i}", f"field{i}", "email", "test@example.com")
        for i in range(30)
    ]
    
    sample = generate_findings_sample(findings, max_items=20)
    
    assert len(sample) == 20
    assert all(isinstance(item, dict) for item in sample)
    assert all("path" in item for item in sample)


def test_get_unique_paths():
    """Test unique path extraction from findings."""
    findings = [
        PIIFinding("$.email", "email", "email", "test"),
        PIIFinding("$.phone", "phone", "phone", "555"),
        PIIFinding("$.email", "email", "email", "admin"),  # Duplicate path
    ]
    
    paths = get_unique_paths(findings)
    
    assert len(paths) == 2  # Only unique paths
    assert "$.email" in paths
    assert "$.phone" in paths


# ============================================================================
# Redaction Report Tests
# ============================================================================

def test_redaction_report_structure():
    """Test that redaction report has all required fields."""
    export_data = {
        "metadata": {"case_id": "case_123"},
        "history": [
            {
                "id": "run_1",
                "computed_at": "2026-01-20T10:00:00Z",
                "intelligence_payload": {
                    "patient_email": "patient@example.com",
                    "confidence_score": 85
                }
            }
        ]
    }
    
    result = redact_export(
        export_data,
        role="verifier",
        safe_mode=True,
        include_payload=False,
        include_evidence=False
    )
    
    # Check export_metadata structure
    assert "export_metadata" in result
    assert "redaction_report" in result["export_metadata"]
    
    report = result["export_metadata"]["redaction_report"]
    
    # Phase 7.31: Required fields
    assert "mode" in report
    assert "findings_count" in report
    assert "redacted_fields_count" in report
    assert "redacted_fields_sample" in report
    assert "rules_triggered" in report
    assert "retention_applied" in report
    
    # Validate types
    assert isinstance(report["findings_count"], int)
    assert isinstance(report["redacted_fields_count"], int)
    assert isinstance(report["redacted_fields_sample"], list)
    assert isinstance(report["rules_triggered"], dict)
    assert isinstance(report["retention_applied"], bool)


def test_redaction_report_pii_findings():
    """Test that PII findings are captured in report."""
    export_data = {
        "metadata": {"case_id": "case_123"},
        "history": [
            {
                "id": "run_1",
                "computed_at": "2026-01-20T10:00:00Z",
                "patient_name": "John Doe",
                "email": "john@example.com",
                "phone": "555-1234"
            }
        ]
    }
    
    result = redact_export(export_data, role="verifier")
    report = result["export_metadata"]["redaction_report"]
    
    # Should detect multiple PII instances
    assert report["findings_count"] > 0
    
    # Should have rule counts
    assert "rules_triggered" in report
    rules = report["rules_triggered"]
    # Expect email, phone, and sensitive_field_name detections
    assert len(rules) >= 2


def test_redaction_report_safe_mode_includes_findings():
    """Test that safe mode includes PII findings in report."""
    export_data = {
        "metadata": {"case_id": "case_123"},
        "history": [
            {
                "patient_email": "sensitive@example.com"
            }
        ]
    }
    
    result = redact_export(export_data, role="verifier", safe_mode=True)
    report = result["export_metadata"]["redaction_report"]
    
    assert "pii_findings_sample" in report
    assert isinstance(report["pii_findings_sample"], list)
    # Safe mode should include findings
    assert len(report["pii_findings_sample"]) > 0


def test_redaction_report_full_mode_no_findings():
    """Test that full mode does not include PII findings sample."""
    export_data = {
        "metadata": {"case_id": "case_123"},
        "history": [
            {
                "email": "test@example.com"
            }
        ]
    }
    
    result = redact_export(export_data, role="admin", safe_mode=False)
    report = result["export_metadata"]["redaction_report"]
    
    assert "pii_findings_sample" in report
    # Full mode should not expose findings
    assert report["pii_findings_sample"] == []


def test_redaction_report_retention_stats():
    """Test that retention statistics are included when applied."""
    from datetime import datetime, timedelta, timezone
    
    # Create old entry that should trigger retention
    old_date = (datetime.now(timezone.utc) - timedelta(days=35)).isoformat() + "Z"
    
    export_data = {
        "metadata": {"case_id": "case_123"},
        "history": [
            {
                "id": "run_1",
                "computed_at": old_date,
                "evidence_snapshot": {"data": "test"},
                "evidence_hash": "hash123"
            }
        ]
    }
    
    result = redact_export(export_data, role="admin", safe_mode=False)
    report = result["export_metadata"]["redaction_report"]
    
    # Retention should be applied
    assert report["retention_applied"] is True
    assert "retention_stats" in report
    assert report["retention_stats"] is not None
    assert "evidence_expired" in report["retention_stats"]


def test_redaction_report_deterministic():
    """Test that report fields are stable and deterministic."""
    export_data = {
        "metadata": {"case_id": "case_123"},
        "history": [
            {
                "email": "test@example.com",
                "intelligence_payload": {"confidence": 85}
            }
        ]
    }
    
    # Run twice with same input
    result1 = redact_export(export_data.copy(), role="verifier")
    result2 = redact_export(export_data.copy(), role="verifier")
    
    report1 = result1["export_metadata"]["redaction_report"]
    report2 = result2["export_metadata"]["redaction_report"]
    
    # Reports should be identical
    assert report1["mode"] == report2["mode"]
    assert report1["findings_count"] == report2["findings_count"]
    assert report1["redacted_fields_count"] == report2["redacted_fields_count"]
    assert report1["rules_triggered"] == report2["rules_triggered"]


def test_verifier_export_includes_redaction_report():
    """Test that verifier export includes complete redaction report."""
    export_data = {
        "metadata": {"case_id": "case_123"},
        "history": [
            {
                "id": "run_1",
                "computed_at": "2026-01-20T10:00:00Z",
                "patient_name": "Test Patient",
                "email": "patient@example.com"
            }
        ]
    }
    
    result = redact_export(export_data, role="verifier")
    
    # Verifier should get redaction report
    assert "export_metadata" in result
    assert "redaction_report" in result["export_metadata"]
    
    report = result["export_metadata"]["redaction_report"]
    
    # Safe mode enforced
    assert report["mode"] == "safe"
    
    # PII detected
    assert report["findings_count"] > 0
    
    # Payload redacted
    assert report["redacted_fields_count"] > 0
