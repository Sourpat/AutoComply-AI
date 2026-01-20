"""
Phase 7.20 Tests: Audit Trail Integrity Hardening

Tests for:
- Append-only behavior enforcement
- Audit chain linking via previous_run_id
- Input hash computation and stability
- Integrity verification
- Audit export endpoint

Run with:
    pytest tests/test_phase7_20_audit_integrity.py -v
"""

import pytest
import json
import hashlib
from datetime import datetime
from typing import Dict, List

from app.intelligence.repository import (
    insert_intelligence_history,
    get_intelligence_history
)
from app.intelligence.integrity import (
    compute_input_hash,
    verify_audit_chain,
    detect_duplicate_computations
)
from app.workflow.repo import get_case
from src.core.db import execute_sql, execute_insert, execute_delete, get_db


# ============================================================================
# Fixtures
# ============================================================================

@pytest.fixture
def sample_case_data():
    """Sample case data for testing"""
    return {
        "id": "test_case_ph7_20",
        "status": "in_review",  # Valid CaseStatus enum value
        "submission_id": "sub_123",
        "created_at": "2026-01-19T10:00:00Z",
        "updated_at": "2026-01-19T10:00:00Z"
    }



@pytest.fixture
def sample_submission_data():
    """Sample submission data for testing"""
    return {
        "id": "sub_123",
        "facility_name": "Test Facility",
        "license_number": "LIC-2026-001",
        "responses": {
            "q1": "Answer 1",
            "q2": "Answer 2"
        }
    }


@pytest.fixture
def sample_intelligence_payload():
    """Sample intelligence payload"""
    return {
        "confidence_score": 85.0,
        "confidence_band": "HIGH",
        "rules_passed": 17,
        "rules_total": 20,
        "gaps": [{"question_id": "q1", "severity": "HIGH"}],
        "bias_flags": []
    }


@pytest.fixture
def setup_test_case(sample_case_data):
    """Create test case in database"""
    case_id = sample_case_data["id"]
    
    # Ensure intelligence_history table exists (test DB might be fresh)
    # Use direct db session for DDL statements
    from sqlalchemy import text
    with get_db() as db:
        db.execute(text("""
            CREATE TABLE IF NOT EXISTS intelligence_history (
                id TEXT PRIMARY KEY,
                case_id TEXT NOT NULL,
                computed_at TEXT NOT NULL,
                payload_json TEXT NOT NULL,
                created_at TEXT NOT NULL,
                actor TEXT DEFAULT 'system',
                reason TEXT DEFAULT '',
                previous_run_id TEXT,
                triggered_by TEXT,
                input_hash TEXT
            )
        """))
        db.execute(text("CREATE INDEX IF NOT EXISTS idx_intelligence_history_case_id ON intelligence_history(case_id)"))
        db.execute(text("CREATE INDEX IF NOT EXISTS idx_intelligence_history_previous_run ON intelligence_history(previous_run_id)"))
        db.execute(text("CREATE INDEX IF NOT EXISTS idx_intelligence_history_input_hash ON intelligence_history(case_id, input_hash)"))
        db.commit()
    
    # Clean up any existing test data
    execute_delete("DELETE FROM intelligence_history WHERE case_id = :case_id", {"case_id": case_id})
    execute_delete("DELETE FROM cases WHERE id = :case_id", {"case_id": case_id})
    
    # Insert test case directly
    execute_insert(
        """INSERT INTO cases (
            id, submission_id, title, status, decision_type, created_at, updated_at
        ) VALUES (
            :id, :submission_id, :title, :status, :decision_type, :created_at, :updated_at
        )""",
        {
            "id": case_id,
            "submission_id": sample_case_data["submission_id"],
            "title": "Test Case for Audit Trail",
            "status": sample_case_data["status"],
            "decision_type": "test_decision",
            "created_at": sample_case_data["created_at"],
            "updated_at": sample_case_data["updated_at"]
        }
    )
    
    yield case_id
    
    # Cleanup after test
    execute_delete("DELETE FROM intelligence_history WHERE case_id = :case_id", {"case_id": case_id})
    execute_delete("DELETE FROM cases WHERE id = :case_id", {"case_id": case_id})


# ============================================================================
# Test Input Hash Computation
# ============================================================================

def test_input_hash_computation(sample_case_data, sample_submission_data):
    """Test that input hash is computed correctly and consistently"""
    
    # Compute hash twice with same input
    hash1 = compute_input_hash(sample_case_data, sample_submission_data)
    hash2 = compute_input_hash(sample_case_data, sample_submission_data)
    
    # Should be identical (deterministic)
    assert hash1 == hash2, "Input hash should be deterministic"
    
    # Should be SHA256 (64 hex chars)
    assert len(hash1) == 64, "Should be SHA256 hash (64 chars)"
    assert all(c in "0123456789abcdef" for c in hash1), "Should be hex string"


def test_input_hash_changes_with_input(sample_case_data, sample_submission_data):
    """Test that input hash changes when input data changes"""
    
    hash1 = compute_input_hash(sample_case_data, sample_submission_data)
    
    # Change case status
    modified_case = {**sample_case_data, "status": "APPROVED"}
    hash2 = compute_input_hash(modified_case, sample_submission_data)
    
    assert hash1 != hash2, "Hash should change when case status changes"
    
    # Change submission data
    modified_submission = {
        **sample_submission_data,
        "responses": {"q1": "Different Answer"}
    }
    hash3 = compute_input_hash(sample_case_data, modified_submission)
    
    assert hash1 != hash3, "Hash should change when submission data changes"


def test_input_hash_handles_missing_submission():
    """Test that input hash works without submission data"""
    
    case_data = {"id": "case_123", "status": "PENDING"}
    hash_value = compute_input_hash(case_data, submission_data=None)
    
    assert hash_value is not None
    assert len(hash_value) == 64


# ============================================================================
# Test Append-Only Behavior
# ============================================================================

def test_append_only_insert(setup_test_case, sample_intelligence_payload):
    """Test that inserts create new entries without overwriting"""
    
    case_id = setup_test_case
    
    # Insert first entry
    entry_id_1 = insert_intelligence_history(
        case_id=case_id,
        payload=sample_intelligence_payload,
        actor="system",
        reason="Initial computation"
    )
    
    # Insert second entry (should create new, not overwrite)
    modified_payload = {**sample_intelligence_payload, "confidence_score": 90.0}
    entry_id_2 = insert_intelligence_history(
        case_id=case_id,
        payload=modified_payload,
        actor="system",
        reason="Recomputation"
    )
    
    # Should have different IDs
    assert entry_id_1 != entry_id_2, "Each insert should create unique entry"
    
    # Should have both entries in history
    history = get_intelligence_history(case_id, limit=10)
    assert len(history) == 2, "Should have 2 entries (append-only)"
    
    # Verify payloads are different
    scores = [h["payload"]["confidence_score"] for h in history]
    assert 85.0 in scores, "Original score should still exist"
    assert 90.0 in scores, "New score should exist"


# ============================================================================
# Test Audit Chain Linking
# ============================================================================

def test_previous_run_id_auto_linking(setup_test_case, sample_intelligence_payload):
    """Test that previous_run_id is automatically linked"""
    
    case_id = setup_test_case
    
    # Insert first entry
    entry_id_1 = insert_intelligence_history(
        case_id=case_id,
        payload=sample_intelligence_payload,
        actor="system",
        reason="First computation"
    )
    
    # Insert second entry (should auto-link to first)
    entry_id_2 = insert_intelligence_history(
        case_id=case_id,
        payload=sample_intelligence_payload,
        actor="verifier",
        reason="Recomputation"
    )
    
    # Get history
    history = get_intelligence_history(case_id, limit=10)
    
    # Find the second entry (most recent)
    second_entry = next(e for e in history if e["id"] == entry_id_2)
    
    # Should link to first entry
    assert second_entry["previous_run_id"] == entry_id_1, "Should auto-link to previous entry"


def test_previous_run_id_manual_linking(setup_test_case, sample_intelligence_payload):
    """Test that previous_run_id can be manually specified"""
    
    case_id = setup_test_case
    
    # Insert first entry
    entry_id_1 = insert_intelligence_history(
        case_id=case_id,
        payload=sample_intelligence_payload
    )
    
    # Insert second entry with explicit previous_run_id
    custom_prev_id = "custom_prev_123"
    entry_id_2 = insert_intelligence_history(
        case_id=case_id,
        payload=sample_intelligence_payload,
        previous_run_id=custom_prev_id
    )
    
    # Get history
    history = get_intelligence_history(case_id, limit=10)
    second_entry = next(e for e in history if e["id"] == entry_id_2)
    
    # Should use custom previous_run_id
    assert second_entry["previous_run_id"] == custom_prev_id, "Should use manually specified previous_run_id"


def test_audit_chain_verification_valid(setup_test_case, sample_intelligence_payload):
    """Test audit chain verification with valid chain"""
    
    case_id = setup_test_case
    
    # Create valid chain: entry1 -> entry2 -> entry3
    entry_id_1 = insert_intelligence_history(case_id, sample_intelligence_payload)
    entry_id_2 = insert_intelligence_history(case_id, sample_intelligence_payload)
    entry_id_3 = insert_intelligence_history(case_id, sample_intelligence_payload)
    
    history = get_intelligence_history(case_id, limit=10)
    
    # Verify chain
    result = verify_audit_chain(history)
    
    assert result["is_valid"] is True, "Valid chain should pass verification"
    assert len(result["broken_links"]) == 0, "Should have no broken links"
    assert len(result["orphaned_entries"]) == 0, "Should have no orphaned entries"


def test_audit_chain_verification_broken(setup_test_case, sample_intelligence_payload):
    """Test audit chain verification detects broken links"""
    
    case_id = setup_test_case
    
    # Create entry with non-existent previous_run_id
    entry_id = insert_intelligence_history(
        case_id=case_id,
        payload=sample_intelligence_payload,
        previous_run_id="non_existent_id_xyz"
    )
    
    history = get_intelligence_history(case_id, limit=10)
    
    # Verify chain
    result = verify_audit_chain(history)
    
    assert result["is_valid"] is False, "Broken chain should fail verification"
    assert len(result["broken_links"]) > 0, "Should detect broken link"


# ============================================================================
# Test Triggered By Field
# ============================================================================

def test_triggered_by_field(setup_test_case, sample_intelligence_payload):
    """Test that triggered_by field is stored correctly"""
    
    case_id = setup_test_case
    
    # Insert with triggered_by
    entry_id = insert_intelligence_history(
        case_id=case_id,
        payload=sample_intelligence_payload,
        triggered_by="verifier",
        reason="Manual recompute requested by verifier"
    )
    
    # Retrieve and verify
    history = get_intelligence_history(case_id, limit=10)
    entry = next(e for e in history if e["id"] == entry_id)
    
    assert entry["triggered_by"] == "verifier", "Should store triggered_by field"
    assert "verifier" in entry["reason"], "Reason should mention verifier"


# ============================================================================
# Test Duplicate Detection
# ============================================================================

def test_duplicate_detection(setup_test_case, sample_case_data, sample_submission_data, sample_intelligence_payload):
    """Test detection of duplicate computations"""
    
    case_id = setup_test_case
    
    # Compute input hash
    input_hash = compute_input_hash(sample_case_data, sample_submission_data)
    
    # Insert two entries with same input_hash
    entry_id_1 = insert_intelligence_history(
        case_id=case_id,
        payload=sample_intelligence_payload,
        input_hash=input_hash
    )
    
    entry_id_2 = insert_intelligence_history(
        case_id=case_id,
        payload=sample_intelligence_payload,
        input_hash=input_hash
    )
    
    # Get history and detect duplicates
    history = get_intelligence_history(case_id, limit=10)
    duplicates = detect_duplicate_computations(history)
    
    # Should detect duplicate input_hash
    assert len(duplicates) > 0, "Should detect duplicate computations"
    
    # Find our duplicate group
    our_duplicate = next((d for d in duplicates if input_hash in d["input_hash"]), None)
    assert our_duplicate is not None, "Should find our duplicate hash"
    assert our_duplicate["count"] == 2, "Should have 2 entries with same hash"


# ============================================================================
# Test Export Endpoint
# ============================================================================

def test_export_endpoint_structure(setup_test_case, sample_intelligence_payload):
    """Test audit export endpoint returns correct structure"""
    
    from app.intelligence.router import export_audit_trail
    
    case_id = setup_test_case
    
    # Insert some history
    insert_intelligence_history(case_id, sample_intelligence_payload)
    insert_intelligence_history(case_id, sample_intelligence_payload)
    
    # Export
    result = export_audit_trail(case_id, include_payload=False)
    
    # Verify structure
    assert "metadata" in result
    assert "integrity_check" in result
    assert "duplicate_analysis" in result
    assert "history" in result
    
    # Verify metadata
    assert result["metadata"]["case_id"] == case_id
    assert result["metadata"]["total_entries"] == 2
    assert "export_timestamp" in result["metadata"]
    
    # Verify integrity check ran
    assert "is_valid" in result["integrity_check"]
    
    # Verify duplicate analysis ran
    assert "has_duplicates" in result["duplicate_analysis"]


def test_export_endpoint_includes_payload(setup_test_case, sample_intelligence_payload):
    """Test export endpoint includes payload when requested"""
    
    from app.intelligence.router import export_audit_trail
    
    case_id = setup_test_case
    
    insert_intelligence_history(case_id, sample_intelligence_payload)
    
    # Export with payload
    result = export_audit_trail(case_id, include_payload=True)
    
    # Should include full payload
    assert len(result["history"]) > 0
    first_entry = result["history"][0]
    assert "payload" in first_entry, "Should include payload when requested"
    assert "confidence_score" in first_entry["payload"]


def test_export_endpoint_excludes_payload(setup_test_case, sample_intelligence_payload):
    """Test export endpoint excludes payload by default"""
    
    from app.intelligence.router import export_audit_trail
    
    case_id = setup_test_case
    
    insert_intelligence_history(case_id, sample_intelligence_payload)
    
    # Export without payload (default)
    result = export_audit_trail(case_id, include_payload=False)
    
    # Should not include full payload
    first_entry = result["history"][0]
    assert "payload" not in first_entry, "Should not include payload by default"
    
    # But should include summary metrics
    assert "confidence_score" in first_entry
    assert "confidence_band" in first_entry
    assert "rules_passed" in first_entry


# ============================================================================
# Test Integration: Full Recompute Workflow
# ============================================================================

def test_full_recompute_workflow_integrity(setup_test_case, sample_case_data, sample_submission_data, sample_intelligence_payload):
    """Test full recompute workflow maintains integrity"""
    
    case_id = setup_test_case
    
    # Scenario: Initial computation, then user-triggered recompute
    
    # 1. Initial computation (system)
    input_hash_1 = compute_input_hash(sample_case_data, sample_submission_data)
    entry_id_1 = insert_intelligence_history(
        case_id=case_id,
        payload=sample_intelligence_payload,
        actor="system",
        reason="Initial intelligence computation",
        triggered_by="system",
        input_hash=input_hash_1
    )
    
    # 2. User requests recompute with same inputs (should detect duplicate)
    entry_id_2 = insert_intelligence_history(
        case_id=case_id,
        payload=sample_intelligence_payload,
        actor="verifier",
        reason="Recompute requested by verifier",
        triggered_by="verifier",
        input_hash=input_hash_1  # Same hash (no data changed)
    )
    
    # 3. Get history
    history = get_intelligence_history(case_id, limit=10)
    
    # Verify integrity
    assert len(history) == 2, "Should have 2 entries"
    
    # Verify chain
    chain_result = verify_audit_chain(history)
    assert chain_result["is_valid"] is True, "Audit chain should be valid"
    
    # Detect duplicate
    duplicates = detect_duplicate_computations(history)
    assert len(duplicates) > 0, "Should detect duplicate computation"
    
    # Verify triggered_by tracking
    entry_2 = next(e for e in history if e["id"] == entry_id_2)
    assert entry_2["triggered_by"] == "verifier", "Should track who triggered recompute"
    assert entry_2["previous_run_id"] == entry_id_1, "Should link to previous entry"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
