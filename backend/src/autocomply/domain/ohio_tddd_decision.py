from __future__ import annotations

from typing import Dict, List, Optional

from src.api.models.decision import DecisionOutcome, DecisionStatus, RegulatoryReference
from src.autocomply.domain.decision_risk import compute_risk_for_status


def build_ohio_tddd_decision(
    *,
    is_expired: bool,
    is_ohio_ship_to: bool,
    base_reason: str,
    regulatory_references: Optional[List[RegulatoryReference]] = None,
    debug_info: Optional[Dict] = None,
    trace_id: Optional[str] = None,
) -> DecisionOutcome:
    """
    Canonical Ohio TDDD decision builder to keep risk + status aligned.

    The helper normalizes status / risk_level / risk_score for the three core
    scenarios: active license, expired license, and ship-to outside Ohio.
    """

    if is_expired:
        status = DecisionStatus.BLOCKED
        risk_level = "high"
        reason = (
            f"{base_reason} Ohio TDDD license appears expired; block order until license is renewed."
        )
    elif not is_ohio_ship_to:
        status = DecisionStatus.NEEDS_REVIEW
        risk_level = "medium"
        reason = (
            f"{base_reason} Ship-to state does not match Ohio; compliance review is required."
        )
    else:
        status = DecisionStatus.OK_TO_SHIP
        risk_level = "low"
        reason = f"{base_reason} Ohio TDDD license appears active for this ship-to state."

    computed_risk_level, risk_score = compute_risk_for_status(status.value)

    return DecisionOutcome(
        status=status,
        reason=reason,
        risk_level=risk_level or computed_risk_level,
        risk_score=risk_score,
        regulatory_references=regulatory_references or [],
        trace_id=trace_id,
        debug_info=debug_info,
    )
