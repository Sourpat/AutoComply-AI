"""
Phase 7.28: Retention & Redaction Tests
Tests for safe-by-default audit exports with role-based permissions.

Author: AutoComply AI
Date: 2026-01-20
"""

import pytest
import json
from datetime import datetime, timedelta
from unittest.mock import Mock

from app.intelligence.redaction import (
    redact_export,
    apply_retention_policy,
    mask_identifier,
    redact_pii,
    EVIDENCE_RETENTION_DAYS,
    PAYLOAD_RETENTION_DAYS
)
from app.intelligence.signing import verify_audit_export


# ============================================================================
# Redaction Utility Tests
# ============================================================================

def test_mask_identifier():
    """Test identifier masking keeps last 4 characters."""
    assert mask_identifier("DEA-AB1234567") == "*********4567"
    assert mask_identifier("LICENSE-12345") == "*********2345"  # Last 4 chars
    assert mask_identifier("ABC") == "***"  # All masked if <= 4 chars
    assert mask_identifier("") == ""


def test_redact_pii():
    """Test PII redaction patterns."""
    text = "Contact john.doe@example.com or call 555-123-4567 for SSN 123-45-6789"
    redacted = redact_pii(text)
    
    assert "[EMAIL_REDACTED]" in redacted
    assert "john.doe@example.com" not in redacted
    
    assert "[PHONE_REDACTED]" in redacted
    assert "555-123-4567" not in redacted
    
    assert "[ID_REDACTED]" in redacted
    assert "123-45-6789" not in redacted


def test_retention_policy_evidence_expired():
    """Test evidence snapshot expires after retention period."""
    now = datetime.utcnow()
    old_date = (now - timedelta(days=EVIDENCE_RETENTION_DAYS + 5)).isoformat() + "Z"
    
    entries = [
        {
            "id": "run_1",
            "computed_at": old_date,
            "evidence_snapshot": {"case": {"status": "pending"}},
            "evidence_hash": "hash_abc123",
            "intelligence_payload": {"confidence_score": 85}
        }
    ]
    
    result = apply_retention_policy(entries)
    
    # Evidence snapshot should be None
    assert result[0]["evidence_snapshot"] is None
    
    # Evidence hash should remain
    assert result[0]["evidence_hash"] == "hash_abc123"
    
    # Metadata flags
    assert result[0]["_retention_applied"] is True
    assert result[0]["_evidence_expired"] is True


def test_retention_policy_payload_expired():
    """Test intelligence payload expires after retention period."""
    now = datetime.utcnow()
    old_date = (now - timedelta(days=PAYLOAD_RETENTION_DAYS + 5)).isoformat() + "Z"
    
    entries = [
        {
            "id": "run_1",
            "computed_at": old_date,
            "intelligence_payload": {"confidence_score": 85, "gaps": []},
            "input_hash": "hash_xyz789",
        }
    ]
    
    result = apply_retention_policy(entries)
    
    # Payload should be None
    assert result[0]["intelligence_payload"] is None
    
    # Input hash should remain
    assert result[0]["input_hash"] == "hash_xyz789"
    
    # Metadata flags
    assert result[0]["_retention_applied"] is True
    assert result[0]["_payload_expired"] is True


def test_retention_policy_recent_data_kept():
    """Test recent data is not expired."""
    now = datetime.utcnow()
    recent_date = (now - timedelta(days=5)).isoformat() + "Z"
    
    entries = [
        {
            "id": "run_1",
            "computed_at": recent_date,
            "evidence_snapshot": {"case": {"status": "pending"}},
            "evidence_hash": "hash_abc",
            "intelligence_payload": {"confidence_score": 85},
            "input_hash": "hash_xyz",
        }
    ]
    
    result = apply_retention_policy(entries)
    
    # Both should be kept
    assert result[0]["evidence_snapshot"] is not None
    assert result[0]["intelligence_payload"] is not None
    
    # No retention flags
    assert "_retention_applied" not in result[0]


# ============================================================================
# Role-Based Export Tests
# ============================================================================

def test_verifier_export_forced_safe_mode():
    """Test verifier role is forced into safe redaction mode."""
    export_data = {
        "metadata": {"case_id": "case_123"},
        "history": [
            {
                "id": "run_1",
                "confidence_score": 85,
                "intelligence_payload": {"gaps": [], "bias_flags": []},
                "evidence_snapshot": {"case": {"status": "pending"}},
            }
        ]
    }
    
    result = redact_export(
        export_data,
        role="verifier",
        safe_mode=False,  # Verifier overrides this to True
        include_payload=True,  # Verifier overrides this to False
        include_evidence=True  # Verifier overrides this to False
    )
    
    # Verify safe mode was enforced
    assert result["export_metadata"]["redaction_mode"] == "safe"
    assert result["export_metadata"]["permissions"]["role"] == "verifier"
    assert result["export_metadata"]["permissions"]["include_payload"] is False
    assert result["export_metadata"]["permissions"]["include_evidence"] is False
    
    # Payload and evidence should be removed
    assert result["history"][0]["intelligence_payload"] is None
    assert result["history"][0]["evidence_snapshot"] is None


def test_admin_export_full_mode():
    """Test admin can export in full mode with payload/evidence."""
    export_data = {
        "metadata": {"case_id": "case_123"},
        "history": [
            {
                "id": "run_1",
                "computed_at": datetime.utcnow().isoformat() + "Z",
                "confidence_score": 85,
                "intelligence_payload": {"gaps": [], "bias_flags": []},
                "evidence_snapshot": {"case": {"status": "pending"}},
            }
        ]
    }
    
    result = redact_export(
        export_data,
        role="admin",
        safe_mode=False,  # Admin chooses full mode
        include_payload=True,
        include_evidence=True
    )
    
    # Verify full mode
    assert result["export_metadata"]["redaction_mode"] == "full"
    assert result["export_metadata"]["permissions"]["role"] == "admin"
    assert result["export_metadata"]["permissions"]["include_payload"] is True
    assert result["export_metadata"]["permissions"]["include_evidence"] is True
    
    # Payload and evidence should be included
    assert result["history"][0]["intelligence_payload"] is not None
    assert result["history"][0]["evidence_snapshot"] is not None


def test_admin_can_choose_safe_mode():
    """Test admin can voluntarily choose safe mode."""
    export_data = {
        "metadata": {"case_id": "case_123"},
        "history": [
            {
                "id": "run_1",
                "confidence_score": 85,
                "intelligence_payload": {"gaps": []},
                "evidence_snapshot": {"case": {}},
            }
        ]
    }
    
    result = redact_export(
        export_data,
        role="admin",
        safe_mode=True,  # Admin chooses safe mode
        include_payload=False,
        include_evidence=False
    )
    
    # Verify safe mode
    assert result["export_metadata"]["redaction_mode"] == "safe"
    assert result["export_metadata"]["permissions"]["include_payload"] is False
    assert result["export_metadata"]["permissions"]["include_evidence"] is False


# ============================================================================
# Fixtures
# ============================================================================

@pytest.fixture
def setup_test_case():
    """Create test case for export tests."""
    from app.workflow.repo import create_case
    from app.workflow.models import CaseCreateInput
    
    case = create_case(
        CaseCreateInput(
            decisionType="csf",
            title="Test Export Case",
            assignedTo="verifier@test.com"
        )
    )
    return case.id


@pytest.fixture
def sample_intelligence_payload():
    """Sample intelligence payload for testing."""
    return {
        "confidence_score": 85.0,
        "confidence_band": "HIGH",
        "completeness_score": 90.0,
        "gaps": [{"question_id": "q1", "severity": "MEDIUM"}],
        "bias_flags": [],
        "computed_at": datetime.utcnow().isoformat() + "Z",
    }


def test_export_retention_drops_expired_evidence(setup_test_case):
    """Test retention policy drops evidence_snapshot but keeps evidence_hash."""
    from app.intelligence.router import export_audit_trail
    from app.intelligence.repository import insert_intelligence_history
    from datetime import datetime, timedelta
    
    case_id = setup_test_case
    
    # Create old intelligence entry (beyond retention)
    now = datetime.utcnow()
    old_date = (now - timedelta(days=EVIDENCE_RETENTION_DAYS + 10)).isoformat() + "Z"
    
    old_payload = {
        "case_id": case_id,
        "computed_at": old_date,
        "confidence_score": 80.0,
        "confidence_band": "MEDIUM",
        "gaps": [],
        "bias_flags": [],
    }
    
    # Insert with old date
    insert_intelligence_history(case_id, old_payload)
    
    # Export (calls endpoint directly without request object, gets admin role by default)
    result = export_audit_trail(case_id, include_evidence=True)
    
    # Evidence snapshot should be None (expired)
    assert result["history"][0]["evidence_snapshot"] is None
    
    # Evidence hash should remain
    assert "evidence_hash" in result["history"][0]
    assert result["history"][0]["evidence_hash"] is not None
