from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, Field

# Reuse the same decision status enum as Practitioner CSF to keep things consistent.
from autocomply.domain.csf_practitioner import CsDecisionStatus


class HospitalFacilityType(str, Enum):
    HOSPITAL = "hospital"
    LONG_TERM_CARE = "long_term_care"
    SURGICAL_CENTER = "surgical_center"
    CLINIC = "clinic"
    OTHER = "other"


class HospitalCsfForm(BaseModel):
    """
    Normalized representation of the Hospital Pharmacy Controlled Substance Form.

    This is a conservative first pass, aligned with typical fields on
    "Online Controlled Substance Form - Hospital Pharmacy.pdf".
    We can refine to match section/field labels exactly once we do a
    detailed pass on the PDF.
    """

    # Facility / pharmacy identity
    facility_name: str = Field(...)
    facility_type: HospitalFacilityType
    account_number: Optional[str] = None

    # Pharmacy licensing
    pharmacy_license_number: str = Field(...)
    dea_number: str = Field(...)

    # Pharmacist-in-charge / contact
    pharmacist_in_charge_name: str = Field(...)
    pharmacist_contact_phone: Optional[str] = None

    # Jurisdiction context
    ship_to_state: str = Field(..., max_length=2)

    # Attestation checkbox – required to ship
    attestation_accepted: bool = Field(
        default=False,
        description=(
            "True if the pharmacist-in-charge/facility has accepted the "
            "controlled substances attestation clause."
        ),
    )

    # Internal notes (for support/compliance)
    internal_notes: Optional[str] = None


class HospitalCsfDecision(BaseModel):
    """
    Output of the Hospital CSF decision logic.
    """

    status: CsDecisionStatus
    reason: str
    missing_fields: List[str] = Field(default_factory=list)


def evaluate_hospital_csf(form: HospitalCsfForm) -> HospitalCsfDecision:
    """
    First-pass decision logic for Hospital Pharmacy CSF.

    Conservative baseline:
    - Require facility_name, pharmacy_license_number, dea_number,
      pharmacist_in_charge_name, ship_to_state.
    - Require attestation_accepted to be True to allow shipping.
    - BLOCKED when required fields are missing or attestation is not accepted.
    - MANUAL_REVIEW reserved for future complex edge cases (state-specific addendums, etc.).
    """
    missing: List[str] = []

    if not form.facility_name.strip():
        missing.append("facility_name")
    if not form.pharmacy_license_number.strip():
        missing.append("pharmacy_license_number")
    if not form.dea_number.strip():
        missing.append("dea_number")
    if not form.pharmacist_in_charge_name.strip():
        missing.append("pharmacist_in_charge_name")
    if not form.ship_to_state.strip():
        missing.append("ship_to_state")

    if missing:
        return HospitalCsfDecision(
            status=CsDecisionStatus.BLOCKED,
            reason=(
                "Hospital CSF is missing required facility/pharmacy/licensing fields: "
                + ", ".join(missing)
            ),
            missing_fields=missing,
        )

    if not form.attestation_accepted:
        return HospitalCsfDecision(
            status=CsDecisionStatus.BLOCKED,
            reason=(
                "Hospital has not accepted the controlled substances attestation. "
                "The attestation clause must be acknowledged before controlled "
                "substances can be shipped."
            ),
            missing_fields=["attestation_accepted"],
        )

    return HospitalCsfDecision(
        status=CsDecisionStatus.OK_TO_SHIP,
        reason=(
            "All required facility, pharmacy license, DEA, jurisdiction, and attestation "
            "details are present. Hospital CSF is approved to proceed."
        ),
        missing_fields=[],
    )
