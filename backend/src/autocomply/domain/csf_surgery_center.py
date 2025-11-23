from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, Field

from autocomply.domain.controlled_substances import ControlledSubstanceItem
from autocomply.domain.csf_practitioner import CsDecisionStatus


class SurgeryFacilityType(str, Enum):
    SURGERY_CENTER = "surgery_center"
    AMBULATORY_SURGERY_CENTER = "ambulatory_surgery_center"
    HOSPITAL_OUTPATIENT = "hospital_outpatient"
    CLINIC = "clinic"
    OTHER = "other"


class SurgeryCenterCsfForm(BaseModel):
    """
    Normalized representation of the Surgery Center Controlled Substance Form.

    This mirrors typical fields we expect in
    'Online Controlled Substance Form - Surgery Center form.pdf'.
    """

    # Facility identity
    facility_name: str = Field(...)
    facility_type: SurgeryFacilityType
    account_number: Optional[str] = None

    # Licensing
    facility_license_number: str = Field(
        ..., description="Surgery center / facility license"
    )
    dea_number: str = Field(...)

    # Responsible clinician / director
    medical_director_name: str = Field(...)

    # Jurisdiction
    ship_to_state: str = Field(..., max_length=2)

    # Attestation
    attestation_accepted: bool = Field(
        default=False,
        description="True if the facility accepted the CSF attestation clause.",
    )

    controlled_substances: List[ControlledSubstanceItem] = Field(
        default_factory=list,
        description=(
            "Controlled substance items associated with this Surgery Center CSF."
        ),
    )

    # Internal notes
    internal_notes: Optional[str] = None


class SurgeryCenterCsfDecision(BaseModel):
    status: CsDecisionStatus
    reason: str
    missing_fields: List[str] = Field(default_factory=list)


def evaluate_surgery_center_csf(form: SurgeryCenterCsfForm) -> SurgeryCenterCsfDecision:
    """
    First-pass decision logic for Surgery Center CSF.

    Conservative baseline:
    - Require facility_name, facility_license_number, dea_number,
      medical_director_name, ship_to_state.
    - Require attestation_accepted to allow shipping.
    """
    missing: List[str] = []

    if not form.facility_name.strip():
        missing.append("facility_name")
    if not form.facility_license_number.strip():
        missing.append("facility_license_number")
    if not form.dea_number.strip():
        missing.append("dea_number")
    if not form.medical_director_name.strip():
        missing.append("medical_director_name")
    if not form.ship_to_state.strip():
        missing.append("ship_to_state")

    if missing:
        return SurgeryCenterCsfDecision(
            status=CsDecisionStatus.BLOCKED,
            reason=(
                "Surgery Center CSF is missing required facility/licensing fields: "
                + ", ".join(missing)
            ),
            missing_fields=missing,
        )

    if not form.attestation_accepted:
        return SurgeryCenterCsfDecision(
            status=CsDecisionStatus.BLOCKED,
            reason=(
                "Surgery Center has not accepted the controlled substances attestation. "
                "The attestation clause must be acknowledged before controlled "
                "substances can be shipped."
            ),
            missing_fields=["attestation_accepted"],
        )

    # --- NEW: item-aware rule layer ---
    ship_state = (form.ship_to_state or "").upper()
    high_risk_items = [
        item
        for item in form.controlled_substances
        if (item.dea_schedule or "").upper() in {"II", "CII"}
    ]

    if high_risk_items and ship_state == "FL":
        example_names = ", ".join(item.name for item in high_risk_items[:3])
        return SurgeryCenterCsfDecision(
            status=CsDecisionStatus.MANUAL_REVIEW,
            reason=(
                "Surgery Center CSF includes high-risk Schedule II controlled substances "
                "for ship-to state FL. Example item(s): "
                f"{example_names}. Requires manual compliance review per "
                "Florida Controlled Substances Addendum (csf_fl_addendum)."
            ),
            missing_fields=[],
        )

    return SurgeryCenterCsfDecision(
        status=CsDecisionStatus.OK_TO_SHIP,
        reason=(
            "All required facility, licensing, jurisdiction, and attestation details "
            "are present. Surgery Center CSF is approved to proceed."
        ),
        missing_fields=[],
    )
