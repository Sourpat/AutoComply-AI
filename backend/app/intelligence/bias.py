"""
Bias Detection - Heuristics for detecting bias in signals (PHASE 7.2)

Implements rule-based bias detection:
- Single-source reliance
- Low signal diversity
- Signal contradictions
- Stale signals

No ML - pure heuristics.
"""

from typing import List, Dict, Any
from datetime import datetime, timedelta, timezone
from app.workflow.sla import normalize_iso_datetime
import json


# ============================================================================
# Bias Flag Types
# ============================================================================

BIAS_FLAG_TYPES = {
    "single_source_reliance": "Over-reliance on single data source",
    "low_diversity": "Insufficient signal diversity",
    "contradiction": "Contradictory signals detected",
    "stale_signals": "Outdated signals present",
}


# ============================================================================
# Bias Detection Functions
# ============================================================================

def detect_single_source_reliance(signals: List[Dict[str, Any]], threshold: float = 0.7) -> List[Dict[str, Any]]:
    """
    Detect if >70% of total signal strength comes from same source_type.
    
    Args:
        signals: List of signal dicts with source_type and signal_strength
        threshold: Threshold for flagging (default 0.7 = 70%)
        
    Returns:
        List of bias flag dicts
        
    Example:
        >>> signals = [
        ...     {"source_type": "submission_form", "signal_strength": 1.0},
        ...     {"source_type": "submission_form", "signal_strength": 1.0},
        ...     {"source_type": "evidence_storage", "signal_strength": 0.2},
        ... ]
        >>> flags = detect_single_source_reliance(signals)
        >>> len(flags)
        1
        >>> flags[0]["flagType"]
        'single_source_reliance'
    """
    if not signals:
        return []
    
    # Calculate total strength per source_type
    source_strengths: Dict[str, float] = {}
    total_strength = 0.0
    
    for signal in signals:
        source = signal.get("source_type", "unknown")
        strength = signal.get("signal_strength", 0.0)
        source_strengths[source] = source_strengths.get(source, 0.0) + strength
        total_strength += strength
    
    if total_strength == 0:
        return []
    
    # Check if any source exceeds threshold
    flags = []
    for source, strength in source_strengths.items():
        ratio = strength / total_strength
        if ratio > threshold:
            flags.append({
                "flagType": "single_source_reliance",
                "severity": "medium" if ratio < 0.85 else "high",
                "message": f"{int(ratio * 100)}% of signal strength from {source}",
                "suggestedAction": f"Add signals from other sources to improve diversity",
                "metadata": {
                    "source_type": source,
                    "ratio": round(ratio, 3),
                    "threshold": threshold
                }
            })
    
    return flags


def detect_low_diversity(signals: List[Dict[str, Any]], min_sources: int = 3) -> List[Dict[str, Any]]:
    """
    Detect if fewer than N unique source_types present.
    
    Args:
        signals: List of signal dicts with source_type
        min_sources: Minimum expected unique sources (default 3)
        
    Returns:
        List of bias flag dicts
        
    Example:
        >>> signals = [
        ...     {"source_type": "submission_form"},
        ...     {"source_type": "submission_form"},
        ... ]
        >>> flags = detect_low_diversity(signals, min_sources=3)
        >>> len(flags)
        1
    """
    if not signals:
        return []
    
    unique_sources = set(signal.get("source_type", "unknown") for signal in signals)
    source_count = len(unique_sources)
    
    if source_count < min_sources:
        return [{
            "flagType": "low_diversity",
            "severity": "low" if source_count >= min_sources - 1 else "medium",
            "message": f"Only {source_count} unique signal sources (expected {min_sources}+)",
            "suggestedAction": "Expand signal sources to include case events, evidence, and decision traces",
            "metadata": {
                "unique_sources": list(unique_sources),
                "count": source_count,
                "expected_min": min_sources
            }
        }]
    
    return []


def detect_contradictions(signals: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Detect contradictory signals.
    
    Contradiction scenarios:
    1. request_info_open=high but submitter_responded=high (without resolution)
    2. submission_present=0 but submission_completeness>0
    3. evidence_present=0 but evidence_count in metadata>0
    
    Args:
        signals: List of signal dicts
        
    Returns:
        List of bias flag dicts
    """
    flags = []
    
    # Build signal lookup by type
    signal_map: Dict[str, Dict[str, Any]] = {}
    for signal in signals:
        try:
            metadata = json.loads(signal.get("metadata_json", "{}"))
            signal_type = metadata.get("signal_type")
            if signal_type:
                signal_map[signal_type] = {
                    **signal,
                    "metadata": metadata
                }
        except:
            continue
    
    # Contradiction 1: request_info_open + submitter_responded conflict
    request_info = signal_map.get("request_info_open")
    submitter_responded = signal_map.get("submitter_responded")
    
    if request_info and submitter_responded:
        # If request is open (strength=1) AND submitter hasn't responded (strength=0)
        # that's consistent. But if BOTH are high, that's contradictory.
        request_strength = request_info.get("signal_strength", 0.0)
        responded_strength = submitter_responded.get("signal_strength", 0.0)
        
        if request_strength > 0.5 and responded_strength > 0.5:
            # Both high - contradiction (open request but already responded?)
            flags.append({
                "flagType": "contradiction",
                "severity": "medium",
                "message": "Request for info is open, but submitter has already responded",
                "suggestedAction": "Verify case status and event timeline consistency",
                "metadata": {
                    "contradicting_signals": ["request_info_open", "submitter_responded"],
                    "request_strength": request_strength,
                    "responded_strength": responded_strength
                }
            })
    
    # Contradiction 2: submission_present vs submission_completeness
    submission_present = signal_map.get("submission_present")
    submission_completeness = signal_map.get("submission_completeness")
    
    if submission_present and submission_completeness:
        present_flag = submission_present.get("completeness_flag", 0)
        completeness_strength = submission_completeness.get("signal_strength", 0.0)
        
        if present_flag == 0 and completeness_strength > 0:
            # No submission but has completeness score - contradiction
            flags.append({
                "flagType": "contradiction",
                "severity": "high",
                "message": "Submission marked as absent but has completeness score",
                "suggestedAction": "Verify submission linkage and data integrity",
                "metadata": {
                    "contradicting_signals": ["submission_present", "submission_completeness"],
                    "present_flag": present_flag,
                    "completeness_strength": completeness_strength
                }
            })
    
    # Contradiction 3: evidence_present vs evidence_count
    evidence_present = signal_map.get("evidence_present")
    if evidence_present:
        evidence_flag = evidence_present.get("completeness_flag", 0)
        metadata = evidence_present.get("metadata", {})
        evidence_count = metadata.get("evidence_count", 0)
        
        if evidence_flag == 0 and evidence_count > 0:
            # Marked as no evidence but count > 0
            flags.append({
                "flagType": "contradiction",
                "severity": "medium",
                "message": f"Evidence marked as absent but metadata shows {evidence_count} items",
                "suggestedAction": "Refresh evidence signals and verify attachment storage",
                "metadata": {
                    "signal": "evidence_present",
                    "completeness_flag": evidence_flag,
                    "evidence_count": evidence_count
                }
            })
    
    return flags


def detect_stale_signals(signals: List[Dict[str, Any]], max_age_hours: int = 72) -> List[Dict[str, Any]]:
    """
    Detect signals older than max_age_hours.
    
    Args:
        signals: List of signal dicts with timestamp
        max_age_hours: Maximum age in hours before flagging as stale (default 72)
        
    Returns:
        List of bias flag dicts
        
    Example:
        >>> from datetime import datetime, timedelta
        >>> old_time = (datetime.now(timezone.utc) - timedelta(hours=100)).isoformat()
        >>> signals = [{"timestamp": old_time, "metadata_json": '{"signal_type": "test"}'}]
        >>> flags = detect_stale_signals(signals, max_age_hours=72)
        >>> len(flags)
        1
    """
    if not signals:
        return []
    
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(hours=max_age_hours)
    stale_signals = []
    
    for signal in signals:
        try:
            timestamp_str = signal.get("timestamp", "")
            # Parse ISO timestamp with timezone awareness
            timestamp = normalize_iso_datetime(timestamp_str)
            
            if timestamp < cutoff:
                metadata = json.loads(signal.get("metadata_json", "{}"))
                signal_type = metadata.get("signal_type", "unknown")
                age_hours = int((now - timestamp).total_seconds() / 3600)
                
                stale_signals.append({
                    "signal_type": signal_type,
                    "age_hours": age_hours,
                    "timestamp": timestamp_str
                })
        except Exception:
            # Skip signals with invalid timestamps
            continue
    
    if stale_signals:
        return [{
            "flagType": "stale_signals",
            "severity": "low" if len(stale_signals) <= 2 else "medium",
            "message": f"{len(stale_signals)} signal(s) older than {max_age_hours} hours",
            "suggestedAction": "Recompute intelligence to refresh signal timestamps",
            "metadata": {
                "stale_count": len(stale_signals),
                "max_age_hours": max_age_hours,
                "stale_signals": stale_signals[:5]  # Limit to first 5
            }
        }]
    
    return []


# ============================================================================
# Main Bias Detection Function
# ============================================================================

def detect_all_bias_flags(signals: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Run all bias detection checks and return combined flags.
    
    Args:
        signals: List of signal dicts
        
    Returns:
        List of all bias flag dicts
        
    Example:
        >>> signals = [{"source_type": "submission_form", "signal_strength": 1.0}]
        >>> flags = detect_all_bias_flags(signals)
        >>> any(f["flagType"] == "low_diversity" for f in flags)
        True
    """
    all_flags = []
    
    # Run all detectors
    all_flags.extend(detect_single_source_reliance(signals))
    all_flags.extend(detect_low_diversity(signals))
    all_flags.extend(detect_contradictions(signals))
    all_flags.extend(detect_stale_signals(signals))
    
    return all_flags
