from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, Field

from autocomply.domain.controlled_substances import ControlledSubstanceItem


class PractitionerFacilityType(str, Enum):
    INDIVIDUAL = "individual_practitioner"
    GROUP_PRACTICE = "group_practice"
    CLINIC = "clinic"
    DENTAL_PRACTICE = "dental_practice"
    OTHER = "other"


class CsDecisionStatus(str, Enum):
    OK_TO_SHIP = "ok_to_ship"
    BLOCKED = "blocked"
    MANUAL_REVIEW = "manual_review"


class PractitionerCsfForm(BaseModel):
    """
    Normalized representation of the Practitioner Controlled Substance Form
    (online CSF – Practitioner).

    This is intentionally generic; we can refine field names as we line up
    against the exact PDF sections.
    """

    # Basic account / facility identity
    facility_name: str = Field(..., min_length=1)
    facility_type: PractitionerFacilityType
    account_number: Optional[str] = None

    # Practitioner identity / licensing
    practitioner_name: str = Field(..., min_length=1)
    state_license_number: str = Field(..., min_length=1)
    dea_number: str = Field(..., min_length=1)

    # Shipping / jurisdiction context (for state addendums later)
    ship_to_state: str = Field(..., min_length=2, max_length=2)  # e.g. "OH", "FL"

    # Attestation checkbox – “I confirm info is true and I will comply…”
    attestation_accepted: bool = Field(
        default=False,
        description="True if the practitioner checked/accepted the attestation clause.",
    )

    # Controlled substance items attached to this CSF
    controlled_substances: List[ControlledSubstanceItem] = Field(
        default_factory=list,
        description=(
            "Controlled substance items associated with this CSF. "
            "Populated from the Controlled Substances search UI."
        ),
    )

    # Free-text notes if needed (internal use)
    internal_notes: Optional[str] = None


class PractitionerCsfDecision(BaseModel):
    """
    Output of the practitioner CSF decision logic.
    """

    status: CsDecisionStatus
    reason: str
    missing_fields: List[str] = Field(default_factory=list)


def evaluate_practitioner_csf(form: PractitionerCsfForm) -> PractitionerCsfDecision:
    """
    First-pass decision logic for Practitioner CSF.

    Conservative approach:
    - Require practitioner_name, facility_name, state_license_number, dea_number, ship_to_state.
    - Require attestation_accepted to allow shipping.
    - Return BLOCKED when core fields are missing or attestation not accepted.
    - Use MANUAL_REVIEW only for edge cases we don't confidently automate yet.
    """
    missing: List[str] = []

    # Required identity/licensing fields
    if not form.facility_name.strip():
        missing.append("facility_name")
    if not form.practitioner_name.strip():
        missing.append("practitioner_name")
    if not form.state_license_number.strip():
        missing.append("state_license_number")
    if not form.dea_number.strip():
        missing.append("dea_number")
    if not form.ship_to_state.strip():
        missing.append("ship_to_state")

    # If anything essential missing → blocked
    if missing:
        return PractitionerCsfDecision(
            status=CsDecisionStatus.BLOCKED,
            reason=(
                "Practitioner CSF is missing required identity/licensing fields: "
                + ", ".join(missing)
            ),
            missing_fields=missing,
        )

    # Attestation must be accepted
    if not form.attestation_accepted:
        return PractitionerCsfDecision(
            status=CsDecisionStatus.BLOCKED,
            reason=(
                "Practitioner has not accepted the controlled substances attestation. "
                "The attestation clause must be acknowledged before controlled substances "
                "can be shipped."
            ),
            missing_fields=["attestation_accepted"],
        )

    # Everything minimal is present
    return PractitionerCsfDecision(
        status=CsDecisionStatus.OK_TO_SHIP,
        reason=(
            "All required practitioner, facility, and licensing details are present and "
            "the attestation has been accepted. Practitioner CSF is approved to proceed."
        ),
        missing_fields=[],
    )


def describe_practitioner_csf_decision(
    form: PractitionerCsfForm, decision: PractitionerCsfDecision
) -> str:
    """
    Deterministic explanation for the Practitioner CSF decision.
    Codex can use this as a base, or you can expose it via API/logs.
    """

    lines: List[str] = []

    # 1. Decision summary
    if decision.status == CsDecisionStatus.OK_TO_SHIP:
        lines.append("Decision: Order is allowed to proceed (ok_to_ship).")
    elif decision.status == CsDecisionStatus.BLOCKED:
        lines.append(
            "Decision: Order is blocked until required information is provided."
        )
    else:
        lines.append(
            "Decision: Order requires manual review by a compliance specialist."
        )

    # 2. Facility + context
    lines.append(
        f"Facility: {form.facility_name or '[missing]'} "
        f"({form.facility_type.value}), ship-to state: {form.ship_to_state or '[missing]'}."
    )

    # 3. Practitioner + licensing
    lines.append(
        "Practitioner and licensing details: "
        f"name={form.practitioner_name or '[missing]'}, "
        f"state_license_number={form.state_license_number or '[missing]'}, "
        f"dea_number={form.dea_number or '[missing]'}."
    )

    # 4. Attestation
    if form.attestation_accepted:
        lines.append(
            "Attestation: Practitioner has accepted the controlled substances attestation clause."
        )
    else:
        lines.append(
            "Attestation: Practitioner has NOT accepted the controlled substances attestation clause."
        )

    # 5. Missing fields
    if decision.missing_fields:
        lines.append(
            "The engine identified the following missing or incomplete fields: "
            + ", ".join(decision.missing_fields)
            + "."
        )

    # 6. Attached controlled substances
    if form.controlled_substances:
        lines.append(
            f"Attached controlled substance items: {len(form.controlled_substances)} "
            "item(s) included with this CSF."
        )
        names = [item.name for item in form.controlled_substances[:3]]
        lines.append("Examples: " + ", ".join(names) + ".")
    else:
        lines.append("No controlled substance items were attached to this CSF.")

    return "\n".join(lines)
