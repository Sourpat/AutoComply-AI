"""
Intelligence Router - API endpoints for Signal Intelligence (Phase 7.1 + 7.2 + 7.4).

Endpoints:
- GET /workflow/cases/{caseId}/intelligence - Get decision intelligence (v2 + freshness)
- POST /workflow/cases/{caseId}/intelligence/recompute - Recompute intelligence (admin/devsupport) (v2)
"""

import json
import logging
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, HTTPException, Request, Query
from pydantic import BaseModel

from app.core.authz import get_role, require_admin
from app.intelligence.models import (
    DecisionIntelligenceResponse,
    ComputeIntelligenceRequest,
    IntelligenceHistoryEntry,
)
from app.intelligence.repository import (
    get_decision_intelligence,
    compute_and_upsert_decision_intelligence,
    upsert_signals,
)
from app.intelligence.generator import generate_signals_for_case
from app.workflow.repo import create_case_event, get_case, list_case_events

logger = logging.getLogger(__name__)

router = APIRouter()


# ============================================================================
# Helper Functions
# ============================================================================

def compute_is_stale(computed_at: str, stale_after_minutes: int) -> bool:
    """
    Check if intelligence is stale based on computed_at timestamp.
    
    Args:
        computed_at: ISO 8601 timestamp
        stale_after_minutes: Freshness threshold in minutes
        
    Returns:
        True if stale, False if fresh
    """
    try:
        computed_time = datetime.fromisoformat(computed_at.replace("Z", "+00:00"))
        age_minutes = (datetime.utcnow() - computed_time.replace(tzinfo=None)).total_seconds() / 60
        return age_minutes > stale_after_minutes
    except Exception as e:
        logger.warning(f"Failed to compute is_stale: {e}")
        return False


def get_actor_context(request: Request) -> dict:
    """
    Extract actor context from request including role and admin unlock.
    
    Supports local/dev testing via:
    - Headers: x-user-role, x-role, X-AutoComply-Role
    - Query params: admin_unlocked=1 or admin_unlocked=true
    - Header: x-admin-unlocked=1
    
    Args:
        request: FastAPI Request object
        
    Returns:
        Dict with keys: user (str), role (str), admin_unlocked (bool)
        
    Example:
        >>> ctx = get_actor_context(request)
        >>> if ctx['role'] in ['admin', 'devsupport'] or ctx['admin_unlocked']:
        ...     # Allow privileged action
    """
    # Extract role from headers in priority order
    role = (
        request.headers.get("x-user-role") or
        request.headers.get("x-role") or
        request.headers.get("X-AutoComply-Role") or
        getattr(request.state, "user_role", None) or
        "verifier"
    ).lower()
    
    # Validate role (support devsupport for local testing)
    if role not in ["admin", "verifier", "devsupport"]:
        role = "verifier"
    
    # Check admin unlock (for local dev/testing)
    admin_unlocked = False
    
    # Check query param admin_unlocked
    admin_unlocked_param = request.query_params.get("admin_unlocked", "").lower()
    if admin_unlocked_param in ["1", "true"]:
        admin_unlocked = True
    
    # Check header x-admin-unlocked
    admin_unlocked_header = request.headers.get("x-admin-unlocked", "").lower()
    if admin_unlocked_header == "1":
        admin_unlocked = True
    
    # Extract user/actor
    user = (
        request.headers.get("X-AutoComply-Actor") or
        request.headers.get("x-user") or
        role
    )
    
    return {
        "user": user,
        "role": role,
        "admin_unlocked": admin_unlocked,
    }


# ============================================================================
# Intelligence Endpoints
# ============================================================================

@router.get(
    "/workflow/cases/{case_id}/intelligence",
    response_model=DecisionIntelligenceResponse,
    summary="Get Decision Intelligence (v2)",
    description="Retrieve computed decision intelligence for a case with gap/bias details.",
)
def get_intelligence_endpoint(
    case_id: str,
    request: Request,
    decision_type: str = Query(default="default", description="Decision type for gap expectations")
):
    """
    Get decision intelligence v2 for a case.
    
    Returns computed metrics including:
    - Completeness score and structured gaps
    - Gap severity score (0-100)
    - Structured bias flags
    - Confidence score v2 and band
    - Explanation factors for confidence
    - Human-readable narrative
    """
    # Get intelligence
    intelligence = get_decision_intelligence(case_id)
    
    if not intelligence:
        # If not computed yet, compute it on first access
        logger.info(f"Intelligence not found for case {case_id}, computing with decision_type={decision_type}...")
        
        # Try to get decision_type from case
        try:
            case = get_case(case_id)
            if case and hasattr(case, 'decision_type'):
                decision_type = case.decision_type
        except:
            pass
        
        intelligence = compute_and_upsert_decision_intelligence(case_id, decision_type)
    
    # Parse JSON fields for v2 response
    try:
        gaps = json.loads(intelligence.gap_json)
    except:
        gaps = []
    
    try:
        bias_flags = json.loads(intelligence.bias_json)
    except:
        bias_flags = []
    
    # Calculate gap severity score (if not in DB yet)
    # This is a temporary calculation for backwards compatibility
    gap_severity_score = 0
    if gaps:
        missing_count = sum(1 for g in gaps if g.get("gapType") == "missing")
        partial_count = sum(1 for g in gaps if g.get("gapType") == "partial")
        weak_count = sum(1 for g in gaps if g.get("gapType") == "weak")
        stale_count = sum(1 for g in gaps if g.get("gapType") == "stale")
        
        gap_weight = (
            missing_count * 0.3 +
            partial_count * 0.2 +
            weak_count * 0.1 +
            stale_count * 0.05
        )
        if gap_weight > 0:
            gap_severity_score = min(100, int(100 * gap_weight / (1 + gap_weight)))
    
    # Explanation factors - parse from intelligence if available
    explanation_factors = []
    rules_total = 0
    rules_passed = 0
    rules_failed_count = 0
    failed_rules = []
    # Phase 7.14: Field validation
    field_checks_total = 0
    field_checks_passed = 0
    field_issues = []
    confidence_rationale = ""
    
    # Try to extract from executive_summary_json or compute
    try:
        if intelligence.executive_summary_json:
            exec_summary_data = json.loads(intelligence.executive_summary_json)
            explanation_obj = exec_summary_data.get("explanation_factors", {})
            if isinstance(explanation_obj, dict):
                rules_total = explanation_obj.get("total_rules", 0)
                rules_passed = explanation_obj.get("passed_rules", 0)
                rules_failed_count = explanation_obj.get("failed_rules", 0)
                rule_summary = explanation_obj.get("rule_summary", {})
                failed_rules = rule_summary.get("failed_rules", [])
                # Phase 7.14: Field validation
                field_checks_total = explanation_obj.get("field_checks_total", 0)
                field_checks_passed = explanation_obj.get("field_checks_passed", 0)
                field_issues = explanation_obj.get("field_issues", [])
                confidence_rationale = explanation_obj.get("confidence_rationale", "")
    except:
        pass
    
    # Phase 7.4: Compute freshness
    stale_after_minutes = 30  # Default
    is_stale = compute_is_stale(intelligence.computed_at, stale_after_minutes)
    
    return DecisionIntelligenceResponse(
        case_id=intelligence.case_id,
        computed_at=intelligence.computed_at,
        updated_at=intelligence.updated_at,
        completeness_score=intelligence.completeness_score,
        gaps=gaps,
        gap_severity_score=gap_severity_score,
        bias_flags=bias_flags,
        confidence_score=intelligence.confidence_score,
        confidence_band=intelligence.confidence_band,
        narrative=intelligence.narrative_template,
        narrative_genai=intelligence.narrative_genai,
        explanation_factors=explanation_factors,
        is_stale=is_stale,
        stale_after_minutes=stale_after_minutes,
        # Phase 7.8: Rule-based confidence details
        rules_total=rules_total,
        rules_passed=rules_passed,
        rules_failed_count=rules_failed_count,
        failed_rules=failed_rules,
        # Phase 7.14: Field validation details
        field_checks_total=field_checks_total,
        field_checks_passed=field_checks_passed,
        field_issues=field_issues,
        confidence_rationale=confidence_rationale,
    )


@router.get(
    "/workflow/cases/{case_id}/executive-summary",
    summary="Get Executive Summary (Phase 7.6)",
    description="Retrieve cached executive decision summary with deterministic narrative.",
)
def get_executive_summary_endpoint(
    case_id: str,
    request: Request,
    decision_type: str = Query(default="default", description="Decision type")
):
    """
    Get executive summary for a case.
    
    Returns cached ExecutiveSummary with:
    - headline: One-line summary
    - what_we_know: Max 3 positive facts
    - what_we_dont_know: Max 3 gaps/unknowns
    - risks: Max 3 risk statements
    - recommended_next_actions: Max 3 specific actions
    - confidence: score + band
    - badges: Visual indicators
    
    The summary is deterministically generated and cached in decision_intelligence table.
    If not cached, it will be generated on-the-fly.
    """
    from .narrative import build_executive_summary, ExecutiveSummary
    from src.core.db import execute_sql
    
    # Get intelligence
    intelligence = get_decision_intelligence(case_id)
    
    if not intelligence:
        # Compute intelligence first if missing
        logger.info(f"Intelligence not found for case {case_id}, computing...")
        try:
            case = get_case(case_id)
            if case and hasattr(case, 'decision_type'):
                decision_type = case.decision_type
        except:
            pass
        
        intelligence = compute_and_upsert_decision_intelligence(case_id, decision_type)
    
    # Check if executive_summary_json is cached
    if intelligence.executive_summary_json:
        try:
            exec_summary_dict = json.loads(intelligence.executive_summary_json)
            return ExecutiveSummary(**exec_summary_dict)
        except Exception as e:
            logger.warning(f"Failed to parse cached executive summary: {e}")
    
    # Generate on-the-fly if not cached
    logger.info(f"Generating executive summary for case {case_id}")
    
    # Build intelligence dict
    gaps = json.loads(intelligence.gap_json)
    bias_flags = json.loads(intelligence.bias_json)
    
    # Calculate gap severity
    gap_severity_score = 0
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
        gap_severity_score = sum(gap_severities) / len(gap_severities)
    
    # Build explanation factors
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
    
    intel_dict = {
        "case_id": intelligence.case_id,
        "computed_at": intelligence.computed_at,
        "updated_at": intelligence.updated_at,
        "completeness_score": intelligence.completeness_score,
        "gap_json": intelligence.gap_json,
        "bias_json": intelligence.bias_json,
        "confidence_score": intelligence.confidence_score,
        "confidence_band": intelligence.confidence_band,
        "explanation_factors_json": json.dumps(explanation_factors),
        "gap_severity_score": gap_severity_score,
    }
    
    # Fetch case details
    case_rows = execute_sql(
        "SELECT id, status, created_at, assigned_to, decision_type, title, summary FROM cases WHERE id = :case_id",
        {"case_id": case_id}
    )
    
    if not case_rows:
        raise HTTPException(status_code=404, detail=f"Case {case_id} not found")
    
    case_row = case_rows[0]
    case_dict = {
        "id": case_row[0],
        "status": case_row[1] or "new",
        "createdAt": case_row[2],
        "assignedTo": case_row[3],
        "decision_type": case_row[4] or decision_type,
        "title": case_row[5] or "",
        "summary": case_row[6] or "",
    }
    
    # Build executive summary
    exec_summary = build_executive_summary(
        intel=intel_dict,
        case=case_dict,
        decision_type=decision_type
    )
    
    # Cache it for next time
    try:
        from .repository import update_executive_summary
        exec_summary_json = json.dumps(exec_summary.model_dump())
        update_executive_summary(case_id, exec_summary_json)
    except Exception as e:
        logger.warning(f"Failed to cache executive summary: {e}")
    
    return exec_summary


@router.post(
    "/workflow/cases/{case_id}/intelligence/recompute",
    response_model=DecisionIntelligenceResponse,
    summary="Recompute Decision Intelligence (v2)",
    description="Recompute decision intelligence for a case with gap/bias detection (admin/devsupport only).",
)
def recompute_intelligence_endpoint(
    case_id: str,
    request: Request,
    decision_type: str = Query(default="default", description="Decision type for gap expectations"),
    body: Optional[ComputeIntelligenceRequest] = None,
):
    """
    Recompute decision intelligence v2 for a case.
    
    This endpoint is restricted to admin and devsupport roles.
    It recomputes all intelligence metrics with gap/bias detection and emits a case event.
    
    Local dev support:
    - Header: x-user-role=admin or x-role=devsupport
    - Query param: ?admin_unlocked=1
    """
    # Get actor context (role + admin unlock)
    ctx = get_actor_context(request)
    
    # Check authorization: admin/devsupport role OR admin_unlocked
    if ctx["role"] not in ["admin", "devsupport"] and not ctx["admin_unlocked"]:
        raise HTTPException(
            status_code=403,
            detail="Only admin and devsupport can recompute intelligence",
        )
    
    # Try to get decision_type from case
    try:
        case = get_case(case_id)
        if case and hasattr(case, 'decision_type'):
            decision_type = case.decision_type
            logger.info(f"Using decision_type from case: {decision_type}")
    except Exception as e:
        logger.warning(f"Could not get decision_type from case: {e}")
    
    # Generate signals from case artifacts
    logger.info(f"Generating signals for case {case_id}")
    signals = generate_signals_for_case(case_id)
    
    # Upsert signals (convert SignalCreate models to dicts)
    if signals:
        logger.info(f"Upserting {len(signals)} signals for case {case_id}")
        signal_dicts = [s.model_dump() for s in signals]
        upsert_signals(case_id, signal_dicts)
    else:
        logger.warning(f"No signals generated for case {case_id}")
    
    # Recompute intelligence from signals (v2 with gap/bias detection)
    logger.info(f"Recomputing intelligence v2 for case {case_id} by {ctx['role']} (admin_unlocked={ctx['admin_unlocked']}) with decision_type={decision_type}")
    intelligence = compute_and_upsert_decision_intelligence(case_id, decision_type)
    
    # Parse JSON fields for v2 response
    try:
        gaps = json.loads(intelligence.gap_json)
    except:
        gaps = []
    
    try:
        bias_flags = json.loads(intelligence.bias_json)
    except:
        bias_flags = []
    
    # Calculate gap severity score
    gap_severity_score = 0
    if gaps:
        missing_count = sum(1 for g in gaps if g.get("gapType") == "missing")
        partial_count = sum(1 for g in gaps if g.get("gapType") == "partial")
        weak_count = sum(1 for g in gaps if g.get("gapType") == "weak")
        stale_count = sum(1 for g in gaps if g.get("gapType") == "stale")
        
        gap_weight = (
            missing_count * 0.3 +
            partial_count * 0.2 +
            weak_count * 0.1 +
            stale_count * 0.05
        )
        if gap_weight > 0:
            gap_severity_score = min(100, int(100 * gap_weight / (1 + gap_weight)))
    
    # Explanation factors - extract from intelligence
    explanation_factors = []
    rules_total = 0
    rules_passed = 0
    rules_failed_count = 0
    failed_rules = []
    # Phase 7.14: Field validation
    field_checks_total = 0
    field_checks_passed = 0
    field_issues = []
    confidence_rationale = ""
    
    # Try to extract from executive_summary_json
    try:
        if intelligence.executive_summary_json:
            exec_summary_data = json.loads(intelligence.executive_summary_json)
            explanation_obj = exec_summary_data.get("explanation_factors", {})
            if isinstance(explanation_obj, dict):
                rules_total = explanation_obj.get("total_rules", 0)
                rules_passed = explanation_obj.get("passed_rules", 0)
                rules_failed_count = explanation_obj.get("failed_rules", 0)
                rule_summary = explanation_obj.get("rule_summary", {})
                failed_rules = rule_summary.get("failed_rules", [])
                # Phase 7.14: Field validation
                field_checks_total = explanation_obj.get("field_checks_total", 0)
                field_checks_passed = explanation_obj.get("field_checks_passed", 0)
                field_issues = explanation_obj.get("field_issues", [])
                confidence_rationale = explanation_obj.get("confidence_rationale", "")
    except:
        pass
    
    # Emit case event
    try:
        create_case_event(
            case_id=case_id,
            event_type="decision_intelligence_updated",
            actor_role=ctx["role"],
            actor_id=request.state.user_email if hasattr(request.state, "user_email") else None,
            message=f"Decision intelligence v2 recomputed: {intelligence.confidence_band} confidence ({intelligence.confidence_score}%), passed {rules_passed}/{rules_total} rules",
            payload_dict={
                "computed_at": intelligence.computed_at,
                "completeness_score": intelligence.completeness_score,
                "confidence_score": intelligence.confidence_score,
                "confidence_band": intelligence.confidence_band,
                "gap_count": len(gaps),
                "gap_severity_score": gap_severity_score,
                "bias_count": len(bias_flags),
                "decision_type": decision_type,
                "rules_total": rules_total,
                "rules_passed": rules_passed,
                "rules_failed": rules_failed_count,
                "trigger": "manual",  # Phase 7.17: Explicit trigger
            },
        )
    except Exception as e:
        logger.warning(f"Failed to emit case event: {e}")
    
    # Phase 7.4: Compute freshness
    stale_after_minutes = 30
    is_stale = compute_is_stale(intelligence.computed_at, stale_after_minutes)
    
    return DecisionIntelligenceResponse(
        case_id=intelligence.case_id,
        computed_at=intelligence.computed_at,
        updated_at=intelligence.updated_at,
        completeness_score=intelligence.completeness_score,
        gaps=gaps,
        gap_severity_score=gap_severity_score,
        bias_flags=bias_flags,
        confidence_score=intelligence.confidence_score,
        confidence_band=intelligence.confidence_band,
        narrative=intelligence.narrative_template,
        narrative_genai=intelligence.narrative_genai,
        explanation_factors=explanation_factors,
        is_stale=is_stale,
        stale_after_minutes=stale_after_minutes,
        # Phase 7.8: Rule-based confidence details
        rules_total=rules_total,
        rules_passed=rules_passed,
        rules_failed_count=rules_failed_count,
        failed_rules=failed_rules,
        # Phase 7.14: Field validation details
        field_checks_total=field_checks_total,
        field_checks_passed=field_checks_passed,
        field_issues=field_issues,
        confidence_rationale=confidence_rationale,
    )


# ============================================================================
# Intelligence History Endpoints (Phase 7.11)
# ============================================================================

@router.get("/workflow/cases/{case_id}/intelligence/diff")
def get_case_intelligence_diff(case_id: str):
    """
    Compute diff between latest and previous intelligence.
    
    Shows what changed in the most recent intelligence recomputation:
    - Confidence delta (score and band changes)
    - Rules delta (newly passed/failed)
    - Gaps delta (added/removed)
    - Bias flags delta (added/removed)
    - Top changes (most impactful)
    
    Args:
        case_id: The case UUID
        
    Returns:
        Diff object with deltas and top changes, or null if < 2 history entries
        
    Example Response:
        {
            "confidence_delta": +10,
            "confidence_band_from": "medium",
            "confidence_band_to": "high",
            "rules_passed_delta": +2,
            "rules_total_delta": 0,
            "gaps_delta": -1,
            "bias_flags_delta": 0,
            "top_changed_gaps": [
                {"action": "removed", "gap_type": "license_number", "severity": "critical"}
            ],
            "top_changed_rules": [
                {"action": "newly_passed", "rule_id": "csf_valid_dea_format"}
            ]
        }
    """
    from app.intelligence.repository import get_intelligence_history
    
    # Verify case exists
    case = get_case(case_id)
    if not case:
        raise HTTPException(status_code=404, detail=f"Case {case_id} not found")
    
    # Get latest 2 history entries
    history = get_intelligence_history(case_id, limit=2)
    
    if len(history) < 2:
        return None  # Not enough history to compute diff
    
    latest = history[0]["payload"]
    previous = history[1]["payload"]
    
    # Compute deltas
    confidence_delta = latest.get("confidence_score", 0) - previous.get("confidence_score", 0)
    rules_passed_delta = latest.get("rules_passed", 0) - previous.get("rules_passed", 0)
    rules_total_delta = latest.get("rules_total", 0) - previous.get("rules_total", 0)
    
    # Parse JSON fields
    latest_gaps = json.loads(latest.get("gap_json", "[]"))
    previous_gaps = json.loads(previous.get("gap_json", "[]"))
    latest_bias = json.loads(latest.get("bias_json", "[]"))
    previous_bias = json.loads(previous.get("bias_json", "[]"))
    
    gaps_delta = len(latest_gaps) - len(previous_gaps)
    bias_flags_delta = len(latest_bias) - len(previous_bias)
    
    # Compute top changed gaps (added/removed)
    previous_gap_keys = {f"{g['signal_type']}:{g['gap_type']}" for g in previous_gaps}
    latest_gap_keys = {f"{g['signal_type']}:{g['gap_type']}" for g in latest_gaps}
    
    added_gap_keys = latest_gap_keys - previous_gap_keys
    removed_gap_keys = previous_gap_keys - latest_gap_keys
    
    top_changed_gaps = []
    for gap in latest_gaps:
        key = f"{gap['signal_type']}:{gap['gap_type']}"
        if key in added_gap_keys:
            top_changed_gaps.append({
                "action": "added",
                "signal_type": gap["signal_type"],
                "gap_type": gap["gap_type"],
                "severity": gap.get("severity", "unknown"),
            })
    for gap in previous_gaps:
        key = f"{gap['signal_type']}:{gap['gap_type']}"
        if key in removed_gap_keys:
            top_changed_gaps.append({
                "action": "removed",
                "signal_type": gap["signal_type"],
                "gap_type": gap["gap_type"],
                "severity": gap.get("severity", "unknown"),
            })
    
    # Compute top changed rules (newly passed/failed)
    latest_failed_rules = latest.get("failed_rules", [])
    previous_failed_rules = previous.get("failed_rules", [])
    
    latest_failed_ids = {r.get("rule_id") for r in latest_failed_rules if isinstance(r, dict)}
    previous_failed_ids = {r.get("rule_id") for r in previous_failed_rules if isinstance(r, dict)}
    
    newly_failed = latest_failed_ids - previous_failed_ids
    newly_passed = previous_failed_ids - latest_failed_ids
    
    top_changed_rules = []
    for rule_id in newly_passed:
        top_changed_rules.append({"action": "newly_passed", "rule_id": rule_id})
    for rule_id in newly_failed:
        # Find rule details
        rule_detail = next((r for r in latest_failed_rules if r.get("rule_id") == rule_id), None)
        top_changed_rules.append({
            "action": "newly_failed",
            "rule_id": rule_id,
            "severity": rule_detail.get("severity") if rule_detail else "unknown",
        })
    
    return {
        "confidence_delta": confidence_delta,
        "confidence_band_from": previous.get("confidence_band", "unknown"),
        "confidence_band_to": latest.get("confidence_band", "unknown"),
        "rules_passed_delta": rules_passed_delta,
        "rules_total_delta": rules_total_delta,
        "gaps_delta": gaps_delta,
        "bias_flags_delta": bias_flags_delta,
        "top_changed_gaps": top_changed_gaps[:5],  # Limit to top 5
        "top_changed_rules": top_changed_rules[:5],  # Limit to top 5
    }


# ============================================================================
# Phase 7.17: Intelligence History Endpoint
# ============================================================================

@router.get(
    "/workflow/cases/{case_id}/intelligence/history",
    response_model=List[IntelligenceHistoryEntry],
    summary="Get Intelligence Computation History",
    description="Returns historical snapshots of intelligence computations for a case.",
)
def get_intelligence_history_endpoint(
    case_id: str,
    limit: int = Query(default=50, ge=1, le=200, description="Maximum number of history entries to return"),
):
    """
    Get intelligence computation history for a case (Phase 7.17).
    
    Returns a timeline of confidence changes with triggers that caused recomputation.
    Extracted from case_events with event_type='decision_intelligence_updated'.
    
    Args:
        case_id: Case UUID
        limit: Maximum number of entries (default 50, max 200)
        
    Returns:
        List of intelligence history entries, sorted by computed_at descending (newest first)
        
    Example:
        GET /workflow/cases/abc-123/intelligence/history?limit=10
        
    Response:
        [
            {
                "computed_at": "2026-01-18T15:30:00Z",
                "confidence_score": 85.0,
                "confidence_band": "high",
                "rules_passed": 9,
                "rules_total": 10,
                "gap_count": 1,
                "bias_count": 0,
                "trigger": "manual",
                "actor_role": "admin"
            },
            ...
        ]
    """
    # Verify case exists
    case = get_case(case_id)
    if not case:
        raise HTTPException(status_code=404, detail=f"Case not found: {case_id}")
    
    # Get all decision_intelligence_updated events
    all_events = list_case_events(case_id, limit=limit * 2)  # Get more to filter
    
    # Filter to intelligence update events and parse history
    history_entries = []
    for event in all_events:
        if event.event_type != "decision_intelligence_updated":
            continue
        
        # Parse payload
        try:
            payload = json.loads(event.payload_json) if event.payload_json else {}
        except:
            payload = {}
        
        # Extract fields with defaults
        history_entries.append(IntelligenceHistoryEntry(
            computed_at=payload.get("computed_at") or event.created_at,
            confidence_score=payload.get("confidence_score", 0),
            confidence_band=payload.get("confidence_band", "unknown"),
            rules_passed=payload.get("rules_passed", 0),
            rules_total=payload.get("rules_total", 0),
            gap_count=payload.get("gap_count", 0),
            bias_count=payload.get("bias_count", 0),
            trigger=payload.get("trigger", "unknown"),
            actor_role=event.actor_role or "system",
        ))
        
        # Stop if we've reached the limit
        if len(history_entries) >= limit:
            break
    
    return history_entries

