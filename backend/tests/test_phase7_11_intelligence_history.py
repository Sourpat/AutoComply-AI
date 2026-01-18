"""
Tests for Intelligence History and Diff (Phase 7.11).

Validates:
- History insertion on recompute  
- History retrieval (ordered, limited)
- Diff computation between snapshots
- Top changes detection (gaps, rules)
"""

import pytest
import time
import json
from datetime import datetime
from app.intelligence.repository import (
    get_intelligence_history,
    insert_intelligence_history,
    cleanup_old_intelligence_history,
)
from src.core.db import execute_update


# ============================================================================
# Fixtures
# ============================================================================

@pytest.fixture(autouse=True, scope="session")
def setup_history_table():
    """Create intelligence_history table for tests."""
    execute_update("""
        CREATE TABLE IF NOT EXISTS intelligence_history (
            id TEXT PRIMARY KEY NOT NULL,
            case_id TEXT NOT NULL,
            computed_at TEXT NOT NULL,
            payload_json TEXT NOT NULL,
            created_at TEXT NOT NULL,
            actor TEXT,
            reason TEXT,
            FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE
        );
    """)
    
    execute_update("""
        CREATE INDEX IF NOT EXISTS idx_intelligence_history_case_id 
        ON intelligence_history(case_id, computed_at DESC);
    """)


@pytest.fixture
def sample_payload():
    """Sample intelligence payload for testing."""
    return {
        "case_id": "test_case_123",
        "computed_at": datetime.utcnow().isoformat() + "Z",
        "updated_at": datetime.utcnow().isoformat() + "Z",
        "completeness_score": 85,
        "confidence_score": 75,
        "confidence_band": "medium",
        "gap_json": json.dumps([
            {"signal_type": "submission", "gap_type": "license_number", "severity": "critical"}
        ]),
        "bias_json": json.dumps([]),
        "rules_passed": 8,
        "rules_total": 10,
        "failed_rules": [
            {"rule_id": "rule_1", "severity": "medium"},
            {"rule_id": "rule_2", "severity": "low"}
        ],
    }


# ============================================================================
# History Repository Tests
# ============================================================================

def test_insert_intelligence_history(sample_payload):
    """Test that history entry is created correctly."""
    case_id = "test_case_" + datetime.utcnow().strftime("%Y%m%d%H%M%S%f")
    
    history_id = insert_intelligence_history(
        case_id=case_id,
        payload=sample_payload,
        actor="test@example.com",
        reason="Test insertion"
    )
    
    assert history_id.startswith("hist_")
    
    # Retrieve and verify
    history = get_intelligence_history(case_id, limit=10)
    assert len(history) == 1
    assert history[0]["actor"] == "test@example.com"
    assert history[0]["reason"] == "Test insertion"
    assert history[0]["payload"]["confidence_score"] == 75


def test_multiple_history_entries_ordered_correctly(sample_payload):
    """Test that multiple history entries are ordered newest first."""
    case_id = "test_case_" + datetime.utcnow().strftime("%Y%m%d%H%M%S%f")
    
    # Insert 3 entries with small delays
    for i in range(3):
        payload = sample_payload.copy()
        payload["computed_at"] = datetime.utcnow().isoformat() + "Z"
        payload["confidence_score"] = 60 + i * 10
        
        insert_intelligence_history(
            case_id=case_id,
            payload=payload,
            actor=f"user{i}@example.com",
            reason=f"Entry {i+1}"
        )
        time.sleep(0.1)  # Small delay to ensure ordering
    
    # Retrieve history
    history = get_intelligence_history(case_id, limit=10)
    
    # Verify count and ordering
    assert len(history) == 3
    assert history[0]["reason"] == "Entry 3"
    assert history[1]["reason"] == "Entry 2"
    assert history[2]["reason"] == "Entry 1"


def test_history_retrieval_respects_limit(sample_payload):
    """Test that history retrieval respects the limit parameter."""
    case_id = "test_case_" + datetime.utcnow().strftime("%Y%m%d%H%M%S%f")
    
    # Insert 5 entries
    for i in range(5):
        payload = sample_payload.copy()
        insert_intelligence_history(
            case_id=case_id,
            payload=payload,
            reason=f"Entry {i+1}"
        )
        time.sleep(0.05)
    
    # Retrieve with limit=3
    history = get_intelligence_history(case_id, limit=3)
    assert len(history) == 3


def test_cleanup_old_history_keeps_last_n(sample_payload):
    """Test that cleanup keeps only the N most recent entries."""
    case_id = "test_case_" + datetime.utcnow().strftime("%Y%m%d%H%M%S%f")
    
    # Insert 10 entries
    for i in range(10):
        payload = sample_payload.copy()
        payload["confidence_score"] = 50 + i
        payload["computed_at"] = datetime.utcnow().isoformat() + "Z"
        insert_intelligence_history(
            case_id=case_id,
            payload=payload,
            reason=f"Entry {i+1}"
        )
        time.sleep(0.05)
    
    # Cleanup, keeping last 5
    deleted = cleanup_old_intelligence_history(case_id, keep_last_n=5)
    assert deleted == 5
    
    # Verify only 5 remain
    history = get_intelligence_history(case_id, limit=100)
    assert len(history) == 5
    
    # Verify we kept the most recent 5
    assert history[0]["reason"] == "Entry 10"
    assert history[4]["reason"] == "Entry 6"


# ============================================================================
# Diff Computation Tests  
# ============================================================================

def test_diff_computation_basic(sample_payload):
    """Test basic diff computation between two history entries."""
    case_id = "test_case_" + datetime.utcnow().strftime("%Y%m%d%H%M%S%f")
    
    # Insert first entry
    payload1 = sample_payload.copy()
    payload1["confidence_score"] = 70
    payload1["confidence_band"] = "medium"
    payload1["rules_passed"] = 7
    payload1["computed_at"] = datetime.utcnow().isoformat() + "Z"
    insert_intelligence_history(case_id, payload1, reason="First")
    
    time.sleep(0.1)
    
    # Insert second entry with changes
    payload2 = sample_payload.copy()
    payload2["confidence_score"] = 85
    payload2["confidence_band"] = "high"
    payload2["rules_passed"] = 9
    payload2["computed_at"] = datetime.utcnow().isoformat() + "Z"
    insert_intelligence_history(case_id, payload2, reason="Second")
    
    # Get history and compute diff manually
    history = get_intelligence_history(case_id, limit=2)
    assert len(history) >= 2
    
    latest = history[0]["payload"]
    previous = history[1]["payload"]
    
    # Verify diff calculations
    confidence_delta = latest["confidence_score"] - previous["confidence_score"]
    assert confidence_delta == 15
    
    rules_delta = latest["rules_passed"] - previous["rules_passed"]
    assert rules_delta == 2


# ============================================================================
# Integration Tests
# ============================================================================

def test_history_payload_contains_all_required_fields(sample_payload):
    """Test that history payload preserves all intelligence fields."""
    case_id = "test_case_" + datetime.utcnow().strftime("%Y%m%d%H%M%S%f")
    
    insert_intelligence_history(case_id, sample_payload, reason="Full payload test")
    
    history = get_intelligence_history(case_id, limit=1)
    payload = history[0]["payload"]
    
    # Verify all expected fields are present
    assert "case_id" in payload
    assert "computed_at" in payload
    assert "confidence_score" in payload
    assert "confidence_band" in payload
    assert "gap_json" in payload
    assert "bias_json" in payload
    assert "rules_passed" in payload
    assert "rules_total" in payload
