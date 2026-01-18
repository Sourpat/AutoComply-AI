"""
Phase 7.17: Intelligence History Tests

Tests for intelligence computation history and audit trail:
- GET /workflow/cases/{case_id}/intelligence/history endpoint
- Event emission with triggers (manual/submission/evidence/request_info)
- Historical snapshot extraction from case_events
"""

import json
import pytest
from fastapi.testclient import TestClient

from app.workflow.repo import create_case
from app.workflow.models import CaseCreateInput
from app.intelligence.repository import compute_and_upsert_decision_intelligence, upsert_signals
from app.workflow.repo import create_case_event
from src.api.main import app

client = TestClient(app)


@pytest.fixture
def sample_case():
    """Create a sample case for testing."""
    case_input = CaseCreateInput(
        decisionType="csf_practitioner",
        title="Test Case for Intelligence History",
        summary="Testing intelligence history tracking",
    )
    case = create_case(case_input)
    return case


def test_get_intelligence_history_empty(sample_case):
    """Test getting intelligence history when no events exist."""
    response = client.get(
        f"/workflow/cases/{sample_case.id}/intelligence/history",
        headers={"x-user-role": "verifier"}
    )
    
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) == 0


def test_get_intelligence_history_with_events(sample_case):
    """Test getting intelligence history with multiple events."""
    # Create 3 intelligence update events with different triggers
    for i, trigger in enumerate(["manual", "submission", "evidence"]):
        create_case_event(
            case_id=sample_case.id,
            event_type="decision_intelligence_updated",
            actor_role="system" if trigger != "manual" else "admin",
            actor_id="test@example.com",
            message=f"Intelligence recomputed: {trigger}",
            payload_dict={
                "computed_at": f"2026-01-18T10:{30+i}:00Z",
                "confidence_score": 80.0 + i,
                "confidence_band": "high",
                "rules_passed": 8 + i,
                "rules_total": 10,
                "gap_count": 1,
                "bias_count": 0,
                "trigger": trigger,
            }
        )
    
    # Get history
    response = client.get(
        f"/workflow/cases/{sample_case.id}/intelligence/history",
        headers={"x-user-role": "verifier"}
    )
    
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 3
    
    # Verify newest first (evidence → submission → manual)
    assert data[0]["trigger"] == "evidence"
    assert data[0]["confidence_score"] == 82.0
    assert data[0]["rules_passed"] == 10
    assert data[0]["actor_role"] == "system"
    
    assert data[1]["trigger"] == "submission"
    assert data[1]["confidence_score"] == 81.0
    
    assert data[2]["trigger"] == "manual"
    assert data[2]["confidence_score"] == 80.0
    assert data[2]["actor_role"] == "admin"


def test_get_intelligence_history_limit(sample_case):
    """Test limit parameter for history endpoint."""
    # Create 5 events
    for i in range(5):
        create_case_event(
            case_id=sample_case.id,
            event_type="decision_intelligence_updated",
            actor_role="system",
            actor_id="test@example.com",
            message=f"Event {i}",
            payload_dict={
                "computed_at": f"2026-01-18T10:{30+i}:00Z",
                "confidence_score": 80.0 + i,
                "confidence_band": "high",
                "rules_total": 10,
                "rules_passed": 8,
                "gap_count": 0,
                "bias_count": 0,
                "trigger": "manual",
            }
        )
    
    # Get with limit=3
    response = client.get(
        f"/workflow/cases/{sample_case.id}/intelligence/history?limit=3",
        headers={"x-user-role": "verifier"}
    )
    
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 3
    # Should get newest 3 (events 4, 3, 2)
    assert data[0]["confidence_score"] == 84.0
    assert data[1]["confidence_score"] == 83.0
    assert data[2]["confidence_score"] == 82.0


def test_get_intelligence_history_filters_non_intelligence_events(sample_case):
    """Test that history endpoint only returns intelligence events."""
    # Create mix of events
    create_case_event(
        case_id=sample_case.id,
        event_type="case_created",
        actor_role="system",
        message="Case created"
    )
    
    create_case_event(
        case_id=sample_case.id,
        event_type="decision_intelligence_updated",
        actor_role="system",
        message="Intelligence updated",
        payload_dict={
            "computed_at": "2026-01-18T10:30:00Z",
            "confidence_score": 80.0,
            "confidence_band": "high",
            "rules_total": 10,
            "rules_passed": 8,
            "gap_count": 1,
            "bias_count": 0,
            "trigger": "manual",
        }
    )
    
    create_case_event(
        case_id=sample_case.id,
        event_type="status_changed",
        actor_role="verifier",
        message="Status changed"
    )
    
    # Get history
    response = client.get(
        f"/workflow/cases/{sample_case.id}/intelligence/history",
        headers={"x-user-role": "verifier"}
    )
    
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["trigger"] == "manual"


def test_recompute_endpoint_adds_manual_trigger(sample_case):
    """Test that POST recompute endpoint adds 'manual' trigger to event."""
    # Add some signals first
    signals = [
        {
            "decision_type": "csf_practitioner",
            "source_type": "submission",
            "signal_strength": 1.0,
            "completeness_flag": 1,
            "metadata_json": json.dumps({"field": "license_number", "present": True}),
            "timestamp": "2026-01-18T10:00:00Z",
        }
    ]
    upsert_signals(sample_case.id, signals)
    
    # Call recompute endpoint
    response = client.post(
        f"/workflow/cases/{sample_case.id}/intelligence/recompute?decision_type=csf_practitioner&admin_unlocked=1",
        headers={"x-user-role": "admin"}
    )
    
    assert response.status_code == 200
    
    # Check history has manual trigger
    history_response = client.get(
        f"/workflow/cases/{sample_case.id}/intelligence/history",
        headers={"x-user-role": "verifier"}
    )
    
    assert history_response.status_code == 200
    history = history_response.json()
    assert len(history) >= 1
    
    # Most recent should be manual trigger
    latest = history[0]
    assert latest["trigger"] == "manual"
    assert latest["confidence_score"] >= 0
    assert latest["confidence_band"] in ["high", "medium", "low"]


def test_history_includes_all_required_fields(sample_case):
    """Test that history entries include all required fields."""
    create_case_event(
        case_id=sample_case.id,
        event_type="decision_intelligence_updated",
        actor_role="system",
        actor_id="test@example.com",
        message="Intelligence updated",
        payload_dict={
            "computed_at": "2026-01-18T10:30:00Z",
            "confidence_score": 85.5,
            "confidence_band": "high",
            "rules_total": 10,
            "rules_passed": 9,
            "gap_count": 1,
            "bias_count": 2,
            "trigger": "evidence",
        }
    )
    
    response = client.get(
        f"/workflow/cases/{sample_case.id}/intelligence/history",
        headers={"x-user-role": "verifier"}
    )
    
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    
    entry = data[0]
    assert "computed_at" in entry
    assert "confidence_score" in entry
    assert "confidence_band" in entry
    assert "rules_passed" in entry
    assert "rules_total" in entry
    assert "gap_count" in entry
    assert "bias_count" in entry
    assert "trigger" in entry
    assert "actor_role" in entry
    
    assert entry["confidence_score"] == 85.5
    assert entry["confidence_band"] == "high"
    assert entry["rules_passed"] == 9
    assert entry["rules_total"] == 10
    assert entry["gap_count"] == 1
    assert entry["bias_count"] == 2
    assert entry["trigger"] == "evidence"
    assert entry["actor_role"] == "system"


def test_history_handles_missing_payload_gracefully(sample_case):
    """Test that history endpoint handles events with missing/malformed payload."""
    # Create event with no payload
    create_case_event(
        case_id=sample_case.id,
        event_type="decision_intelligence_updated",
        actor_role="system",
        message="Intelligence updated"
        # No payload_dict
    )
    
    response = client.get(
        f"/workflow/cases/{sample_case.id}/intelligence/history",
        headers={"x-user-role": "verifier"}
    )
    
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    
    # Should have defaults
    entry = data[0]
    assert entry["confidence_score"] == 0
    assert entry["confidence_band"] == "unknown"
    assert entry["rules_passed"] == 0
    assert entry["rules_total"] == 0
    assert entry["gap_count"] == 0
    assert entry["bias_count"] == 0
    assert entry["trigger"] == "unknown"


def test_get_intelligence_history_case_not_found():
    """Test history endpoint with non-existent case ID."""
    response = client.get(
        "/workflow/cases/nonexistent-case/intelligence/history",
        headers={"x-user-role": "verifier"}
    )
    
    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()
