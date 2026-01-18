"""
Pydantic models for Signal Intelligence (Phase 7.1 + 7.2).

Models:
- Signal: Individual data points collected during case processing
- DecisionIntelligence: Computed intelligence metrics for a case (v2)
"""

from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


class Signal(BaseModel):
    """
    A signal represents a data point collected during case processing.
    
    Signals are emitted from various sources (submissions, evidence, RAG traces, events)
    and aggregated to compute decision intelligence.
    """
    id: str
    case_id: str
    decision_type: str
    source_type: str  # submission, evidence, rag_trace, case_event
    timestamp: str  # ISO 8601 format
    signal_strength: float = 1.0
    completeness_flag: int = 0  # 0 = incomplete, 1 = complete
    metadata_json: str = "{}"
    created_at: str  # ISO 8601 format
    
    class Config:
        json_schema_extra = {
            "example": {
                "id": "sig_abc123",
                "case_id": "case_xyz",
                "decision_type": "csf_practitioner",
                "source_type": "submission",
                "timestamp": "2026-01-15T10:30:00Z",
                "signal_strength": 1.0,
                "completeness_flag": 1,
                "metadata_json": '{"field": "license_number", "present": true}',
                "created_at": "2026-01-15T10:30:00Z"
            }
        }


class SignalCreate(BaseModel):
    """Request model for creating a signal."""
    case_id: str
    decision_type: str
    source_type: str
    timestamp: Optional[str] = None  # Defaults to current time
    signal_strength: float = 1.0
    completeness_flag: int = 0
    metadata_json: str = "{}"


class DecisionIntelligence(BaseModel):
    """
    Decision Intelligence computed for a case.
    
    Aggregates signals to provide:
    - Completeness score and gap analysis
    - Bias detection
    - Confidence scoring and banding
    - Human-readable narrative
    """
    case_id: str
    computed_at: str  # ISO 8601 format
    updated_at: str  # ISO 8601 format
    completeness_score: int = Field(..., ge=0, le=100)
    gap_json: str = "[]"  # JSON array of gap descriptions
    bias_json: str = "[]"  # JSON array of bias flags
    confidence_score: float = Field(..., ge=0, le=100)  # Phase 7.2: v2 returns float
    confidence_band: str  # high, medium, low
    narrative_template: str
    narrative_genai: Optional[str] = None
    executive_summary_json: Optional[str] = None  # Phase 7.6: Cached ExecutiveSummary JSON
    
    class Config:
        json_schema_extra = {
            "example": {
                "case_id": "case_xyz",
                "computed_at": "2026-01-15T10:35:00Z",
                "updated_at": "2026-01-15T10:35:00Z",
                "completeness_score": 85,
                "gap_json": '["Missing employer verification"]',
                "bias_json": '[]',
                "confidence_score": 80,
                "confidence_band": "high",
                "narrative_template": "Case has 85% completeness with 1 gap. Confidence: high (80%).",
                "narrative_genai": None
            }
        }


class DecisionIntelligenceResponse(BaseModel):
    """Response model for decision intelligence endpoint (v2 with gaps/bias details + freshness)."""
    case_id: str
    computed_at: str
    updated_at: str
    completeness_score: int
    gaps: List[Dict[str, Any]] = []  # v2: Structured gap objects
    gap_severity_score: int = 0  # v2: 0-100 gap severity
    bias_flags: List[Dict[str, Any]] = []  # v2: Structured bias flag objects
    confidence_score: float  # v2: Can be float with decimals
    confidence_band: str
    narrative: str
    narrative_genai: Optional[str] = None
    explanation_factors: List[Dict[str, Any]] = []  # v2: Confidence explanation
    
    # Phase 7.4: Freshness indicators
    is_stale: bool = False  # True if (now - computed_at) > stale_after_minutes
    stale_after_minutes: int = 30  # How long before intelligence is considered stale
    
    # Phase 7.8: Rule-based confidence details
    rules_total: int = 0  # Total number of validation rules evaluated
    rules_passed: int = 0  # Number of rules that passed
    rules_failed_count: int = 0  # Number of rules that failed
    failed_rules: List[Dict[str, Any]] = []  # Details of failed rules
    
    # Phase 7.14: Field-level validation details
    field_checks_total: int = 0  # Total number of field validation checks run
    field_checks_passed: int = 0  # Number of field checks that passed
    field_issues: List[Dict[str, Any]] = []  # Details of field validation issues
    confidence_rationale: str = ""  # Explanation of confidence adjustments from field validation
    
    class Config:
        json_schema_extra = {
            "example": {
                "case_id": "case_xyz",
                "computed_at": "2026-01-15T10:35:00Z",
                "updated_at": "2026-01-15T10:35:00Z",
                "completeness_score": 85,
                "gaps": [
                    {
                        "gapType": "missing",
                        "severity": "high",
                        "signalType": "evidence_present",
                        "message": "Required signal 'evidence_present' is missing",
                        "expectedThreshold": 1.0
                    }
                ],
                "gap_severity_score": 25,
                "bias_flags": [
                    {
                        "flagType": "low_diversity",
                        "severity": "medium",
                        "message": "Only 2 unique source types",
                        "suggestedAction": "Collect signals from additional sources",
                        "metadata": {"unique_sources": 2, "min_required": 3}
                    }
                ],
                "confidence_score": 62.5,
                "confidence_band": "medium",
                "narrative": "Case has 85% completeness with 1 gap(s) and 1 bias flag(s). Confidence: medium (62.5%).",
                "narrative_genai": None,
                "explanation_factors": [
                    {"factor": "base_signal_score", "impact": 70.0, "detail": "Weighted sum of 3 signals"},
                    {"factor": "gap_penalties", "impact": -5.0, "detail": "Gaps: 1 missing"},
                    {"factor": "bias_penalties", "impact": -2.5, "detail": "Bias flags: 1 medium"},
                    {"factor": "final_confidence", "impact": 62.5, "detail": "MEDIUM confidence band"}
                ],
                "is_stale": False,
                "stale_after_minutes": 30
            }
        }


class ComputeIntelligenceRequest(BaseModel):
    """Request model for recomputing decision intelligence."""
    force: bool = False  # Force recomputation even if recent


class IntelligenceHistoryEntry(BaseModel):
    """
    Historical snapshot of intelligence computation (Phase 7.17).
    
    Extracted from case_events with event_type='decision_intelligence_updated'.
    Shows confidence changes over time with triggers (manual/submission/evidence/request_info).
    """
    computed_at: str = Field(..., description="When intelligence was computed (ISO 8601)")
    confidence_score: float = Field(..., description="Confidence percentage (0-100)")
    confidence_band: str = Field(..., description="Confidence band (high/medium/low)")
    rules_passed: int = Field(default=0, description="Number of rules passed")
    rules_total: int = Field(default=0, description="Total rules evaluated")
    gap_count: int = Field(default=0, description="Number of gaps detected")
    bias_count: int = Field(default=0, description="Number of bias flags")
    trigger: str = Field(default="unknown", description="What triggered recompute (manual/submission/evidence/request_info)")
    actor_role: str = Field(default="system", description="Role that triggered computation")
    
    class Config:
        json_schema_extra = {
            "example": {
                "computed_at": "2026-01-18T10:35:00Z",
                "confidence_score": 82.5,
                "confidence_band": "high",
                "rules_passed": 8,
                "rules_total": 10,
                "gap_count": 1,
                "bias_count": 0,
                "trigger": "manual",
                "actor_role": "admin"
            }
        }
