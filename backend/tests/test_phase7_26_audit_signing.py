"""
Phase 7.26: Signed Audit Export (HMAC) + Verification Tests

Tests for:
- Signature determinism
- Tampering detection
- Verify endpoint functionality
- Signature changes with content

Author: AutoComply AI
Date: 2026-01-20
"""

import pytest
import json
from app.intelligence.signing import (
    canonical_json,
    hmac_sign,
    hmac_verify,
    sign_audit_export,
    verify_audit_export,
)


def test_canonical_json_deterministic():
    """Test that canonical_json produces deterministic output."""
    obj1 = {"b": 2, "a": 1, "c": {"z": 3, "x": 4}}
    obj2 = {"c": {"x": 4, "z": 3}, "a": 1, "b": 2}
    
    canonical1 = canonical_json(obj1)
    canonical2 = canonical_json(obj2)
    
    assert canonical1 == canonical2, "Canonical JSON should be deterministic"
    assert canonical1 == b'{"a":1,"b":2,"c":{"x":4,"z":3}}', "Keys should be sorted"


def test_canonical_json_compact():
    """Test that canonical_json uses compact format (no whitespace)."""
    obj = {"key": "value", "number": 42}
    canonical = canonical_json(obj)
    
    # Should not contain spaces
    assert b' ' not in canonical, "Canonical JSON should not contain spaces"
    # Should use compact separators
    assert canonical == b'{"key":"value","number":42}'


def test_hmac_sign_deterministic():
    """Test that hmac_sign produces consistent signatures."""
    payload = b'{"case_id":"abc-123","confidence":85.5}'
    secret = "test-secret-key"
    
    sig1 = hmac_sign(payload, secret)
    sig2 = hmac_sign(payload, secret)
    
    assert sig1 == sig2, "HMAC signature should be deterministic"
    assert len(sig1) == 64, "SHA256 hash should be 64 hex chars"


def test_hmac_sign_changes_with_payload():
    """Test that signature changes when payload changes."""
    secret = "test-secret-key"
    
    payload1 = b'{"confidence":85.5}'
    payload2 = b'{"confidence":86.0}'
    
    sig1 = hmac_sign(payload1, secret)
    sig2 = hmac_sign(payload2, secret)
    
    assert sig1 != sig2, "Different payloads should produce different signatures"


def test_hmac_sign_changes_with_secret():
    """Test that signature changes when secret changes."""
    payload = b'{"case_id":"abc-123"}'
    
    sig1 = hmac_sign(payload, "secret1")
    sig2 = hmac_sign(payload, "secret2")
    
    assert sig1 != sig2, "Different secrets should produce different signatures"


def test_hmac_verify_valid():
    """Test that hmac_verify returns True for valid signatures."""
    payload = b'{"case_id":"abc-123"}'
    secret = "test-secret-key"
    
    signature = hmac_sign(payload, secret)
    is_valid = hmac_verify(payload, secret, signature)
    
    assert is_valid is True, "Valid signature should verify"


def test_hmac_verify_invalid_signature():
    """Test that hmac_verify returns False for invalid signatures."""
    payload = b'{"case_id":"abc-123"}'
    secret = "test-secret-key"
    
    # Use wrong signature
    is_valid = hmac_verify(payload, secret, "a" * 64)
    
    assert is_valid is False, "Invalid signature should not verify"


def test_hmac_verify_tampered_payload():
    """Test that hmac_verify detects tampered payloads."""
    payload = b'{"confidence":85.5}'
    tampered_payload = b'{"confidence":99.9}'
    secret = "test-secret-key"
    
    # Sign original
    signature = hmac_sign(payload, secret)
    
    # Verify with tampered payload
    is_valid = hmac_verify(tampered_payload, secret, signature)
    
    assert is_valid is False, "Tampered payload should fail verification"


def test_hmac_verify_wrong_secret():
    """Test that hmac_verify fails with wrong secret."""
    payload = b'{"case_id":"abc-123"}'
    
    signature = hmac_sign(payload, "correct-secret")
    is_valid = hmac_verify(payload, "wrong-secret", signature)
    
    assert is_valid is False, "Wrong secret should fail verification"


def test_sign_audit_export_adds_signature():
    """Test that sign_audit_export adds signature metadata."""
    export_data = {
        "metadata": {"case_id": "abc-123"},
        "history": [{"id": "hist_1", "confidence_score": 85.5}]
    }
    
    signed = sign_audit_export(export_data, secret="test-secret", key_id="k1")
    
    assert "signature" in signed, "Should add signature field"
    assert "canonicalization" in signed, "Should add canonicalization field"
    
    sig_meta = signed["signature"]
    assert sig_meta["alg"] == "HMAC-SHA256"
    assert sig_meta["key_id"] == "k1"
    assert "value" in sig_meta
    assert "signed_at" in sig_meta


def test_sign_audit_export_deterministic():
    """Test that signing same export twice produces same signature."""
    export_data = {
        "metadata": {"case_id": "abc-123"},
        "history": [{"id": "hist_1"}]
    }
    
    # Sign twice (excluding signed_at for comparison)
    signed1 = sign_audit_export(export_data, secret="test-secret", key_id="k1")
    signed2 = sign_audit_export(export_data, secret="test-secret", key_id="k1")
    
    # Signatures should match (signed_at will differ, but value should be same)
    assert signed1["signature"]["value"] == signed2["signature"]["value"]


def test_sign_audit_export_excludes_signature():
    """Test that signature is computed without signature field itself."""
    export_data = {"metadata": {"case_id": "abc-123"}}
    
    signed = sign_audit_export(export_data, secret="test-secret")
    
    # Signature should NOT include the signature field
    canonicalization = signed["canonicalization"]
    assert "signature" in canonicalization["exclude_fields"]
    assert "canonicalization" in canonicalization["exclude_fields"]


def test_verify_audit_export_valid():
    """Test that verify_audit_export returns True for valid signature."""
    export_data = {
        "metadata": {"case_id": "abc-123"},
        "history": []
    }
    
    signed = sign_audit_export(export_data, secret="test-secret")
    result = verify_audit_export(signed, secret="test-secret")
    
    assert result["signature_valid"] is True
    assert result["key_id"] == "k1"
    assert result["algorithm"] == "HMAC-SHA256"
    assert len(result["errors"]) == 0


def test_verify_audit_export_tampered():
    """Test that verify_audit_export detects tampered content."""
    export_data = {
        "metadata": {"case_id": "abc-123"},
        "history": [{"confidence_score": 85.5}]
    }
    
    signed = sign_audit_export(export_data, secret="test-secret")
    
    # Tamper with content
    signed["metadata"]["case_id"] = "tampered-999"
    
    result = verify_audit_export(signed, secret="test-secret")
    
    assert result["signature_valid"] is False
    assert len(result["errors"]) > 0
    assert "tampered" in result["errors"][0].lower()


def test_verify_audit_export_wrong_secret():
    """Test that verify_audit_export fails with wrong secret."""
    export_data = {"metadata": {"case_id": "abc-123"}}
    
    signed = sign_audit_export(export_data, secret="correct-secret")
    result = verify_audit_export(signed, secret="wrong-secret")
    
    assert result["signature_valid"] is False


def test_verify_audit_export_no_signature():
    """Test that verify_audit_export handles missing signature."""
    unsigned_export = {"metadata": {"case_id": "abc-123"}}
    
    result = verify_audit_export(unsigned_export, secret="test-secret")
    
    assert result["signature_valid"] is False
    assert "No signature found" in result["errors"][0]


def test_signature_changes_on_field_change():
    """Test that signature changes when any field in export changes."""
    export_base = {
        "metadata": {"case_id": "abc-123"},
        "history": [{"confidence_score": 85.5}]
    }
    
    # Sign original
    signed1 = sign_audit_export(export_base.copy(), secret="test-secret")
    
    # Change confidence score
    export_modified = export_base.copy()
    export_modified["history"][0]["confidence_score"] = 86.0
    signed2 = sign_audit_export(export_modified, secret="test-secret")
    
    # Signatures should differ
    assert signed1["signature"]["value"] != signed2["signature"]["value"]


def test_signature_changes_on_input_hash_change():
    """Test that signature detects input_hash changes."""
    export1 = {
        "history": [{"input_hash": "abc123"}]
    }
    export2 = {
        "history": [{"input_hash": "def456"}]
    }
    
    signed1 = sign_audit_export(export1, secret="test-secret")
    signed2 = sign_audit_export(export2, secret="test-secret")
    
    assert signed1["signature"]["value"] != signed2["signature"]["value"]


def test_canonical_json_handles_lists():
    """Test that canonical_json preserves list order."""
    obj = {"items": [3, 1, 2]}
    canonical = canonical_json(obj)
    
    # List order should be preserved (not sorted)
    assert canonical == b'{"items":[3,1,2]}'


def test_canonical_json_handles_nested():
    """Test that canonical_json handles nested structures."""
    obj = {
        "outer": {
            "inner": {
                "z": 1,
                "a": 2
            }
        }
    }
    canonical = canonical_json(obj)
    
    # All levels should be sorted
    assert canonical == b'{"outer":{"inner":{"a":2,"z":1}}}'


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
