"""
Intelligence Lifecycle - Auto-recompute triggers and debouncing (Phase 7.4).

Manages automatic Decision Intelligence recomputation when case state changes.

Features:
- Auto-trigger recompute on meaningful case events
- Debouncing to prevent recompute storms
- Feature flag control
- Case event emission for audit trail

Trigger events:
- submission_created
- submission_updated
- evidence_attached
- request_info_created
- request_info_resubmitted
- status_changed
"""

import time
import logging
from typing import Dict, Optional
from datetime import datetime

from src.core.db import execute_sql, execute_insert
from src.config import get_settings
from ..intelligence.repository import compute_and_upsert_decision_intelligence
from ..intelligence.generator import generate_signals_for_case

logger = logging.getLogger(__name__)

# ============================================================================
# Configuration
# ============================================================================

# Debounce configuration
MIN_RECOMPUTE_INTERVAL_SECONDS = 2  # Minimum time between recomputes for same case

# In-memory debounce store
# Format: {case_id: last_recompute_timestamp}
_recompute_timestamps: Dict[str, float] = {}

# ============================================================================
# Auto-Recompute Logic
# ============================================================================

# Event types that trigger auto-recompute
TRIGGERING_EVENT_TYPES = {
    "submission_created",
    "submission_updated",
    "evidence_attached",
    "request_info_created",
    "request_info_resubmitted",
    "status_changed",
}


def should_auto_recompute(event_type: str) -> bool:
    """
    Determine if an event type should trigger auto-recompute.
    
    Args:
        event_type: The event type string
        
    Returns:
        True if event should trigger recompute, False otherwise
    """
    return event_type in TRIGGERING_EVENT_TYPES


def _is_debounced(case_id: str) -> bool:
    """
    Check if case is within debounce window.
    
    Args:
        case_id: The case ID
        
    Returns:
        True if debounced (should skip), False if can proceed
    """
    if case_id not in _recompute_timestamps:
        return False
    
    last_recompute = _recompute_timestamps[case_id]
    elapsed = time.time() - last_recompute
    
    return elapsed < MIN_RECOMPUTE_INTERVAL_SECONDS


def _update_debounce_timestamp(case_id: str) -> None:
    """
    Update debounce timestamp for case.
    
    Args:
        case_id: The case ID
    """
    _recompute_timestamps[case_id] = time.time()


def request_recompute(
    case_id: str,
    reason: str,
    event_type: str,
    decision_type: Optional[str] = None
) -> bool:
    """
    Request intelligence recompute for a case with debouncing.
    
    This is the main entry point for triggering auto-recompute.
    
    Args:
        case_id: The case ID
        reason: Human-readable reason for recompute
        event_type: Event type that triggered recompute
        decision_type: Optional decision type (will be fetched from case if not provided)
        
    Returns:
        True if recompute was performed, False if skipped (debounced or disabled)
    """
    # Check feature flag
    settings = get_settings()
    if not settings.AUTO_INTELLIGENCE_ENABLED:
        logger.debug(f"[Lifecycle] Auto-intelligence disabled, skipping recompute for {case_id}")
        return False
    
    # Check if event type should trigger recompute
    if not should_auto_recompute(event_type):
        logger.debug(f"[Lifecycle] Event type '{event_type}' does not trigger recompute for {case_id}")
        return False
    
    # Check debounce
    if _is_debounced(case_id):
        logger.debug(f"[Lifecycle] Debounced: Skipping recompute for {case_id} (last recompute too recent)")
        return False
    
    # Update debounce timestamp
    _update_debounce_timestamp(case_id)
    
    logger.info(f"[Lifecycle] Triggering recompute for {case_id}: {reason} ({event_type})")
    
    try:
        # Get decision type from case if not provided
        if not decision_type:
            decision_type = _get_case_decision_type(case_id)
        
        # Step 1: Generate signals
        logger.debug(f"[Lifecycle] Generating signals for {case_id}")
        generate_signals_for_case(case_id, decision_type)
        
        # Step 2: Compute intelligence v2
        logger.debug(f"[Lifecycle] Computing intelligence v2 for {case_id}")
        intelligence = compute_and_upsert_decision_intelligence(case_id, decision_type)
        
        # Step 3: Emit case event
        _emit_intelligence_updated_event(
            case_id=case_id,
            reason=reason,
            event_type=event_type,
            intelligence=intelligence
        )
        
        logger.info(f"[Lifecycle] Successfully recomputed intelligence for {case_id}")
        return True
        
    except Exception as e:
        logger.error(f"[Lifecycle] Failed to recompute intelligence for {case_id}: {e}", exc_info=True)
        return False


def _get_case_decision_type(case_id: str) -> str:
    """
    Get decision type for a case.
    
    Args:
        case_id: The case ID
        
    Returns:
        Decision type string (defaults to 'csf' if not found)
    """
    result = execute_sql(
        "SELECT decision_type FROM cases WHERE id = ?",
        (case_id,)
    )
    
    if result and len(result) > 0:
        return result[0][0] or 'csf'
    
    return 'csf'


def _emit_intelligence_updated_event(
    case_id: str,
    reason: str,
    event_type: str,
    intelligence: Dict
) -> None:
    """
    Emit case event for intelligence update.
    
    Args:
        case_id: The case ID
        reason: Reason for recompute
        event_type: Event type that triggered recompute
        intelligence: Intelligence computation result
    """
    from app.workflow.repo import create_case_event
    
    # Extract key metrics from intelligence
    confidence_score = intelligence.get('confidence_score', 0)
    confidence_band = intelligence.get('confidence_band', 'low')
    gap_severity_score = intelligence.get('gap_severity_score', 0)
    bias_flags = intelligence.get('bias_flags', [])
    computed_at = intelligence.get('computed_at', datetime.utcnow().isoformat() + 'Z')
    
    payload = {
        "reason": reason,
        "event_type": event_type,
        "confidence_score": confidence_score,
        "confidence_band": confidence_band,
        "gap_severity_score": gap_severity_score,
        "bias_count": len(bias_flags),
        "computed_at": computed_at,
    }
    
    try:
        create_case_event(
            case_id=case_id,
            event_type="decision_intelligence_updated",
            actor_role="system",
            actor_id=None,
            message=f"Decision intelligence auto-recomputed: {reason}",
            payload_dict=payload
        )
        logger.debug(f"[Lifecycle] Emitted intelligence_updated event for {case_id}")
    except Exception as e:
        # Don't fail recompute if event emission fails
        logger.warning(f"[Lifecycle] Failed to emit intelligence_updated event for {case_id}: {e}")


# ============================================================================
# Utility Functions
# ============================================================================

def clear_debounce_cache() -> None:
    """
    Clear debounce timestamp cache.
    
    Useful for testing or manual intervention.
    """
    global _recompute_timestamps
    _recompute_timestamps = {}
    logger.info("[Lifecycle] Cleared debounce cache")


def get_debounce_status(case_id: str) -> Dict[str, any]:
    """
    Get debounce status for a case (for debugging).
    
    Args:
        case_id: The case ID
        
    Returns:
        Dictionary with debounce info
    """
    if case_id not in _recompute_timestamps:
        return {
            "debounced": False,
            "last_recompute_at": None,
            "elapsed_seconds": None,
        }
    
    last_recompute = _recompute_timestamps[case_id]
    elapsed = time.time() - last_recompute
    
    return {
        "debounced": elapsed < MIN_RECOMPUTE_INTERVAL_SECONDS,
        "last_recompute_at": last_recompute,
        "elapsed_seconds": elapsed,
        "min_interval_seconds": MIN_RECOMPUTE_INTERVAL_SECONDS,
    }
