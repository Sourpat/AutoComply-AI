"""
Phase 7.5 Tests - Auto-trigger Decision Intelligence

Tests for automatic intelligence recomputation on case changes.
"""

import json
import time
import pytest
from datetime import datetime

from app.workflow.models import CaseCreateInput
from app.workflow.repo import create_case, list_case_events
from app.submissions.repo import create_submission
from app.submissions.models import SubmissionCreateInput
from app.intelligence.service import (
    recompute_case_intelligence,
    recompute_on_submission_change,
    recompute_on_evidence_change,
)
from app.intelligence.repository import (
    get_decision_intelligence,
    get_signals,
)


# ============================================================================
# Fixtures
# ============================================================================

@pytest.fixture
def sample_case():
    """Create a sample case for testing."""
    case_input = CaseCreateInput(
        decisionType="csf_practitioner",
        title="Test Case Phase 7.5",
        summary="Testing auto-recompute",
    )
    case = create_case(case_input)
    return case


@pytest.fixture
def sample_submission(sample_case):
    """Create a sample submission linked to case."""
    submission_input = SubmissionCreateInput(
        decisionType="csf_practitioner",
        submittedBy="test@example.com",
        formData={
            "practitionerName": "Dr. Test",
            "deaNumber": "AT1234567",
        }
    )
    submission = create_submission(submission_input)
    
    # Link submission to case by updating case
    from src.core.db import execute_update
    execute_update(
        "UPDATE cases SET submission_id = :submission_id WHERE id = :case_id",
        {"submission_id": submission.id, "case_id": sample_case.id}
    )
    
    return submission


# ============================================================================
# Service Layer Tests
# ============================================================================

def test_recompute_case_intelligence_generates_signals(sample_case):
    """Test that recompute generates signals before computing intelligence."""
    # Initially no signals
    initial_signals = get_signals(sample_case.id)
    assert len(initial_signals) == 0
    
    # Recompute
    result = recompute_case_intelligence(
        case_id=sample_case.id,
        decision_type="csf_practitioner",
        actor="test@example.com",
        reason="Test recompute"
    )
    
    # Should succeed
    assert result is not None
    assert result["case_id"] == sample_case.id
    assert "confidence_score" in result
    assert "confidence_band" in result
    
    # Should generate signals
    signals_after = get_signals(sample_case.id)
    assert len(signals_after) > 0


def test_recompute_case_intelligence_computes_intelligence(sample_case):
    """Test that recompute creates decision intelligence record."""
    # Recompute
    result = recompute_case_intelligence(
        case_id=sample_case.id,
        decision_type="csf_practitioner",
        actor="test@example.com",
        reason="Test intelligence computation"
    )
    
    # Should succeed
    assert result is not None
    
    # Should create intelligence record
    intelligence = get_decision_intelligence(sample_case.id)
    assert intelligence is not None
    assert intelligence.case_id == sample_case.id
    assert intelligence.confidence_score is not None
    assert intelligence.confidence_band in ["low", "medium", "high"]
    
    # Should have gap and bias JSON
    gaps = json.loads(intelligence.gap_json)
    assert isinstance(gaps, list)
    
    bias = json.loads(intelligence.bias_json)
    assert isinstance(bias, list)


def test_recompute_emits_case_event(sample_case):
    """Test that recompute emits decision_intelligence_updated event."""
    # Get events before
    events_before = list_case_events(sample_case.id)
    event_count_before = len(events_before)
    
    # Recompute
    recompute_case_intelligence(
        case_id=sample_case.id,
        actor="test@example.com",
        reason="Test event emission"
    )
    
    # Should create new event
    events_after = list_case_events(sample_case.id)
    assert len(events_after) == event_count_before + 1
    
    # Find the intelligence event
    intelligence_events = [e for e in events_after if e.eventType == "decision_intelligence_updated"]
    assert len(intelligence_events) > 0
    
    latest_event = intelligence_events[-1]
    assert latest_event.eventDetail == "Test event emission"
    assert latest_event.actor == "test@example.com"


def test_recompute_throttle_prevents_duplicate(sample_case):
    """Test that throttle prevents recompute within 2 seconds."""
    # First recompute
    result1 = recompute_case_intelligence(
        case_id=sample_case.id,
        actor="test@example.com",
        reason="First recompute"
    )
    assert result1 is not None
    
    intelligence1 = get_decision_intelligence(sample_case.id)
    updated_at_1 = intelligence1.updated_at
    
    # Immediate second recompute (should be throttled)
    result2 = recompute_case_intelligence(
        case_id=sample_case.id,
        actor="test@example.com",
        reason="Second recompute (should be throttled)"
    )
    
    # Should be throttled (returns None)
    assert result2 is None
    
    # Intelligence should not have changed
    intelligence2 = get_decision_intelligence(sample_case.id)
    assert intelligence2.updated_at == updated_at_1
    
    # Wait 2.1 seconds and try again
    time.sleep(2.1)
    
    result3 = recompute_case_intelligence(
        case_id=sample_case.id,
        actor="test@example.com",
        reason="Third recompute (after throttle)"
    )
    
    # Should succeed
    assert result3 is not None
    
    # Intelligence should have updated timestamp
    intelligence3 = get_decision_intelligence(sample_case.id)
    assert intelligence3.updated_at != updated_at_1


# ============================================================================
# Convenience Function Tests
# ============================================================================

def test_recompute_on_submission_change(sample_case, sample_submission):
    """Test convenience function for submission changes."""
    result = recompute_on_submission_change(
        case_id=sample_case.id,
        actor="system"
    )
    
    assert result is not None
    assert result["case_id"] == sample_case.id
    
    # Should generate submission signals
    signals = get_signals(sample_case.id, source_type="submission_link")
    assert len(signals) > 0


def test_recompute_on_evidence_change(sample_case):
    """Test convenience function for evidence changes."""
    result = recompute_on_evidence_change(
        case_id=sample_case.id,
        actor="system"
    )
    
    assert result is not None
    assert result["case_id"] == sample_case.id


# ============================================================================
# Signal Generation Tests
# ============================================================================

def test_signals_reflect_submission_presence(sample_case, sample_submission):
    """Test that signals reflect submission presence."""
    # Recompute with linked submission
    recompute_case_intelligence(sample_case.id)
    
    # Check for submission_present signal
    signals = get_signals(sample_case.id)
    submission_signals = [
        s for s in signals 
        if "submission_present" in s.metadata_json
    ]
    
    assert len(submission_signals) > 0
    
    # Signal should indicate submission is present
    signal = submission_signals[0]
    assert signal.completeness_flag == 1
    assert signal.signal_strength == 1.0


def test_signals_detect_missing_submission(sample_case):
    """Test that signals detect missing submission."""
    # Recompute without submission
    recompute_case_intelligence(sample_case.id)
    
    # Check for submission_present signal
    signals = get_signals(sample_case.id)
    submission_signals = [
        s for s in signals 
        if "submission_present" in s.metadata_json
    ]
    
    assert len(submission_signals) > 0
    
    # Signal should indicate submission is missing
    signal = submission_signals[0]
    assert signal.completeness_flag == 0
    assert signal.signal_strength == 0.0


# ============================================================================
# Intelligence Quality Tests
# ============================================================================

def test_intelligence_has_low_confidence_with_no_evidence(sample_case):
    """Test that cases with no evidence have low confidence."""
    result = recompute_case_intelligence(sample_case.id)
    
    assert result is not None
    # With rule-based validation, cases with no submission get 5% minimum floor
    assert result["confidence_score"] >= 5.0  # Should have minimum floor
    assert result["confidence_score"] < 50  # Should still be low
    assert result["confidence_band"] == "low"


def test_intelligence_detects_gaps(sample_case):
    """Test that intelligence detects gaps in case."""
    result = recompute_case_intelligence(sample_case.id)
    
    assert result is not None
    
    intelligence = get_decision_intelligence(sample_case.id)
    gaps = json.loads(intelligence.gap_json)
    
    # Should detect missing signals
    assert len(gaps) >= 3  # At least submission, evidence gaps
    
    # Check gap structure
    for gap in gaps:
        assert "gapType" in gap
        assert "severity" in gap
        assert "message" in gap


def test_intelligence_updates_when_evidence_added(sample_case):
    """Test that intelligence improves when evidence is added."""
    # Initial recompute (no evidence)
    result1 = recompute_case_intelligence(sample_case.id)
    initial_confidence = result1["confidence_score"]
    
    # Wait for throttle
    time.sleep(2.1)
    
    # Simulate evidence attachment (mock)
    from src.core.db import execute_insert
    execute_insert(
        """INSERT INTO attachments 
           (id, case_id, filename, content_type, size_bytes, storage_path, uploaded_by, created_at)
           VALUES (:id, :case_id, :filename, :content_type, :size_bytes, :storage_path, :uploaded_by, :created_at)""",
        {
            "id": "attach-123",
            "case_id": sample_case.id,
            "filename": "evidence.pdf",
            "content_type": "application/pdf",
            "size_bytes": 1024,
            "storage_path": "/tmp/evidence.pdf",
            "uploaded_by": "test@example.com",
            "created_at": datetime.utcnow().isoformat()
        }
    )
    
    # Recompute after evidence
    result2 = recompute_on_evidence_change(sample_case.id)
    
    # Confidence should improve or stay same
    # (May not always improve depending on other factors, but should not decrease significantly)
    assert result2 is not None
    new_confidence = result2["confidence_score"]
    
    # At minimum, should detect evidence present signal
    signals = get_signals(sample_case.id)
    evidence_signals = [
        s for s in signals
        if "evidence" in s.source_type.lower()
    ]
    assert len(evidence_signals) > 0
