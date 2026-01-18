"""
Confidence Scoring v2 - Weighted, explainable confidence scoring (PHASE 7.2)

Implements weighted signal scoring with gap and bias penalties.
Produces explainable factors for transparency.
"""

from typing import List, Dict, Any, Tuple


# ============================================================================
# Signal Weights
# ============================================================================

# Base weights for each signal type (out of 100 total)
SIGNAL_WEIGHTS = {
    "submission_present": 20.0,        # Critical - must have submission
    "submission_completeness": 25.0,   # Critical - form quality
    "evidence_present": 20.0,          # Important - supporting docs
    "request_info_open": 10.0,         # Moderate - blockers
    "submitter_responded": 10.0,       # Moderate - responsiveness
    "explainability_available": 15.0,  # Important - transparency
}

# Default weight for unknown signal types
DEFAULT_SIGNAL_WEIGHT = 5.0

# Penalty multipliers (reduced to prevent over-penalization of early-stage cases)
GAP_PENALTY_PER_MISSING = 8.0       # -8 points per missing required signal
GAP_PENALTY_PER_PARTIAL = 4.0       # -4 points per partial signal
GAP_PENALTY_PER_WEAK = 2.0          # -2 points per weak signal
GAP_PENALTY_PER_STALE = 2.0         # -2 points per stale signal

BIAS_PENALTY_LOW = 3.0              # -3 points for low severity bias
BIAS_PENALTY_MEDIUM = 6.0           # -6 points for medium severity
BIAS_PENALTY_HIGH = 10.0            # -10 points for high severity


# ============================================================================
# Confidence Bands
# ============================================================================

def get_confidence_band(score: float) -> str:
    """
    Convert confidence score to band.
    
    Args:
        score: Confidence score (0-100)
        
    Returns:
        Confidence band: "high", "medium", or "low"
        
    Example:
        >>> get_confidence_band(85)
        'high'
        >>> get_confidence_band(65)
        'medium'
        >>> get_confidence_band(40)
        'low'
    """
    if score >= 75:
        return "high"
    elif score >= 50:
        return "medium"
    else:
        return "low"


# ============================================================================
# Confidence Scoring v2
# ============================================================================

def compute_confidence_v2(
    signals: List[Dict[str, Any]],
    gaps: List[Dict[str, Any]],
    bias_flags: List[Dict[str, Any]]
) -> Tuple[float, str, List[Dict[str, Any]]]:
    """
    Compute confidence score v2 with weighted signals, gap penalties, and bias penalties.
    
    Args:
        signals: List of signal dicts
        gaps: List of gap dicts
        bias_flags: List of bias flag dicts
        
    Returns:
        Tuple of (confidence_score, confidence_band, explanation_factors)
        
    Algorithm:
        1. Start with base score = 0
        2. Add weighted score for each signal (weight × signal_strength × completeness_flag)
        3. Subtract gap penalties (missing, partial, weak, stale)
        4. Subtract bias penalties (by severity)
        5. Clamp to 0-100
        6. Determine band
        7. Generate explanation factors
        
    Example:
        >>> signals = [
        ...     {"metadata_json": '{"signal_type": "submission_present"}', 
        ...      "signal_strength": 1.0, "completeness_flag": 1}
        ... ]
        >>> gaps = []
        >>> bias_flags = []
        >>> score, band, factors = compute_confidence_v2(signals, gaps, bias_flags)
        >>> score
        20.0
        >>> band
        'low'
    """
    import json
    
    base_score = 0.0
    explanation_factors = []
    
    # ========================================================================
    # Step 1: Add weighted signal scores
    # ========================================================================
    signal_contributions = {}
    
    for signal in signals:
        try:
            metadata = json.loads(signal.get("metadata_json", "{}"))
            signal_type = metadata.get("signal_type", "unknown")
        except:
            signal_type = "unknown"
        
        weight = SIGNAL_WEIGHTS.get(signal_type, DEFAULT_SIGNAL_WEIGHT)
        strength = signal.get("signal_strength", 0.0)
        completeness = signal.get("completeness_flag", 0)
        
        # Signal contribution = weight × strength × (1 if complete else 0.5)
        # Partial completeness gets 50% credit
        completeness_multiplier = 1.0 if completeness == 1 else 0.5
        contribution = weight * strength * completeness_multiplier
        
        signal_contributions[signal_type] = contribution
        base_score += contribution
        
        # Add explanation factor
        if contribution > 0:
            explanation_factors.append({
                "factor": f"{signal_type}_signal",
                "impact": round(contribution, 2),
                "detail": f"Signal strength {strength} × weight {weight} × completeness {completeness_multiplier}"
            })
    
    # ========================================================================
    # Step 2: Subtract gap penalties
    # ========================================================================
    gap_penalty_total = 0.0
    gap_breakdown = {"missing": 0, "partial": 0, "weak": 0, "stale": 0}
    
    for gap in gaps:
        gap_type = gap.get("gapType", "unknown")
        severity = gap.get("severity", "low")
        
        penalty = 0.0
        if gap_type == "missing":
            penalty = GAP_PENALTY_PER_MISSING
            gap_breakdown["missing"] += 1
        elif gap_type == "partial":
            penalty = GAP_PENALTY_PER_PARTIAL
            gap_breakdown["partial"] += 1
        elif gap_type == "weak":
            penalty = GAP_PENALTY_PER_WEAK
            gap_breakdown["weak"] += 1
        elif gap_type == "stale":
            penalty = GAP_PENALTY_PER_STALE
            gap_breakdown["stale"] += 1
        
        # Multiply by severity
        if severity == "high":
            penalty *= 1.5
        elif severity == "low":
            penalty *= 0.5
        
        gap_penalty_total += penalty
    
    if gap_penalty_total > 0:
        explanation_factors.append({
            "factor": "gap_penalties",
            "impact": round(-gap_penalty_total, 2),
            "detail": f"Gaps: {gap_breakdown['missing']} missing, {gap_breakdown['partial']} partial, {gap_breakdown['weak']} weak, {gap_breakdown['stale']} stale"
        })
    
    # ========================================================================
    # Step 3: Subtract bias penalties
    # ========================================================================
    bias_penalty_total = 0.0
    bias_breakdown = {"low": 0, "medium": 0, "high": 0}
    
    for bias_flag in bias_flags:
        severity = bias_flag.get("severity", "low")
        
        if severity == "high":
            penalty = BIAS_PENALTY_HIGH
            bias_breakdown["high"] += 1
        elif severity == "medium":
            penalty = BIAS_PENALTY_MEDIUM
            bias_breakdown["medium"] += 1
        else:
            penalty = BIAS_PENALTY_LOW
            bias_breakdown["low"] += 1
        
        bias_penalty_total += penalty
    
    if bias_penalty_total > 0:
        explanation_factors.append({
            "factor": "bias_penalties",
            "impact": round(-bias_penalty_total, 2),
            "detail": f"Bias flags: {bias_breakdown['high']} high, {bias_breakdown['medium']} medium, {bias_breakdown['low']} low severity"
        })
    
    # ========================================================================
    # Step 4: Apply confidence floor when signals exist
    # ========================================================================
    # Prevent scoring exactly 0 when signals are present
    # This ensures cases with any data have minimum confidence
    raw_score = base_score - gap_penalty_total - bias_penalty_total
    
    # Determine minimum floor based on signal presence
    has_signals = len(signals) > 0
    has_submission = any(
        "submission_present" in json.loads(s.get("metadata_json", "{}")).get("signal_type", "")
        and s.get("completeness_flag", 0) == 1
        for s in signals
    )
    
    if has_signals and raw_score <= 0:
        # Set minimum floor to prevent zero confidence when signals exist
        if has_submission:
            # With submission: higher floor (at least minimal confidence)
            min_floor = 10.0
            explanation_factors.append({
                "factor": "confidence_floor_applied",
                "impact": min_floor - raw_score,
                "detail": "Minimum floor applied: signals present with submission"
            })
        else:
            # Without submission: lower floor
            min_floor = 5.0
            explanation_factors.append({
                "factor": "confidence_floor_applied",
                "impact": min_floor - raw_score,
                "detail": "Minimum floor applied: signals present without submission"
            })
        raw_score = max(raw_score, min_floor)
    
    # ========================================================================
    # Step 5: Clamp to 0-100 and determine band
    # ========================================================================
    final_score = max(0.0, min(100.0, raw_score))
    
    # Determine band
    confidence_band = get_confidence_band(final_score)
    
    # Add final score to explanation
    explanation_factors.insert(0, {
        "factor": "base_signal_score",
        "impact": round(base_score, 2),
        "detail": f"Weighted sum of {len(signal_contributions)} signals"
    })
    
    explanation_factors.append({
        "factor": "final_confidence",
        "impact": round(final_score, 2),
        "detail": f"{confidence_band.upper()} confidence band"
    })
    
    return round(final_score, 2), confidence_band, explanation_factors


# ============================================================================
# Helper Functions
# ============================================================================

def get_signal_weight(signal_type: str) -> float:
    """
    Get weight for a signal type.
    
    Args:
        signal_type: Signal type name
        
    Returns:
        Weight value (0-100)
    """
    return SIGNAL_WEIGHTS.get(signal_type, DEFAULT_SIGNAL_WEIGHT)


def calculate_max_possible_score(signal_types: List[str]) -> float:
    """
    Calculate maximum possible score if all signals are complete and strong.
    
    Args:
        signal_types: List of signal type names
        
    Returns:
        Maximum score
    """
    total = 0.0
    for signal_type in signal_types:
        total += get_signal_weight(signal_type)
    return total
