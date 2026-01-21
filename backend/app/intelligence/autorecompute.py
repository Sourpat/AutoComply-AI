"""
Intelligence Auto-Recompute Module (Phase 7.10)

Provides throttled auto-recompute functionality to update intelligence
when key case events occur (submission, evidence, request-info, decision).

Functions:
- maybe_recompute_case_intelligence: Throttled recompute with safety checks
"""

import logging
from datetime import datetime, timedelta, timezone
from typing import Dict, Optional
from threading import Lock

# Import existing recompute pipeline
from .service import recompute_case_intelligence

logger = logging.getLogger(__name__)

# ============================================================================
# In-Memory Throttle
# ============================================================================

# Throttle map: case_id -> last_recompute_timestamp
_throttle_map: Dict[str, datetime] = {}
_throttle_lock = Lock()


def _should_throttle(case_id: str, throttle_seconds: int) -> bool:
    """
    Check if case recompute should be throttled based on recent recompute.
    
    Args:
        case_id: Case identifier
        throttle_seconds: Minimum seconds between recomputes
        
    Returns:
        True if should throttle (skip recompute), False if should proceed
    """
    with _throttle_lock:
        last_recompute = _throttle_map.get(case_id)
        if not last_recompute:
            return False
        
        # Check if enough time has passed
        elapsed = (datetime.now(timezone.utc) - last_recompute).total_seconds()
        return elapsed < throttle_seconds


def _record_recompute(case_id: str) -> None:
    """Record successful recompute timestamp for throttling."""
    with _throttle_lock:
        _throttle_map[case_id] = datetime.now(timezone.utc)


# ============================================================================
# Auto-Recompute Function
# ============================================================================

def maybe_recompute_case_intelligence(
    case_id: str,
    reason: str,
    *,
    throttle_seconds: int = 30,
    actor: str = "system"
) -> bool:
    """
    Auto-recompute intelligence for a case with throttling and safety checks.
    
    This function is designed to be called from case workflows (evidence attachment,
    request-info updates, decision saves, etc.) without disrupting the main flow.
    
    Features:
    - Throttles recomputes to prevent excessive computation (default 30s)
    - Catches and logs exceptions without propagating to caller
    - Returns success/skip status for observability
    - Maps reasons to triggers for audit trail (Phase 7.17)
    
    Args:
        case_id: Case identifier
        reason: Reason for recompute (e.g., "submission_created", "evidence_attached")
        throttle_seconds: Minimum seconds between recomputes (default 30)
        actor: Actor triggering recompute (default "system")
        
    Returns:
        True if recompute executed, False if throttled or failed
        
    Example:
        >>> # Called after evidence attachment
        >>> maybe_recompute_case_intelligence(
        ...     case_id="abc-123",
        ...     reason="evidence_attached",
        ...     actor="verifier@example.com"
        ... )
        True
    """
    try:
        # Check throttle
        if _should_throttle(case_id, throttle_seconds):
            logger.info(
                f"[AutoRecompute] Throttled recompute for case {case_id} "
                f"(reason: {reason}, throttle: {throttle_seconds}s)"
            )
            return False
        
        # Map reason to trigger for audit trail (Phase 7.17)
        trigger = "unknown"
        if "submission" in reason.lower():
            trigger = "submission"
        elif "evidence" in reason.lower() or "attachment" in reason.lower():
            trigger = "evidence"
        elif "request" in reason.lower():
            trigger = "request_info"
        elif "decision" in reason.lower():
            trigger = "decision"
        
        # Execute recompute pipeline
        logger.info(
            f"[AutoRecompute] Recomputing intelligence for case {case_id} "
            f"(reason: {reason}, trigger: {trigger}, actor: {actor})"
        )
        
        # Call existing recompute logic from service.py
        # This will:
        # 1. Generate signals (submission, evidence, case events, RAG traces)
        # 2. Compute v2 intelligence (gaps, bias, confidence)
        # 3. Compute v1 rules-based confidence
        # 4. Emit decision_intelligence_updated event with trigger
        result = recompute_case_intelligence(
            case_id,
            actor=actor,
            reason=reason,
            trigger=trigger  # Phase 7.17: Pass trigger to event
        )
        
        if result:
            # Record successful recompute for throttling
            _record_recompute(case_id)
            logger.info(
                f"[AutoRecompute] Successfully recomputed intelligence for case {case_id} "
                f"(confidence: {result.get('confidence_score', 'N/A')})"
            )
            return True
        else:
            logger.warning(
                f"[AutoRecompute] Recompute returned no result for case {case_id} "
                f"(reason: {reason})"
            )
            return False
            
    except Exception as e:
        # Safety: Catch and log any exceptions without propagating
        # This ensures the main workflow (evidence attachment, etc.) doesn't fail
        logger.error(
            f"[AutoRecompute] Failed to recompute intelligence for case {case_id} "
            f"(reason: {reason}): {str(e)}",
            exc_info=True
        )
        return False


# ============================================================================
# Utility Functions
# ============================================================================

def clear_throttle_cache() -> None:
    """Clear the throttle map (useful for testing)."""
    with _throttle_lock:
        _throttle_map.clear()
        logger.debug("[AutoRecompute] Throttle cache cleared")


def get_throttle_status(case_id: str) -> Optional[dict]:
    """
    Get throttle status for a case (useful for debugging).
    
    Returns:
        Dict with last_recompute timestamp and seconds_since, or None if no record
    """
    with _throttle_lock:
        last_recompute = _throttle_map.get(case_id)
        if not last_recompute:
            return None
        
        elapsed = (datetime.now(timezone.utc) - last_recompute).total_seconds()
        return {
            "last_recompute": last_recompute.isoformat(),
            "seconds_since": elapsed
        }
