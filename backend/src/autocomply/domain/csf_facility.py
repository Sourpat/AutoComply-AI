from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, Field

from src.autocomply.domain.controlled_substances import ControlledSubstanceItem
from src.autocomply.domain.csf_hospital import (
    HospitalCsfDecision,
    HospitalCsfForm,
    HospitalFacilityType,
    evaluate_hospital_csf,
)


class FacilityFacilityType(str, Enum):
    FACILITY = "facility"
    HOSPITAL = "hospital"
    LONG_TERM_CARE = "long_term_care"
    SURGICAL_CENTER = "surgical_center"
    CLINIC = "clinic"
    OTHER = "other"


class FacilityControlledSubstance(BaseModel):
    """Payload shape for Facility CSF controlled substances (frontend aligned)."""

    id: str
    name: str
    strength: Optional[str] = None
    unit: Optional[str] = None
    schedule: Optional[str] = None
    dea_code: Optional[str] = None
    ndc: Optional[str] = None
    dosage_form: Optional[str] = None
    dea_schedule: Optional[str] = None

    def to_controlled_substance_item(self) -> ControlledSubstanceItem:
        """Normalize facility items into the core ControlledSubstanceItem shape."""

        return ControlledSubstanceItem(
            id=self.id,
            name=self.name,
            ndc=self.ndc,
            strength=self.strength,
            dosage_form=self.dosage_form,
            dea_schedule=self.schedule or self.dea_schedule,
        )


class FacilityCsfForm(BaseModel):
    """Normalized representation of the Facility Pharmacy Controlled Substance Form."""

    facility_name: str = Field(...)
    facility_type: FacilityFacilityType
    account_number: Optional[str] = None

    pharmacy_license_number: str = Field(...)
    dea_number: str = Field(...)

    pharmacist_in_charge_name: str = Field(...)
    pharmacist_contact_phone: Optional[str] = None

    ship_to_state: str = Field(..., max_length=2)

    attestation_accepted: bool = Field(
        default=False,
        description=(
            "True if the pharmacist-in-charge/facility has accepted the "
            "controlled substances attestation clause."
        ),
    )

    controlled_substances: List[FacilityControlledSubstance] = Field(
        default_factory=list,
        description=(
            "Controlled substance items associated with this Facility CSF. "
            "Populated from the Controlled Substances search UI."
        ),
    )

    internal_notes: Optional[str] = None


class FacilityCsfDecision(HospitalCsfDecision):
    """Output of the Facility CSF decision logic."""


_FACILITY_TO_HOSPITAL_TYPE = {
    FacilityFacilityType.FACILITY: HospitalFacilityType.OTHER,
    FacilityFacilityType.HOSPITAL: HospitalFacilityType.HOSPITAL,
    FacilityFacilityType.LONG_TERM_CARE: HospitalFacilityType.LONG_TERM_CARE,
    FacilityFacilityType.SURGICAL_CENTER: HospitalFacilityType.SURGICAL_CENTER,
    FacilityFacilityType.CLINIC: HospitalFacilityType.CLINIC,
    FacilityFacilityType.OTHER: HospitalFacilityType.OTHER,
}


def evaluate_facility_csf(form: FacilityCsfForm) -> FacilityCsfDecision:
    """Delegate Facility CSF evaluation to the Hospital CSF engine."""

    hospital_form = HospitalCsfForm(
        facility_name=form.facility_name,
        facility_type=_FACILITY_TO_HOSPITAL_TYPE.get(
            form.facility_type, HospitalFacilityType.OTHER
        ),
        account_number=form.account_number,
        pharmacy_license_number=form.pharmacy_license_number,
        dea_number=form.dea_number,
        pharmacist_in_charge_name=form.pharmacist_in_charge_name,
        pharmacist_contact_phone=form.pharmacist_contact_phone,
        ship_to_state=form.ship_to_state,
        attestation_accepted=form.attestation_accepted,
        controlled_substances=[
            item.to_controlled_substance_item() for item in form.controlled_substances
        ],
        internal_notes=form.internal_notes,
    )

    decision = evaluate_hospital_csf(hospital_form)

    references = decision.regulatory_references or ["csf_facility_form"]
    normalized_references = [
        "csf_facility_form" if ref == "csf_hospital_form" else ref
        for ref in references
    ]

    if not normalized_references:
        normalized_references = ["csf_facility_form"]

    decision.regulatory_references = normalized_references

    return FacilityCsfDecision.model_validate(decision.model_dump())


__all__ = [
    "FacilityFacilityType",
    "FacilityCsfForm",
    "FacilityControlledSubstance",
    "FacilityCsfDecision",
    "evaluate_facility_csf",
]
