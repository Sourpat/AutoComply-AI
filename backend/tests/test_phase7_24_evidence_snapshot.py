"""
Tests for Phase 7.24: Evidence Snapshot + Provenance.

Tests:
- Evidence hash is deterministic
- Evidence snapshot is stored and retrieved
- Export includes evidence when requested
- Evidence endpoint returns correct data
"""

import pytest
import json
from datetime import datetime

from app.intelligence.evidence_snapshot import (
    create_evidence_snapshot,
    compute_evidence_hash,
    get_evidence_version,
)
from app.intelligence.repository import (
    insert_intelligence_history,
    get_intelligence_history,
)
from src.core.db import execute_sql, execute_update
from app.workflow.repo import create_case
from app.workflow.models import CaseCreateInput
from app.submissions.repo import create_submission
from app.submissions.models import SubmissionCreateInput


@pytest.fixture
def test_case():
    """Create a test case with submission and attachments."""
    # Create submission first
    submission_data = {
        "practitioner_name": "Dr. Test",
        "license_number": "CSF12345",
        "dea_number": "TEST123",
        "quantity": "100",
        "substance": "Controlled Med A",
    }
    
    submission = create_submission(
        SubmissionCreateInput(
            decisionType="csf",
            submittedBy="submitter@test.com",
            formData=submission_data,
        )
    )
    
    # Create case linked to submission
    case = create_case(
        CaseCreateInput(
            decisionType="csf",
            title="Test Case",
            submissionId=submission.id,
            assignedTo="verifier@test.com",
        )
    )
    case_id = case.id
    
    # Update submission with case_id (for evidence snapshot queries)
    execute_update(
        "UPDATE submissions SET case_id = :case_id WHERE id = :submission_id",
        {"case_id": case_id, "submission_id": submission.id}
    )
    
    # Update submission with form_data_json (for evidence snapshot queries)
    execute_update(
        "UPDATE submissions SET form_data_json = :form_data_json, submitted_at = :submitted_at WHERE id = :submission_id",
        {
            "form_data_json": json.dumps(submission_data),
            "submitted_at": "2026-01-20T09:00:00Z",
            "submission_id": submission.id
        }
    )
    
    # Add some attachments
    execute_update(
        """
        INSERT INTO attachments (id, case_id, filename, content_type, mime_type, size_bytes, storage_path, uploaded_at, category, created_at)
        VALUES 
        ('att_1', :case_id, 'license.pdf', 'application/pdf', 'application/pdf', 50000, '/fake/path/license.pdf', '2026-01-20T10:00:00Z', 'license', '2026-01-20T10:00:00Z'),
        ('att_2', :case_id, 'prescription.jpg', 'image/jpeg', 'image/jpeg', 30000, '/fake/path/prescription.jpg', '2026-01-20T10:05:00Z', 'prescription', '2026-01-20T10:05:00Z')
        """,
        {"case_id": case_id}
    )
    
    return case_id


def test_evidence_snapshot_creation(test_case):
    """Test that evidence snapshot captures case state correctly."""
    snapshot = create_evidence_snapshot(test_case)
    
    # Verify structure
    assert "snapshot_at" in snapshot
    assert "case" in snapshot
    assert "submission" in snapshot
    assert "attachments" in snapshot
    assert "request_info_responses" in snapshot
    
    # Verify case data
    assert snapshot["case"]["status"] == "new"
    assert snapshot["case"]["decision_type"] == "csf"
    
    # Verify submission data (sanitized)
    assert snapshot["submission"] is not None
    assert "fields" in snapshot["submission"]
    assert snapshot["submission"]["field_count"] == 5
    
    # Verify fields are sanitized (no actual values)
    fields = snapshot["submission"]["fields"]
    assert "practitioner_name" in fields
    assert fields["practitioner_name"]["present"] is True
    assert fields["practitioner_name"]["type"] == "str"
    assert "length" in fields["practitioner_name"]
    
    # Verify attachments
    assert len(snapshot["attachments"]) == 2
    assert snapshot["attachments"][0]["filename"] == "license.pdf"
    assert snapshot["attachments"][0]["mime_type"] == "application/pdf"
    assert snapshot["attachments"][1]["filename"] == "prescription.jpg"


def test_evidence_hash_deterministic(test_case):
    """Test that evidence hash is deterministic (same inputs = same hash)."""
    # Create two snapshots at different times
    snapshot1 = create_evidence_snapshot(test_case)
    hash1 = compute_evidence_hash(snapshot1)
    
    # Small delay
    import time
    time.sleep(0.1)
    
    snapshot2 = create_evidence_snapshot(test_case)
    hash2 = compute_evidence_hash(snapshot2)
    
    # Hashes should be identical (timestamps excluded from hash)
    assert hash1 == hash2
    assert len(hash1) == 64  # SHA256 hex length
    
    print(f"[TEST] Deterministic hash: {hash1[:16]}...")


def test_evidence_hash_changes_with_evidence(test_case):
    """Test that evidence hash changes when evidence changes."""
    # Get initial hash
    snapshot1 = create_evidence_snapshot(test_case)
    hash1 = compute_evidence_hash(snapshot1)
    
    # Add new attachment
    execute_update(
        """
        INSERT INTO attachments (id, case_id, filename, content_type, mime_type, size_bytes, storage_path, uploaded_at, category, created_at)
        VALUES ('att_3', :case_id, 'medical_record.pdf', 'application/pdf', 'application/pdf', 80000, '/fake/path/medical_record.pdf', '2026-01-20T10:10:00Z', 'medical_record', '2026-01-20T10:10:00Z')
        """,
        {"case_id": test_case}
    )
    
    # Get new hash
    snapshot2 = create_evidence_snapshot(test_case)
    hash2 = compute_evidence_hash(snapshot2)
    
    # Hashes should be different
    assert hash1 != hash2
    
    print(f"[TEST] Hash before: {hash1[:16]}...")
    print(f"[TEST] Hash after:  {hash2[:16]}...")


def test_intelligence_history_stores_evidence(test_case):
    """Test that intelligence history stores evidence snapshot."""
    # Create intelligence payload
    payload = {
        "case_id": test_case,
        "confidence_score": 85.0,
        "confidence_band": "high",
        "completeness_score": 90.0,
        "gaps": [],
        "bias_flags": [],
        "computed_at": datetime.utcnow().isoformat() + "Z",
    }
    
    # Insert history entry
    history_id = insert_intelligence_history(
        case_id=test_case,
        payload=payload,
        actor="verifier@test.com",
        reason="Test recompute",
        triggered_by="verifier",
        input_hash="test_input_hash_123",
    )
    
    # Retrieve entry from database
    rows = execute_sql(
        """
        SELECT 
            id, case_id, evidence_snapshot, evidence_hash, evidence_version
        FROM intelligence_history
        WHERE id = :history_id
        """,
        {"history_id": history_id}
    )
    
    assert len(rows) == 1
    entry = rows[0]
    
    # Verify evidence fields are populated
    assert entry["evidence_snapshot"] is not None
    assert entry["evidence_hash"] is not None
    assert entry["evidence_version"] == "v1.0"
    
    # Parse and verify evidence snapshot
    evidence = json.loads(entry["evidence_snapshot"])
    assert "case" in evidence
    assert "submission" in evidence
    assert "attachments" in evidence
    assert len(evidence["attachments"]) == 2
    
    print(f"[TEST] Evidence hash stored: {entry['evidence_hash'][:16]}...")


def test_get_intelligence_history_includes_evidence(test_case):
    """Test that get_intelligence_history returns evidence fields."""
    # Insert history entry
    payload = {
        "case_id": test_case,
        "confidence_score": 85.0,
        "confidence_band": "high",
        "computed_at": datetime.utcnow().isoformat() + "Z",
    }
    
    history_id = insert_intelligence_history(
        case_id=test_case,
        payload=payload,
        actor="verifier@test.com",
        reason="Test",
    )
    
    # Retrieve using repository function
    history_entries = get_intelligence_history(test_case, limit=10)
    
    assert len(history_entries) >= 1
    entry = history_entries[0]
    
    # Verify evidence fields are included
    assert "evidence_snapshot" in entry
    assert "evidence_hash" in entry
    assert "evidence_version" in entry
    
    assert entry["evidence_snapshot"] is not None
    assert entry["evidence_hash"] is not None
    assert entry["evidence_version"] == "v1.0"
    
    # Verify evidence snapshot structure
    evidence = entry["evidence_snapshot"]
    assert isinstance(evidence, dict)
    assert "case" in evidence
    assert "submission" in evidence
    assert "attachments" in evidence


def test_evidence_version():
    """Test evidence version function returns correct format."""
    version = get_evidence_version()
    assert version == "v1.0"
    assert isinstance(version, str)


def test_evidence_snapshot_no_submission():
    """Test evidence snapshot handles case without submission."""
    # Create case without submission
    case = create_case(
        CaseCreateInput(
            decisionType="csf",
            title="Test Case No Submission",
            assignedTo="verifier@test.com",
        )
    )
    case_id = case.id
    
    snapshot = create_evidence_snapshot(case_id)
    
    # Should still return valid snapshot
    assert "case" in snapshot
    assert snapshot["submission"] is None
    assert snapshot["attachments"] == []
    assert snapshot["request_info_responses"] == 0


def test_evidence_hash_excludes_timestamps(test_case):
    """Test that timestamps do not affect evidence hash."""
    snapshot = create_evidence_snapshot(test_case)
    
    # Manually set different timestamp
    snapshot_copy = snapshot.copy()
    snapshot_copy["snapshot_at"] = "2099-12-31T23:59:59Z"
    
    # Hashes should be identical (snapshot_at excluded from hash)
    hash1 = compute_evidence_hash(snapshot)
    hash2 = compute_evidence_hash(snapshot_copy)
    
    assert hash1 == hash2
    print(f"[TEST] Hash unchanged with different timestamp: {hash1[:16]}...")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])
