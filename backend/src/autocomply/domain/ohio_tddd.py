from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, Field


class OhioTdddCustomerResponse(str, Enum):
    EXEMPT = "EXEMPT"
    LICENSED_OR_APPLYING = "LICENSED_OR_APPLYING"
    # You can refine these labels later when we have exact text


class DecisionStatus(str, Enum):
    OK_TO_SHIP = "ok_to_ship"
    BLOCKED = "blocked"
    MANUAL_REVIEW = "manual_review"


class OhioTdddForm(BaseModel):
    """
    Parsed representation of the Ohio TDDD attestation section.
    This is the *input* to our decision logic.
    """

    customer_response: OhioTdddCustomerResponse
    practitioner_name: str = Field(...)
    state_board_license_number: str = Field(...)

    # Optional depending on response
    tddd_license_number: Optional[str] = None
    dea_number: Optional[str] = None
    tddd_license_category: Optional[str] = None


class OhioTdddDecision(BaseModel):
    """
    Output of the decision engine for a given Ohio TDDD form.
    """

    status: DecisionStatus
    reason: str
    missing_fields: List[str] = Field(default_factory=list)


def evaluate_ohio_tddd_attestation(form: OhioTdddForm) -> OhioTdddDecision:
    """
    First-pass Ohio TDDD decision logic.

    NOTE: This is intentionally conservative. You can tune
    the conditions once you align with compliance / legal.
    """

    missing: List[str] = []

    # Always required
    if not form.practitioner_name.strip():
        missing.append("practitioner_name")

    if not form.state_board_license_number.strip():
        missing.append("state_board_license_number")

    # Path 1: Customer claims EXEMPT
    if form.customer_response == OhioTdddCustomerResponse.EXEMPT:
        # For now, treat as OK if basic identity is present.
        if missing:
            return OhioTdddDecision(
                status=DecisionStatus.MANUAL_REVIEW,
                reason=(
                    "Customer claims Ohio TDDD exemption but the following "
                    "identity fields are missing: " + ", ".join(missing)
                ),
                missing_fields=missing,
            )

        return OhioTdddDecision(
            status=DecisionStatus.OK_TO_SHIP,
            reason=(
                "Customer attests they are exempt from Ohio TDDD licensing "
                "and provided minimum practitioner details."
            ),
            missing_fields=[],
        )

    # Path 2: Customer is licensed or applying (subject to TDDD)
    if form.customer_response == OhioTdddCustomerResponse.LICENSED_OR_APPLYING:
        # Stronger requirements:
        if not form.tddd_license_number or not form.tddd_license_number.strip():
            missing.append("tddd_license_number")

        if not form.tddd_license_category or not form.tddd_license_category.strip():
            missing.append("tddd_license_category")

        # DEA may or may not be mandatory; keep it as soft for now.
        # If you want, promote this to mandatory later:
        # if not form.dea_number or not form.dea_number.strip():
        #     missing.append("dea_number")

        if missing:
            return OhioTdddDecision(
                status=DecisionStatus.BLOCKED,
                reason=(
                    "Customer indicates they are subject to Ohio TDDD licensing, "
                    "but the following fields are missing or incomplete: "
                    + ", ".join(missing)
                ),
                missing_fields=missing,
            )

        return OhioTdddDecision(
            status=DecisionStatus.OK_TO_SHIP,
            reason=(
                "Customer indicates Ohio TDDD licensing applies and provided "
                "TDDD license details."
            ),
            missing_fields=[],
        )

    # Fallback (should never happen if enum is used correctly)
    return OhioTdddDecision(
        status=DecisionStatus.MANUAL_REVIEW,
        reason="Unable to classify Ohio TDDD response; unexpected customer_response value.",
        missing_fields=missing,
    )
