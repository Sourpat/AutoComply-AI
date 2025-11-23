from enum import Enum
from typing import List

from pydantic import BaseModel, Field


class OhioTdddDecisionStatus(str, Enum):
    APPROVED = "approved"
    OK_TO_SHIP = "ok_to_ship"
    BLOCKED = "blocked"
    MANUAL_REVIEW = "manual_review"


# Legacy alias kept for backward compatibility
DecisionStatus = OhioTdddDecisionStatus


class OhioTdddForm(BaseModel):
    """
    Parsed representation of an Ohio TDDD application.
    This is the *input* to our decision logic.
    """

    business_name: str = Field(...)
    license_type: str = Field(...)
    license_number: str = Field(...)
    ship_to_state: str = Field(...)


class OhioTdddDecision(BaseModel):
    """
    Output of the decision engine for a given Ohio TDDD form.
    """

    status: DecisionStatus
    reason: str
    missing_fields: List[str] = Field(default_factory=list)
    regulatory_references: List[str] = Field(
        default_factory=list,
        description=(
            "IDs of compliance artifacts (e.g. ohio_tddd_registration) that "
            "directly informed this decision."
        ),
    )


def evaluate_ohio_tddd(form: OhioTdddForm) -> OhioTdddDecision:
    missing: List[str] = []

    if not form.business_name.strip():
        missing.append("business_name")

    if not form.license_type.strip():
        missing.append("license_type")

    if not form.license_number.strip():
        missing.append("license_number")

    if not form.ship_to_state.strip():
        missing.append("ship_to_state")

    if missing:
        return OhioTdddDecision(
            status=OhioTdddDecisionStatus.BLOCKED,
            reason=(
                "Ohio TDDD application is missing required fields: "
                + ", ".join(missing)
            ),
            missing_fields=missing,
            regulatory_references=["ohio_tddd_registration"],
        )

    normalized_state = form.ship_to_state.strip().upper()
    if normalized_state and normalized_state != "OH":
        return OhioTdddDecision(
            status=OhioTdddDecisionStatus.MANUAL_REVIEW,
            reason=(
                "Ohio TDDD registration is specific to Ohio as the ship-to state. "
                f"Current request uses ship-to state '{form.ship_to_state}', which "
                "requires manual review for cross-state distribution."
            ),
            missing_fields=[],
            regulatory_references=["ohio_tddd_registration"],
        )

    return OhioTdddDecision(
        status=OhioTdddDecisionStatus.APPROVED,
        reason="Ohio TDDD application meets current in-state registration rules.",
        missing_fields=[],
        regulatory_references=["ohio_tddd_registration"],
    )
