"""
Executive Summary Narrative Builder for Decision Intelligence (Phase 7.6).

Generates deterministic, executive-level summaries from DecisionIntelligence v2.

Features:
- Deterministic narrative generation (no LLM calls)
- Ties each statement to gaps/bias/explanation_factors
- Executive-level phrasing
- Severity-based prioritization
- Action-oriented recommendations

Schema:
- headline: One-line summary
- what_we_know: Max 3 positive facts from signals
- what_we_dont_know: Max 3 gaps/unknowns
- risks: Max 3 risk statements from bias/gaps
- recommended_next_actions: Max 3 specific actions
- confidence: score + band
- badges: Visual indicators like ["High Bias Risk", "Signal Gaps"]
"""

import json
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)


class ExecutiveSummary(BaseModel):
    """
    Executive summary derived from Decision Intelligence v2.
    All fields are deterministically generated.
    """
    headline: str = Field(..., description="One-line executive summary")
    what_we_know: List[str] = Field(default_factory=list, max_length=3, description="Positive facts from signals")
    what_we_dont_know: List[str] = Field(default_factory=list, max_length=3, description="Gaps and unknowns")
    risks: List[str] = Field(default_factory=list, max_length=3, description="Risk statements from bias/gaps")
    recommended_next_actions: List[str] = Field(default_factory=list, max_length=3, description="Specific actionable steps")
    confidence: Dict[str, Any] = Field(..., description="score and band")
    badges: List[str] = Field(default_factory=list, description="Visual indicators like High Bias Risk")
    
    class Config:
        json_schema_extra = {
            "example": {
                "headline": "Ready for decision - High confidence with complete evidence",
                "what_we_know": [
                    "Primary submission completed with all required fields",
                    "Supporting evidence attached and verified",
                    "All compliance criteria met"
                ],
                "what_we_dont_know": [],
                "risks": [],
                "recommended_next_actions": ["Proceed to final approval"],
                "confidence": {"score": 92.5, "band": "HIGH"},
                "badges": []
            }
        }


# ============================================================================
# Gap Severity Threshold
# ============================================================================

GAP_SEVERITY_THRESHOLD = 50  # Gap severity > 50 triggers "needs review" emphasis


# ============================================================================
# Narrative Builder
# ============================================================================

def build_executive_summary(
    intel: Dict[str, Any],
    case: Dict[str, Any],
    decision_type: str
) -> ExecutiveSummary:
    """
    Build deterministic executive summary from DecisionIntelligence v2.
    
    Args:
        intel: DecisionIntelligence response dict with v2 fields
        case: CaseRecord dict with status, createdAt, assignedTo, etc.
        decision_type: Decision type (csf_practitioner, csf_facility, etc.)
    
    Returns:
        ExecutiveSummary with all fields populated deterministically
    
    Logic:
    - Headline: Determined by confidence_band and gap_severity_score
    - what_we_know: Derived from explanation_factors (positive signals)
    - what_we_dont_know: Derived from gaps + request_info state
    - risks: Derived from bias_flags and high-severity gaps
    - recommended_next_actions: Prioritized by severity (gaps first, bias second)
    - badges: Visual indicators for bias/gaps/staleness
    """
    
    # Parse JSON fields
    gaps = json.loads(intel.get("gap_json", "[]"))
    bias_flags = json.loads(intel.get("bias_json", "[]"))
    explanation_factors = json.loads(intel.get("explanation_factors_json", "[]"))
    
    # Extract core metrics
    confidence_score = float(intel.get("confidence_score", 0))
    confidence_band = intel.get("confidence_band", "LOW")
    gap_severity_score = float(intel.get("gap_severity_score", 0))
    
    # Build confidence dict
    confidence = {
        "score": confidence_score,
        "band": confidence_band
    }
    
    # ========================================================================
    # 1. Generate Headline
    # ========================================================================
    
    headline = _build_headline(confidence_band, gap_severity_score, gaps, case)
    
    # ========================================================================
    # 2. What We Know (from explanation_factors - positive signals)
    # ========================================================================
    
    what_we_know = _build_what_we_know(explanation_factors, confidence_band)
    
    # ========================================================================
    # 3. What We Don't Know (from gaps + request_info state)
    # ========================================================================
    
    what_we_dont_know = _build_what_we_dont_know(gaps, case, gap_severity_score)
    
    # ========================================================================
    # 4. Risks (from bias_flags and high-severity gaps)
    # ========================================================================
    
    risks = _build_risks(bias_flags, gaps, gap_severity_score)
    
    # ========================================================================
    # 5. Recommended Next Actions (prioritized by severity)
    # ========================================================================
    
    recommended_next_actions = _build_next_actions(
        gaps, bias_flags, case, confidence_band, gap_severity_score
    )
    
    # ========================================================================
    # 6. Badges (visual indicators)
    # ========================================================================
    
    badges = _build_badges(bias_flags, gaps, gap_severity_score, intel)
    
    return ExecutiveSummary(
        headline=headline,
        what_we_know=what_we_know,
        what_we_dont_know=what_we_dont_know,
        risks=risks,
        recommended_next_actions=recommended_next_actions,
        confidence=confidence,
        badges=badges
    )


# ============================================================================
# Helper Functions (Deterministic Logic)
# ============================================================================

def _build_headline(
    confidence_band: str,
    gap_severity_score: float,
    gaps: List[Dict],
    case: Dict
) -> str:
    """Generate headline based on confidence and gaps."""
    
    status = case.get("status", "new")
    
    # High confidence + no significant gaps
    if confidence_band == "HIGH" and gap_severity_score < GAP_SEVERITY_THRESHOLD:
        return "Ready for decision - High confidence with complete evidence"
    
    # High confidence but some gaps
    if confidence_band == "HIGH" and gaps:
        return "High confidence - Minor gaps identified for review"
    
    # Medium confidence
    if confidence_band == "MEDIUM":
        if gap_severity_score > GAP_SEVERITY_THRESHOLD:
            return "Needs review - Evidence gaps require attention"
        return "Moderate confidence - Additional verification recommended"
    
    # Low confidence
    if confidence_band == "LOW":
        if len(gaps) > 0:
            return "Critical review needed - Significant evidence gaps detected"
        return "Low confidence - Insufficient signals for reliable assessment"
    
    # Default
    return f"Case {status} - Awaiting additional information"


def _build_what_we_know(
    explanation_factors: List[Dict],
    confidence_band: str
) -> List[str]:
    """Extract positive facts from explanation_factors."""
    
    known = []
    
    # Process explanation factors (sorted by contribution in v2)
    for factor in explanation_factors[:3]:  # Max 3
        factor_type = factor.get("factor", "")
        contribution = factor.get("contribution", 0)
        details = factor.get("details", "")
        
        # Only include positive signals (contribution > 0)
        if contribution > 0:
            if factor_type == "submission_complete":
                known.append("Primary submission completed with all required fields")
            elif factor_type == "evidence_attached":
                known.append(f"Supporting evidence attached: {details}")
            elif factor_type == "verification_passed":
                known.append("Verification checks passed successfully")
            elif factor_type == "compliance_signals":
                known.append(f"Compliance criteria met: {details}")
            elif details:
                known.append(details)
    
    # If no specific factors, provide generic statement for high confidence
    if not known and confidence_band == "HIGH":
        known.append("Case has sufficient signals for confident assessment")
    
    return known[:3]  # Max 3


def _build_what_we_dont_know(
    gaps: List[Dict],
    case: Dict,
    gap_severity_score: float
) -> List[str]:
    """Extract unknowns from gaps and case state."""
    
    unknowns = []
    
    # Sort gaps by severity (highest first)
    sorted_gaps = sorted(gaps, key=lambda g: g.get("severity", 0), reverse=True)
    
    for gap in sorted_gaps[:3]:  # Max 3
        gap_type = gap.get("gap_type", "")
        description = gap.get("description", "")
        severity = gap.get("severity", 0)
        
        if gap_type == "missing_submission":
            unknowns.append("Primary submission not provided")
        elif gap_type == "missing_evidence":
            unknowns.append(f"Missing required evidence: {description}")
        elif gap_type == "incomplete_field":
            unknowns.append(f"Incomplete field: {description}")
        elif gap_type == "request_info_open":
            unknowns.append("Waiting on submitter response to information request")
        elif description:
            unknowns.append(description)
    
    # Check for open request_info state from case
    status = case.get("status", "")
    if status == "needs_info" and "Waiting on submitter" not in str(unknowns):
        unknowns.insert(0, "Waiting on submitter response to information request")
    
    return unknowns[:3]  # Max 3


def _build_risks(
    bias_flags: List[Dict],
    gaps: List[Dict],
    gap_severity_score: float
) -> List[str]:
    """Extract risks from bias flags and high-severity gaps."""
    
    risks = []
    
    # Process bias flags (sorted by severity)
    sorted_bias = sorted(bias_flags, key=lambda b: b.get("severity", 0), reverse=True)
    
    for bias in sorted_bias[:2]:  # Max 2 from bias
        bias_type = bias.get("bias_type", "")
        severity = bias.get("severity", 0)
        
        if bias_type == "single_source_reliance":
            risks.append("Single source reliance - Validation with secondary source recommended")
        elif bias_type == "low_signal_diversity":
            risks.append("Low signal diversity - Additional verification sources needed")
        elif bias_type == "temporal_clustering":
            risks.append("All signals from same timeframe - May miss recent changes")
        elif bias_type == "recency_bias":
            risks.append("Recent signals may overshadow historical context")
    
    # Add risk from high-severity gaps
    if gap_severity_score > GAP_SEVERITY_THRESHOLD and len(gaps) > 0:
        high_severity_gaps = [g for g in gaps if g.get("severity") == "high"]
        if high_severity_gaps:
            risks.append(f"Critical evidence gaps may impact decision reliability")
    
    return risks[:3]  # Max 3


def _build_next_actions(
    gaps: List[Dict],
    bias_flags: List[Dict],
    case: Dict,
    confidence_band: str,
    gap_severity_score: float
) -> List[str]:
    """Generate prioritized action recommendations."""
    
    actions = []
    
    # Priority 1: Critical gaps (severity > threshold)
    if gap_severity_score > GAP_SEVERITY_THRESHOLD:
        # Find highest severity gap
        sorted_gaps = sorted(gaps, key=lambda g: g.get("severity", 0), reverse=True)
        if sorted_gaps:
            top_gap = sorted_gaps[0]
            gap_type = top_gap.get("gap_type", "")
            
            if gap_type == "missing_submission":
                actions.append("Request primary submission from applicant")
            elif gap_type == "missing_evidence":
                actions.append(f"Request missing evidence: {top_gap.get('description', 'required documentation')}")
            elif gap_type == "request_info_open":
                actions.append("Follow up on outstanding information request by due date")
            else:
                actions.append("Request additional information to close evidence gaps")
    
    # Priority 2: Bias mitigation
    for bias in bias_flags[:1]:  # Max 1 bias action
        bias_type = bias.get("bias_type", "")
        
        if bias_type == "single_source_reliance":
            actions.append("Validate findings with secondary independent source")
        elif bias_type == "low_signal_diversity":
            actions.append("Seek additional verification from diverse sources")
    
    # Priority 3: Status-based actions
    status = case.get("status", "")
    if status == "needs_info" and "Follow up" not in str(actions):
        actions.append("Follow up on outstanding information request")
    
    # High confidence - minimal actions
    if confidence_band == "HIGH" and gap_severity_score < GAP_SEVERITY_THRESHOLD:
        if not actions:
            actions.append("Proceed to final approval decision")
    
    # Low confidence - emphasize review
    if confidence_band == "LOW" and not actions:
        actions.append("Conduct thorough manual review before proceeding")
    
    # Default action if none generated
    if not actions:
        actions.append("Review case details and proceed per standard workflow")
    
    return actions[:3]  # Max 3


def _build_badges(
    bias_flags: List[Dict],
    gaps: List[Dict],
    gap_severity_score: float,
    intel: Dict
) -> List[str]:
    """Generate visual indicator badges."""
    
    badges = []
    
    # High bias risk
    if len(bias_flags) > 0:
        high_severity_bias = [b for b in bias_flags if b.get("severity") == "high"]
        if high_severity_bias:
            badges.append("High Bias Risk")
        else:
            badges.append("Bias Detected")
    
    # Signal gaps
    if len(gaps) > 0:
        if gap_severity_score > GAP_SEVERITY_THRESHOLD:
            badges.append("Critical Gaps")
        else:
            badges.append("Minor Gaps")
    
    # Stale signals (if intelligence is old)
    updated_at_str = intel.get("updated_at", "")
    if updated_at_str:
        try:
            updated_at = datetime.fromisoformat(updated_at_str.replace('Z', '+00:00'))
            age_minutes = (datetime.now(timezone.utc) - updated_at).total_seconds() / 60
            if age_minutes > 60:  # Stale after 1 hour
                badges.append("Stale Signals")
        except Exception:
            pass
    
    return badges[:5]  # Max 5 badges
