from __future__ import annotations

from datetime import date
from typing import Optional, Sequence

from src.api.models.decision import DecisionOutcome, DecisionStatus, RegulatoryReference
from src.autocomply.domain.decision_risk import compute_risk_for_status


def build_ny_pharmacy_decision(
    *,
    is_expired: bool,
    is_ny_ship_to: bool,
    base_reason: str,
    trace_id: Optional[str] = None,
    regulatory_references: Optional[Sequence[RegulatoryReference]] = None,
    debug_info: Optional[dict] = None,
) -> DecisionOutcome:
    """Canonical NY pharmacy decision builder.

    - Active + NY ship-to -> ok_to_ship, low risk
    - Expired license -> blocked, high risk
    - Non-NY ship-to (but not expired) -> needs_review, medium risk
    """
    if is_expired:
        status = DecisionStatus.BLOCKED
        risk_level = "high"
        reason = (
            f"{base_reason} NY pharmacy license appears expired; "
            "block order until license is renewed."
        )
    elif not is_ny_ship_to:
        status = DecisionStatus.NEEDS_REVIEW
        risk_level = "medium"
        reason = (
            f"{base_reason} Ship-to state is outside New York; "
            "compliance review is required."
        )
    else:
        status = DecisionStatus.OK_TO_SHIP
        risk_level = "low"
        reason = (
            f"{base_reason} NY pharmacy license appears active for this ship-to."
        )

    _, risk_score = compute_risk_for_status(status.value)

    return DecisionOutcome(
        status=status,
        reason=reason,
        risk_level=risk_level,
        risk_score=risk_score,
        regulatory_references=list(regulatory_references or []),
        trace_id=trace_id,
        debug_info=debug_info,
    )


def is_license_expired(expiration_date: Optional[date]) -> bool:
    """Utility to determine if a license is expired based on expiration date."""
    return bool(expiration_date and expiration_date < date.today())
