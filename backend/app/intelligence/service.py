"""
Intelligence Service - Phase 7.5 + 7.6

High-level service layer for Decision Intelligence operations.
Provides clean interface for auto-recompute with signal generation.

Key Functions:
- recompute_case_intelligence: Generate signals + compute v2 intelligence + emit events + cache executive summary
- Wraps lifecycle.py + generator.py + repository.py + narrative.py
- Adds actor tracking and enhanced logging
"""

import json
import logging
from typing import Optional
from datetime import datetime

from .generator import generate_signals_for_case
from .repository import (
    compute_and_upsert_decision_intelligence,
    upsert_signals,
    get_decision_intelligence,
    update_executive_summary
)
from .narrative import build_executive_summary
from .lifecycle import request_recompute as lifecycle_request_recompute
from app.workflow.repo import create_case_event
from src.config import get_settings

logger = logging.getLogger(__name__)


# ============================================================================
# Service Layer
# ============================================================================

def recompute_case_intelligence(
    case_id: str,
    decision_type: Optional[str] = None,
    actor: str = "system",
    reason: str = "Case updated",
    trigger: str = "unknown"  # Phase 7.17: Add trigger parameter
) -> Optional[dict]:
    """
    Recompute Decision Intelligence for a case with full signal generation.
    
    This is the main entry point for manual and automatic intelligence updates.
    It orchestrates the full pipeline:
    1. Generate deterministic signals from case artifacts
    2. Upsert signals to database
    3. Compute v2 intelligence (gaps, bias, confidence)
    4. Write decision_intelligence row
    5. Emit case event for audit trail
    
    Includes throttling: If called within 2 seconds for same case, skips recompute.
    
    Args:
        case_id: Case UUID
        decision_type: Decision type (auto-detected if not provided)
        actor: User/system identifier performing recompute
        reason: Human-readable reason for recompute
        
    Returns:
        DecisionIntelligence dict if successful, None if skipped/failed
        
    Examples:
        >>> # Manual recompute by verifier
        >>> recompute_case_intelligence(
        ...     case_id="abc-123",
        ...     decision_type="csf_practitioner",
        ...     actor="verifier@example.com",
        ...     reason="Verifier requested update"
        ... )
        
        >>> # Auto-recompute on submission update
        >>> recompute_case_intelligence(
        ...     case_id="abc-123",
        ...     actor="system",
        ...     reason="Submission updated"
        ... )
    """
    settings = get_settings()
    
    # Check feature flag
    if not settings.AUTO_INTELLIGENCE_ENABLED:
        logger.debug(f"[Service] Auto-intelligence disabled for {case_id}")
        return None
    
    # Check throttle by examining last updated_at timestamp
    existing = get_decision_intelligence(case_id)
    if existing and _is_throttled(existing):
        logger.debug(f"[Service] Throttled: Skipping recompute for {case_id} (updated too recently)")
        return None
    
    logger.info(f"[Service] Recomputing intelligence for {case_id} (actor: {actor}, reason: {reason})")
    
    try:
        # Auto-detect decision_type if not provided
        if not decision_type:
            decision_type = _get_case_decision_type(case_id)
            if not decision_type:
                logger.warning(f"[Service] Could not determine decision_type for {case_id}")
                return None
        
        # Step 1: Generate signals from case artifacts
        logger.debug(f"[Service] Generating signals for {case_id}")
        signal_objects = generate_signals_for_case(case_id)
        
        # Convert SignalCreate objects to dicts for upsert
        signal_dicts = []
        for signal_obj in signal_objects:
            signal_dicts.append({
                "decision_type": signal_obj.decision_type,
                "source_type": signal_obj.source_type,
                "signal_strength": signal_obj.signal_strength,
                "completeness_flag": signal_obj.completeness_flag,
                "metadata_json": signal_obj.metadata_json,
                "timestamp": signal_obj.timestamp,
            })
        
        # Step 2: Upsert signals
        if signal_dicts:
            logger.debug(f"[Service] Upserting {len(signal_dicts)} signals for {case_id}")
            upsert_signals(case_id, signal_dicts)
        else:
            logger.warning(f"[Service] No signals generated for {case_id}")
        
        # Step 3: Compute v2 intelligence
        logger.debug(f"[Service] Computing v2 intelligence for {case_id}")
        intelligence = compute_and_upsert_decision_intelligence(case_id, decision_type)
        
        # Step 4: Generate and cache executive summary (Phase 7.6)
        logger.debug(f"[Service] Generating executive summary for {case_id}")
        try:
            exec_summary = _generate_and_cache_executive_summary(
                case_id=case_id,
                intelligence=intelligence,
                decision_type=decision_type
            )
            logger.debug(f"[Service] Cached executive summary: {exec_summary.headline[:50]}...")
        except Exception as e:
            logger.warning(f"[Service] Failed to generate executive summary for {case_id}: {e}")
        
        # Step 5: Emit case event
        _emit_intelligence_event(
            case_id=case_id,
            actor=actor,
            reason=reason,
            trigger=trigger,  # Phase 7.17: Pass trigger
            intelligence=intelligence
        )
        
        logger.info(
            f"[Service] Successfully recomputed intelligence for {case_id}: "
            f"confidence={intelligence.confidence_score} ({intelligence.confidence_band})"
        )
        
        # Step 6: Insert history snapshot (Phase 7.11)
        result_dict = {
            "case_id": intelligence.case_id,
            "computed_at": intelligence.computed_at,
            "updated_at": intelligence.updated_at,
            "completeness_score": intelligence.completeness_score,
            "confidence_score": intelligence.confidence_score,
            "confidence_band": intelligence.confidence_band,
            "gap_json": intelligence.gap_json,
            "bias_json": intelligence.bias_json,
            "narrative_template": intelligence.narrative_template,
            "narrative_genai": intelligence.narrative_genai,
        }
        
        try:
            from .repository import insert_intelligence_history
            history_id = insert_intelligence_history(
                case_id=case_id,
                payload=result_dict,
                actor=actor,
                reason=reason
            )
            logger.debug(f"[Service] Created history entry {history_id}")
        except Exception as e:
            logger.warning(f"[Service] Failed to insert history for {case_id}: {e}")
        
        # Return as dict for API consumption
        return result_dict
        
    except Exception as e:
        logger.error(f"[Service] Failed to recompute intelligence for {case_id}: {e}", exc_info=True)
        return None


def _get_case_decision_type(case_id: str) -> Optional[str]:
    """
    Get decision type for a case.
    
    Args:
        case_id: The case ID
        
    Returns:
        Decision type string or None if not found
    """
    from src.core.db import execute_sql
    
    result = execute_sql(
        "SELECT decision_type FROM cases WHERE id = :case_id",
        {"case_id": case_id}
    )
    
    if result and len(result) > 0:
        return result[0].get('decision_type') or 'csf'
    
    return 'csf'


def _is_throttled(existing_intelligence) -> bool:
    """
    Check if intelligence was updated too recently (within 2 seconds).
    
    Args:
        existing_intelligence: DecisionIntelligence object with updated_at
        
    Returns:
        True if throttled (should skip), False if can proceed
    """
    if not existing_intelligence.updated_at:
        return False
    
    try:
        updated_time = datetime.fromisoformat(existing_intelligence.updated_at.replace("Z", "+00:00"))
        elapsed = (datetime.utcnow() - updated_time.replace(tzinfo=None)).total_seconds()
        return elapsed < 2
    except:
        return False


def _emit_intelligence_event(
    case_id: str,
    actor: str,
    reason: str,
    trigger: str,
    intelligence
) -> None:
    """
    Emit case event for intelligence update (Phase 7.17).
    
    Args:
        case_id: Case ID
        actor: User/system performing update
        reason: Reason for update
        trigger: What triggered recompute (manual/submission/evidence/request_info)
        intelligence: DecisionIntelligence object with computed metrics
    """
    try:
        # Parse gaps and bias from JSON
        import json
        try:
            gaps = json.loads(intelligence.gap_json) if intelligence.gap_json else []
        except:
            gaps = []
        try:
            bias_flags = json.loads(intelligence.bias_json) if intelligence.bias_json else []
        except:
            bias_flags = []
        
        # Extract rule counts from executive summary if available
        rules_total = 0
        rules_passed = 0
        rules_failed = 0
        try:
            if intelligence.executive_summary_json:
                exec_data = json.loads(intelligence.executive_summary_json)
                explanation = exec_data.get("explanation_factors", {})
                rules_total = explanation.get("total_rules", 0)
                rules_passed = explanation.get("passed_rules", 0)
                rules_failed = explanation.get("failed_rules", 0)
        except:
            pass
        
        create_case_event(
            case_id=case_id,
            event_type="decision_intelligence_updated",
            actor_role="system",
            actor_id=actor,
            message=reason,
            payload_dict={
                "computed_at": intelligence.computed_at,
                "confidence_score": intelligence.confidence_score,
                "confidence_band": intelligence.confidence_band,
                "rules_total": rules_total,
                "rules_passed": rules_passed,
                "rules_failed": rules_failed,
                "gap_count": len(gaps),
                "bias_count": len(bias_flags),
                "trigger": trigger,  # Phase 7.17: Track what triggered this
                "reason": reason,
            }
        )
    except Exception as e:
        logger.error(f"[Service] Failed to emit intelligence event for {case_id}: {e}")


def _generate_and_cache_executive_summary(
    case_id: str,
    intelligence,
    decision_type: str
):
    """
    Generate executive summary and cache in decision_intelligence table (Phase 7.6).
    
    Args:
        case_id: Case ID
        intelligence: DecisionIntelligence object
        decision_type: Decision type
        
    Returns:
        ExecutiveSummary object
    """
    from src.core.db import execute_sql
    from .narrative import ExecutiveSummary
    
    # Build intelligence dict for narrative builder
    intel_dict = {
        "case_id": intelligence.case_id,
        "computed_at": intelligence.computed_at,
        "updated_at": intelligence.updated_at,
        "completeness_score": intelligence.completeness_score,
        "gap_json": intelligence.gap_json,
        "bias_json": intelligence.bias_json,
        "confidence_score": intelligence.confidence_score,
        "confidence_band": intelligence.confidence_band,
        "explanation_factors_json": "[]",  # Will extract from gap_json/bias_json
        "gap_severity_score": 0,  # Calculate from gaps
    }
    
    # Extract gap severity and explanation factors
    import json
    gaps = json.loads(intelligence.gap_json)
    bias_flags = json.loads(intelligence.bias_json)
    
    # Calculate gap severity score (0-100)
    if gaps:
        gap_severities = []
        for gap in gaps:
            sev_str = gap.get("severity", "low")
            if sev_str == "high":
                gap_severities.append(90)
            elif sev_str == "medium":
                gap_severities.append(50)
            else:
                gap_severities.append(20)
        intel_dict["gap_severity_score"] = sum(gap_severities) / len(gap_severities)
    
    # Build explanation factors from gaps/bias
    explanation_factors = []
    for gap in gaps[:2]:
        explanation_factors.append({
            "factor": f"gap_{gap.get('gapType', 'unknown')}",
            "contribution": -10,
            "details": gap.get("message", "")
        })
    for bias in bias_flags[:2]:
        explanation_factors.append({
            "factor": f"bias_{bias.get('flagType', 'unknown')}",
            "contribution": -5,
            "details": bias.get("message", "")
        })
    intel_dict["explanation_factors_json"] = json.dumps(explanation_factors)
    
    # Fetch case details
    case_rows = execute_sql(
        "SELECT id, status, created_at, assigned_to, decision_type, title, summary FROM cases WHERE id = :case_id",
        {"case_id": case_id}
    )
    
    if not case_rows:
        logger.warning(f"[Service] Case {case_id} not found for executive summary")
        raise ValueError(f"Case {case_id} not found")
    
    case_row = case_rows[0]
    case_dict = {
        "id": case_row["id"],
        "status": case_row.get("status") or "new",
        "createdAt": case_row.get("created_at"),
        "assignedTo": case_row.get("assigned_to"),
        "decision_type": case_row.get("decision_type") or decision_type,
        "title": case_row.get("title") or "",
        "summary": case_row.get("summary") or "",
    }
    
    # Build executive summary
    exec_summary = build_executive_summary(
        intel=intel_dict,
        case=case_dict,
        decision_type=decision_type
    )
    
    # Merge with rule summary from explanation_factors if present
    exec_summary_dict = exec_summary.model_dump()
    
    # Preserve rule validation details from intelligence computation
    if intelligence and intelligence.executive_summary_json:
        try:
            rule_info = json.loads(intelligence.executive_summary_json)
            if isinstance(rule_info, dict):
                # Add rule-based validation info to executive summary
                exec_summary_dict["rule_validation"] = {
                    "method": rule_info.get("method"),
                    "passed_rules": rule_info.get("passed_rules"),
                    "total_rules": rule_info.get("total_rules"),
                    "failed_rules": rule_info.get("failed_rules"),
                    "critical_failures": rule_info.get("critical_failures", []),
                    "rule_summary": rule_info.get("rule_summary", {}),
                }
        except:
            pass  # Ignore JSON parse errors
    
    # Cache merged summary as JSON
    exec_summary_json = json.dumps(exec_summary_dict)
    update_executive_summary(case_id, exec_summary_json)
    
    return exec_summary


# ============================================================================
# Convenience Functions
# ============================================================================

def recompute_on_submission_change(case_id: str, actor: str = "system") -> Optional[dict]:
    """Recompute intelligence after submission create/update."""
    return recompute_case_intelligence(
        case_id=case_id,
        actor=actor,
        reason="Submission changed"
    )


def recompute_on_evidence_change(case_id: str, actor: str = "system") -> Optional[dict]:
    """Recompute intelligence after evidence attach/delete."""
    return recompute_case_intelligence(
        case_id=case_id,
        actor=actor,
        reason="Evidence changed"
    )


def recompute_on_request_info(case_id: str, actor: str = "system") -> Optional[dict]:
    """Recompute intelligence after request info create/resubmit."""
    return recompute_case_intelligence(
        case_id=case_id,
        actor=actor,
        reason="Request info updated"
    )


def recompute_on_status_change(case_id: str, new_status: str, actor: str = "system") -> Optional[dict]:
    """Recompute intelligence after status change."""
    return recompute_case_intelligence(
        case_id=case_id,
        actor=actor,
        reason=f"Status changed to {new_status}"
    )
