"""
Tests for PHASE 7.2: Decision Intelligence v2 (Gaps + Bias + Confidence v2)

Tests cover:
- Gap detection (missing, partial, weak, stale)
- Bias detection (single-source, low diversity, contradictions, stale)
- Confidence scoring v2 (weighted, penalized, explainable)
- Integration with repository and router
"""

import json
import pytest
from datetime import datetime, timedelta, timezone
from app.intelligence.expectations import (
    get_expected_signals,
    get_required_signals,
    EXPECTED_SIGNALS_BY_DECISION_TYPE,
)
from app.intelligence.bias import (
    detect_single_source_reliance,
    detect_low_diversity,
    detect_contradictions,
    detect_stale_signals,
    detect_all_bias_flags,
)
from app.intelligence.scoring import (
    compute_confidence_v2,
    get_confidence_band,
    get_signal_weight,
)


# ============================================================================
# Test Expectations
# ============================================================================

def test_get_expected_signals_csf():
    """Test expected signals for CSF decision type."""
    expected = get_expected_signals("csf")
    
    # Should have at least submission_present, submission_completeness, evidence_present
    signal_types = [e.signal_type for e in expected]
    assert "submission_present" in signal_types
    assert "submission_completeness" in signal_types
    assert "evidence_present" in signal_types


def test_get_expected_signals_default():
    """Test default expected signals."""
    expected = get_expected_signals("unknown_decision_type")
    
    # Should fall back to default
    signal_types = [e.signal_type for e in expected]
    assert "submission_present" in signal_types
    assert "submission_completeness" in signal_types


def test_get_required_signals():
    """Test filtering required signals."""
    required = get_required_signals("csf")
    
    # Should return list of signal type strings that are required
    assert isinstance(required, list)
    assert "submission_present" in required
    assert "submission_completeness" in required


# ============================================================================
# Test Bias Detection
# ============================================================================

def test_detect_single_source_reliance_high():
    """Test single-source reliance detection (high severity)."""
    signals = [
        {"source_type": "submission", "signal_strength": 0.9},
        {"source_type": "submission", "signal_strength": 0.8},
        {"source_type": "evidence", "signal_strength": 0.1},
    ]
    
    flags = detect_single_source_reliance(signals, threshold=0.7)
    
    assert len(flags) > 0
    assert flags[0]["flagType"] == "single_source_reliance"
    assert flags[0]["severity"] in ["medium", "high"]
    assert "submission" in flags[0]["message"]


def test_detect_single_source_reliance_ok():
    """Test no single-source reliance when diverse."""
    signals = [
        {"source_type": "submission", "signal_strength": 0.4},
        {"source_type": "evidence", "signal_strength": 0.3},
        {"source_type": "rag_trace", "signal_strength": 0.3},
    ]
    
    flags = detect_single_source_reliance(signals, threshold=0.7)
    
    assert len(flags) == 0


def test_detect_low_diversity_flagged():
    """Test low diversity detection."""
    signals = [
        {"source_type": "submission", "signal_strength": 0.5},
        {"source_type": "submission", "signal_strength": 0.5},
        {"source_type": "evidence", "signal_strength": 0.5},
    ]
    
    flags = detect_low_diversity(signals, min_sources=3)
    
    assert len(flags) > 0
    assert flags[0]["flagType"] == "low_diversity"
    assert flags[0]["severity"] in ["low", "medium"]


def test_detect_low_diversity_ok():
    """Test no low diversity when sufficient sources."""
    signals = [
        {"source_type": "submission", "signal_strength": 0.5},
        {"source_type": "evidence", "signal_strength": 0.5},
        {"source_type": "rag_trace", "signal_strength": 0.5},
    ]
    
    flags = detect_low_diversity(signals, min_sources=3)
    
    assert len(flags) == 0


def test_detect_contradictions_request_info():
    """Test contradiction: request_info_open + submitter_responded."""
    signals = [
        {
            "metadata_json": json.dumps({"signal_type": "request_info_open"}),
            "signal_strength": 0.9,
        },
        {
            "metadata_json": json.dumps({"signal_type": "submitter_responded"}),
            "signal_strength": 0.9,
        },
    ]
    
    flags = detect_contradictions(signals)
    
    assert len(flags) > 0
    assert flags[0]["flagType"] == "contradiction"
    assert ("request" in flags[0]["message"].lower() or "info" in flags[0]["message"].lower())


def test_detect_contradictions_submission_completeness():
    """Test contradiction: submission_present=0 but submission_completeness>0."""
    signals = [
        {
            "metadata_json": json.dumps({"signal_type": "submission_present"}),
            "signal_strength": 0.0,
        },
        {
            "metadata_json": json.dumps({"signal_type": "submission_completeness"}),
            "signal_strength": 0.5,
        },
    ]
    
    flags = detect_contradictions(signals)
    
    assert len(flags) > 0
    assert flags[0]["flagType"] == "contradiction"
    assert "submission" in flags[0]["message"].lower()


def test_detect_stale_signals():
    """Test stale signal detection."""
    old_time = (datetime.now(timezone.utc) - timedelta(hours=80)).isoformat() + "Z"
    recent_time = datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')
    
    signals = [
        {"timestamp": old_time, "metadata_json": json.dumps({"signal_type": "old_signal"})},
        {"timestamp": recent_time, "metadata_json": json.dumps({"signal_type": "recent_signal"})},
    ]
    
    flags = detect_stale_signals(signals, max_age_hours=72)
    
    assert len(flags) > 0
    assert flags[0]["flagType"] == "stale_signals"


def test_detect_all_bias_flags():
    """Test combined bias detection."""
    old_time = (datetime.now(timezone.utc) - timedelta(hours=80)).isoformat() + "Z"
    
    signals = [
        {"source_type": "submission", "signal_strength": 0.9, "timestamp": old_time, "metadata_json": "{}"},
        {"source_type": "submission", "signal_strength": 0.8, "timestamp": old_time, "metadata_json": "{}"},
    ]
    
    flags = detect_all_bias_flags(signals)
    
    # Should detect single-source, low diversity, and stale signals
    flag_types = [f["flagType"] for f in flags]
    assert "single_source_reliance" in flag_types
    assert "low_diversity" in flag_types
    assert "stale_signals" in flag_types


# ============================================================================
# Test Confidence Scoring v2
# ============================================================================

def test_get_confidence_band():
    """Test confidence band determination."""
    assert get_confidence_band(85) == "high"
    assert get_confidence_band(75) == "high"
    assert get_confidence_band(65) == "medium"
    assert get_confidence_band(50) == "medium"
    assert get_confidence_band(40) == "low"
    assert get_confidence_band(0) == "low"


def test_get_signal_weight():
    """Test signal weight retrieval."""
    assert get_signal_weight("submission_present") == 20.0
    assert get_signal_weight("submission_completeness") == 25.0
    assert get_signal_weight("unknown_signal") == 5.0  # Default


def test_compute_confidence_v2_perfect_case():
    """Test confidence v2 with perfect signals."""
    signals = [
        {
            "metadata_json": json.dumps({"signal_type": "submission_present"}),
            "signal_strength": 1.0,
            "completeness_flag": 1,
        },
        {
            "metadata_json": json.dumps({"signal_type": "submission_completeness"}),
            "signal_strength": 1.0,
            "completeness_flag": 1,
        },
    ]
    gaps = []
    bias_flags = []
    
    score, band, factors = compute_confidence_v2(signals, gaps, bias_flags)
    
    # Should be submission_present (20) + submission_completeness (25) = 45
    assert score == 45.0
    assert band == "low"  # Low because we don't have all signals
    assert len(factors) > 0


def test_compute_confidence_v2_with_gaps():
    """Test confidence v2 with gap penalties."""
    signals = [
        {
            "metadata_json": json.dumps({"signal_type": "submission_present"}),
            "signal_strength": 1.0,
            "completeness_flag": 1,
        },
    ]
    gaps = [
        {"gapType": "missing", "severity": "high", "signalType": "evidence_present"},
    ]
    bias_flags = []
    
    score, band, factors = compute_confidence_v2(signals, gaps, bias_flags)
    
    # Base score = 20, gap penalty = 15 * 1.5 (high severity) = 22.5
    # Final = 20 - 22.5 = 0 (clamped)
    assert score >= 0
    assert score < 20
    
    # Check explanation factors
    factor_types = [f["factor"] for f in factors]
    assert "gap_penalties" in factor_types


def test_compute_confidence_v2_with_bias():
    """Test confidence v2 with bias penalties."""
    signals = [
        {
            "metadata_json": json.dumps({"signal_type": "submission_present"}),
            "signal_strength": 1.0,
            "completeness_flag": 1,
        },
    ]
    gaps = []
    bias_flags = [
        {"flagType": "low_diversity", "severity": "medium"},
    ]
    
    score, band, factors = compute_confidence_v2(signals, gaps, bias_flags)
    
    # Base score = 20, bias penalty = 6 (medium, was 10)
    # Final = 20 - 6 = 14
    assert score == 14.0
    assert band == "low"
    
    # Check explanation factors
    factor_types = [f["factor"] for f in factors]
    assert "bias_penalties" in factor_types


def test_compute_confidence_v2_partial_completeness():
    """Test confidence v2 with partial completeness (50% credit)."""
    signals = [
        {
            "metadata_json": json.dumps({"signal_type": "submission_present"}),
            "signal_strength": 1.0,
            "completeness_flag": 0,  # Incomplete
        },
    ]
    gaps = []
    bias_flags = []
    
    score, band, factors = compute_confidence_v2(signals, gaps, bias_flags)
    
    # Base score = 20 * 1.0 * 0.5 (partial) = 10
    assert score == 10.0


def test_compute_confidence_v2_weak_signal():
    """Test confidence v2 with weak signal strength."""
    signals = [
        {
            "metadata_json": json.dumps({"signal_type": "submission_present"}),
            "signal_strength": 0.3,  # Weak
            "completeness_flag": 1,
        },
    ]
    gaps = []
    bias_flags = []
    
    score, band, factors = compute_confidence_v2(signals, gaps, bias_flags)
    
    # Base score = 20 * 0.3 * 1.0 = 6
    assert score == 6.0
    assert band == "low"


def test_compute_confidence_v2_comprehensive():
    """Test confidence v2 with multiple signals, gaps, and bias."""
    signals = [
        {
            "metadata_json": json.dumps({"signal_type": "submission_present"}),
            "signal_strength": 1.0,
            "completeness_flag": 1,
        },
        {
            "metadata_json": json.dumps({"signal_type": "submission_completeness"}),
            "signal_strength": 0.8,
            "completeness_flag": 0,  # Partial
        },
        {
            "metadata_json": json.dumps({"signal_type": "evidence_present"}),
            "signal_strength": 1.0,
            "completeness_flag": 1,
        },
    ]
    gaps = [
        {"gapType": "partial", "severity": "medium"},
        {"gapType": "weak", "severity": "low"},
    ]
    bias_flags = [
        {"flagType": "low_diversity", "severity": "low"},
    ]
    
    score, band, factors = compute_confidence_v2(signals, gaps, bias_flags)
    
    # Base score = 20 + (25 * 0.8 * 0.5) + 20 = 50
    # Gap penalty = 4 + (2 * 0.5) = 5 (was 12.5)
    # Bias penalty = 3 (was 5)
    # Final = 50 - 5 - 3 = 42
    assert 40 <= score <= 44
    assert band == "low"
    
    # Check all explanation factors present
    factor_types = [f["factor"] for f in factors]
    assert "base_signal_score" in factor_types
    assert "gap_penalties" in factor_types
    assert "bias_penalties" in factor_types
    assert "final_confidence" in factor_types


# ============================================================================
# Test Integration
# ============================================================================

def test_end_to_end_intelligence_v2():
    """Test end-to-end intelligence v2 computation."""
    # This test would require DB setup, so we'll keep it as a placeholder
    # In a real scenario, you'd:
    # 1. Create a test case with signals
    # 2. Call compute_and_upsert_decision_intelligence
    # 3. Verify gaps, bias flags, confidence v2 are computed correctly
    pass


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
