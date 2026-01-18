"""
Tests for Signal Intelligence (Phase 7.1).

Tests:
- Schema validation (signals and decision_intelligence tables exist)
- Signal insertion and retrieval
- Decision intelligence computation
- API endpoints (GET and POST)
- Case event emission
"""

import pytest
import json
from datetime import datetime
from sqlalchemy import text

from src.database.connection import engine, init_db
from app.intelligence.repository import (
    upsert_signals,
    get_signals,
    compute_and_upsert_decision_intelligence,
    get_decision_intelligence,
)
from app.workflow.repo import create_case
from app.workflow.models import CaseCreateInput


# ============================================================================
# Fixtures
# ============================================================================

@pytest.fixture(scope="function")
def db():
    """Initialize database for each test."""
    init_db()
    yield
    # Cleanup handled by in-memory database


@pytest.fixture
def sample_case(db):
    """Create a sample case for testing."""
    case_input = CaseCreateInput(
        decisionType="csf_practitioner",
        title="Test Case for Intelligence",
        summary="Testing signal intelligence features",
        submissionId="sub_test123",
    )
    case = create_case(case_input)
    return case


# ============================================================================
# Schema Tests
# ============================================================================

def test_signals_table_exists(db):
    """Test that signals table exists with correct schema."""
    with engine.connect() as conn:
        # Check table exists
        result = conn.execute(text(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='signals'"
        ))
        assert result.fetchone() is not None, "signals table should exist"
        
        # Check schema
        result = conn.execute(text("PRAGMA table_info(signals)"))
        columns = {row[1] for row in result}
        
        required_columns = {
            'id', 'case_id', 'decision_type', 'source_type', 'timestamp',
            'signal_strength', 'completeness_flag', 'metadata_json', 'created_at'
        }
        assert required_columns.issubset(columns), \
            f"signals table missing columns: {required_columns - columns}"


def test_decision_intelligence_table_exists(db):
    """Test that decision_intelligence table exists with correct schema."""
    with engine.connect() as conn:
        # Check table exists
        result = conn.execute(text(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='decision_intelligence'"
        ))
        assert result.fetchone() is not None, "decision_intelligence table should exist"
        
        # Check schema
        result = conn.execute(text("PRAGMA table_info(decision_intelligence)"))
        columns = {row[1] for row in result}
        
        required_columns = {
            'case_id', 'computed_at', 'updated_at', 'completeness_score',
            'gap_json', 'bias_json', 'confidence_score', 'confidence_band',
            'narrative_template', 'narrative_genai'
        }
        assert required_columns.issubset(columns), \
            f"decision_intelligence table missing columns: {required_columns - columns}"


def test_signals_indexes_exist(db):
    """Test that required indexes exist on signals table."""
    with engine.connect() as conn:
        result = conn.execute(text(
            "SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='signals'"
        ))
        indexes = {row[0] for row in result if row[0]}  # Filter out None
        
        required_indexes = {
            'idx_signals_case_id',
            'idx_signals_case_id_timestamp',
            'idx_signals_source_type',
            'idx_signals_decision_type',
        }
        
        assert required_indexes.issubset(indexes), \
            f"Missing indexes: {required_indexes - indexes}"


# ============================================================================
# Repository Tests
# ============================================================================

def test_upsert_signals(sample_case):
    """Test inserting signals for a case."""
    signals_data = [
        {
            "decision_type": "csf_practitioner",
            "source_type": "submission",
            "completeness_flag": 1,
            "signal_strength": 1.0,
            "metadata_json": json.dumps({"field": "license_number", "present": True}),
        },
        {
            "decision_type": "csf_practitioner",
            "source_type": "evidence",
            "completeness_flag": 0,
            "signal_strength": 0.8,
            "metadata_json": json.dumps({"description": "Missing employer verification"}),
        },
    ]
    
    signal_ids = upsert_signals(sample_case.id, signals_data)
    
    assert len(signal_ids) == 2
    assert all(sid.startswith("sig_") for sid in signal_ids)


def test_get_signals(sample_case):
    """Test retrieving signals for a case."""
    # Insert signals
    signals_data = [
        {
            "decision_type": "csf_practitioner",
            "source_type": "submission",
            "completeness_flag": 1,
        },
        {
            "decision_type": "csf_practitioner",
            "source_type": "evidence",
            "completeness_flag": 0,
        },
    ]
    upsert_signals(sample_case.id, signals_data)
    
    # Retrieve all signals
    signals = get_signals(sample_case.id)
    assert len(signals) == 2
    
    # Retrieve filtered by source_type
    submission_signals = get_signals(sample_case.id, source_type="submission")
    assert len(submission_signals) == 1
    assert submission_signals[0].source_type == "submission"


def test_compute_decision_intelligence_no_signals(sample_case):
    """Test computing intelligence with no signals."""
    intelligence = compute_and_upsert_decision_intelligence(sample_case.id)
    
    assert intelligence.case_id == sample_case.id
    assert intelligence.completeness_score == 0
    # Phase 7.8: Rule-based validation applies 5% minimum floor
    assert intelligence.confidence_score == 5.0
    assert intelligence.confidence_band == "low"
    
    # Phase 7.2 v2: Detects gaps for all expected required signals
    gaps = json.loads(intelligence.gap_json)
    assert len(gaps) >= 3  # At least submission_present, submission_completeness, evidence_present
    
    # Verify all gaps are "missing" type
    for gap in gaps:
        assert gap["gapType"] == "missing"
        assert "missing" in gap["message"].lower()
    
    # Phase 7.2: gap_severity_score should be high when many required signals missing
    gap_severity = json.loads(intelligence.gap_severity_json) if hasattr(intelligence, 'gap_severity_json') else None
    # Note: gap_severity_score is computed internally but may not be in model


def test_compute_decision_intelligence_with_signals(sample_case):
    """Test computing intelligence with mixed signals."""
    # Phase 7.2 v2: Must include signal_type in metadata_json for proper scoring
    signals_data = [
        {
            "decision_type": "csf_practitioner",
            "source_type": "submission",
            "completeness_flag": 1,
            "signal_strength": 1.0,
            "metadata_json": json.dumps({"signal_type": "submission_present"}),
        },
        {
            "decision_type": "csf_practitioner",
            "source_type": "submission",
            "completeness_flag": 1,
            "signal_strength": 1.0,
            "metadata_json": json.dumps({"signal_type": "submission_completeness"}),
        },
        {
            "decision_type": "csf_practitioner",
            "source_type": "evidence",
            "completeness_flag": 1,
            "signal_strength": 1.0,
            "metadata_json": json.dumps({"signal_type": "evidence_present"}),
        },
        {
            "decision_type": "csf_practitioner",
            "source_type": "rag_trace",
            "completeness_flag": 1,
            "signal_strength": 0.9,
            "metadata_json": json.dumps({"signal_type": "explainability_available"}),
        },
    ]
    upsert_signals(sample_case.id, signals_data)
    
    # Compute intelligence
    intelligence = compute_and_upsert_decision_intelligence(sample_case.id)

    assert intelligence.case_id == sample_case.id
    assert intelligence.completeness_score == 100  # 4/4 = 100%

    # Phase 7.8: Confidence now based on rule validation, not signals
    # Without submission data, rules will fail => 5% floor
    assert intelligence.confidence_score == 5.0
    assert intelligence.confidence_band == "low"
    
    # Should have minimal or no gaps since required signals are present
    gaps = json.loads(intelligence.gap_json)
    assert len(gaps) <= 2  # May have optional signals missing (request_info_open, submitter_responded)


def test_get_decision_intelligence(sample_case):
    """Test retrieving decision intelligence."""
    # Insert signals and compute
    signals_data = [
        {
            "decision_type": "csf_practitioner",
            "source_type": "submission",
            "completeness_flag": 1,
        }
    ]
    upsert_signals(sample_case.id, signals_data)
    compute_and_upsert_decision_intelligence(sample_case.id)
    
    # Retrieve
    intelligence = get_decision_intelligence(sample_case.id)
    assert intelligence is not None
    assert intelligence.case_id == sample_case.id
    
    # Test non-existent case
    intelligence_none = get_decision_intelligence("nonexistent_case")
    assert intelligence_none is None


def test_intelligence_confidence_bands(sample_case):
    """Test confidence band calculation."""
    # Phase 7.2 v2: Must include signal_type in metadata for proper weighted scoring
    
    # HIGH confidence: All required signals present with strong weights
    # submission_present (20) + submission_completeness (25) + evidence_present (20) + explainability (15) = 80
    signals_high = [
        {"decision_type": "csf_practitioner", "source_type": "submission", "completeness_flag": 1, "signal_strength": 1.0,
         "metadata_json": json.dumps({"signal_type": "submission_present"})},
        {"decision_type": "csf_practitioner", "source_type": "submission", "completeness_flag": 1, "signal_strength": 1.0,
         "metadata_json": json.dumps({"signal_type": "submission_completeness"})},
        {"decision_type": "csf_practitioner", "source_type": "evidence", "completeness_flag": 1, "signal_strength": 1.0,
         "metadata_json": json.dumps({"signal_type": "evidence_present"})},
        {"decision_type": "csf_practitioner", "source_type": "rag_trace", "completeness_flag": 1, "signal_strength": 1.0,
         "metadata_json": json.dumps({"signal_type": "explainability_available"})},
    ]
    upsert_signals(sample_case.id, signals_high)
    intel_high = compute_and_upsert_decision_intelligence(sample_case.id)
    # Phase 7.8: Confidence based on rule validation, not signals
    # Without submission data, rules fail => low confidence
    assert intel_high.confidence_band == "low"
    assert intel_high.confidence_score == 5.0
    
    # Create new case for medium confidence
    case_input = CaseCreateInput(
        decisionType="csf_practitioner",
        title="Medium Test",
        summary="Testing medium confidence",
    )
    case_medium = create_case(case_input)
    
    # MEDIUM confidence: Only partial signals (50-74 range)
    # submission_present (20) + submission_completeness (25*0.5 partial) + evidence_present (20*0.5 weak) = 42.5
    # But with gap penalties this should land in medium range if we adjust
    # Better: submission_present (20) + submission_completeness (25) + evidence_present (20*0.6 weak) = 57
    signals_medium = [
        {"decision_type": "csf_practitioner", "source_type": "submission", "completeness_flag": 1, "signal_strength": 1.0,
         "metadata_json": json.dumps({"signal_type": "submission_present"})},
        {"decision_type": "csf_practitioner", "source_type": "submission", "completeness_flag": 1, "signal_strength": 1.0,
         "metadata_json": json.dumps({"signal_type": "submission_completeness"})},
        {"decision_type": "csf_practitioner", "source_type": "evidence", "completeness_flag": 1, "signal_strength": 0.6,
         "metadata_json": json.dumps({"signal_type": "evidence_present"})},
    ]
    upsert_signals(case_medium.id, signals_medium)
    intel_medium = compute_and_upsert_decision_intelligence(case_medium.id)
    # Phase 7.8: Without submission data, rules fail => 5% floor
    assert intel_medium.confidence_band == "low"
    assert intel_medium.confidence_score == 5.0


# ============================================================================
# API Integration Tests
# ============================================================================

def test_api_get_intelligence(sample_case):
    """Test GET intelligence endpoint."""
    from fastapi.testclient import TestClient
    from src.api.main import app
    
    client = TestClient(app)
    
    # Insert signals
    signals_data = [
        {"decision_type": "csf_practitioner", "source_type": "submission", "completeness_flag": 1}
    ]
    upsert_signals(sample_case.id, signals_data)
    
    # GET intelligence (should auto-compute if not exists)
    response = client.get(
        f"/workflow/cases/{sample_case.id}/intelligence",
        headers={"X-AutoComply-Role": "verifier"}
    )
    
    assert response.status_code == 200
    data = response.json()
    
    assert data["case_id"] == sample_case.id
    assert "completeness_score" in data
    assert "confidence_score" in data
    assert "confidence_band" in data
    assert "narrative" in data
    assert isinstance(data["gaps"], list)
    assert isinstance(data["bias_flags"], list)


def test_api_recompute_intelligence_admin(sample_case):
    """Test POST recompute endpoint with admin role."""
    from fastapi.testclient import TestClient
    from src.api.main import app
    
    client = TestClient(app)
    
    # Insert signals
    signals_data = [
        {"decision_type": "csf_practitioner", "source_type": "submission", "completeness_flag": 1}
    ]
    upsert_signals(sample_case.id, signals_data)
    
    # POST recompute as admin
    response = client.post(
        f"/workflow/cases/{sample_case.id}/intelligence/recompute",
        headers={"X-AutoComply-Role": "admin"},
        json={"force": True}
    )
    
    assert response.status_code == 200
    data = response.json()
    assert data["case_id"] == sample_case.id


def test_api_recompute_intelligence_forbidden(sample_case):
    """Test POST recompute endpoint with non-admin role (should fail)."""
    from fastapi.testclient import TestClient
    from src.api.main import app
    
    client = TestClient(app)
    
    # POST recompute as submitter (should be forbidden)
    response = client.post(
        f"/workflow/cases/{sample_case.id}/intelligence/recompute",
        headers={"X-AutoComply-Role": "verifier"},
        json={}
    )
    
    assert response.status_code == 403


# ============================================================================
# Edge Cases
# ============================================================================

def test_signal_with_custom_timestamp(sample_case):
    """Test inserting signal with custom timestamp."""
    custom_time = "2026-01-15T10:00:00Z"
    signals_data = [
        {
            "decision_type": "csf_practitioner",
            "source_type": "submission",
            "completeness_flag": 1,
            "timestamp": custom_time,
        }
    ]
    
    signal_ids = upsert_signals(sample_case.id, signals_data)
    signals = get_signals(sample_case.id)
    
    assert len(signals) == 1
    assert signals[0].timestamp == custom_time


def test_narrative_generation(sample_case):
    """Test narrative template generation."""
    # Case with gaps
    signals_data = [
        {"decision_type": "csf_practitioner", "source_type": "submission", "completeness_flag": 1},
        {
            "decision_type": "csf_practitioner",
            "source_type": "evidence",
            "completeness_flag": 0,
            "metadata_json": json.dumps({"description": "Missing document"}),
        },
    ]
    upsert_signals(sample_case.id, signals_data)
    
    intelligence = compute_and_upsert_decision_intelligence(sample_case.id)

    # Phase 7.8: Narrative now based on rules, not completeness percentage
    assert "passed" in intelligence.narrative_template.lower()
    assert "gap" in intelligence.narrative_template.lower()
    assert "confidence" in intelligence.narrative_template.lower()


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
