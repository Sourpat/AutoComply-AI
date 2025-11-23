from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, Field

from autocomply.domain.controlled_substances import ControlledSubstanceItem


class PractitionerFacilityType(str, Enum):
    INDIVIDUAL_PRACTITIONER = "individual_practitioner"
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
    Normalized representation of the Practitioner Controlled Substance Form.
    """

    # Basic account / facility identity
    facility_name: str
    facility_type: PractitionerFacilityType
    account_number: Optional[str] = None

    # Practitioner identity / licensing
    practitioner_name: str
    state_license_number: str
    dea_number: str

    # Shipping / jurisdiction context (for state addendums later)
    ship_to_state: str

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
    regulatory_references: List[str] = Field(
        default_factory=list,
        description=(
            "IDs of compliance artifacts (e.g. csf_fl_addendum) that directly "
            "informed this decision."
        ),
    )


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
                "Practitioner CSF is missing required facility/practitioner/licensing "
                "fields: " + ", ".join(missing)
            ),
            missing_fields=missing,
        )

    # Attestation must be accepted
    if not form.attestation_accepted:
        return PractitionerCsfDecision(
            status=CsDecisionStatus.BLOCKED,
            reason=(
                "Practitioner has not accepted the controlled substances attestation. "
                "The attestation clause must be acknowledged before controlled "
                "substances can be shipped."
            ),
            missing_fields=["attestation_accepted"],
        )

    # --- NEW: item-aware rule layer ---
    # Treat DEA Schedule II items shipped to FL as higher risk → manual review.
    ship_state = (form.ship_to_state or "").upper()

    high_risk_items = [
        item
        for item in form.controlled_substances
        if (item.dea_schedule or "").upper() in {"II", "CII"}
    ]

    if high_risk_items and ship_state == "FL":
        example_names = ", ".join(item.name for item in high_risk_items[:3])
        return PractitionerCsfDecision(
            status=CsDecisionStatus.MANUAL_REVIEW,
            reason=(
                "CSF includes high-risk Schedule II controlled substances for "
                "ship-to state FL. Example item(s): "
                f"{example_names}. Requires manual compliance review per "
                "Florida Controlled Substances Addendum (csf_fl_addendum)."
            ),
            missing_fields=[],
            regulatory_references=["csf_fl_addendum"],
        )

    # Default happy-path: all fields present, attestation accepted,
    # and no item-level rules triggered.
    return PractitionerCsfDecision(
        status=CsDecisionStatus.OK_TO_SHIP,
        reason=(
            "All required facility, practitioner, licensing, jurisdiction, and "
            "attestation details are present. Practitioner CSF is approved to proceed."
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
