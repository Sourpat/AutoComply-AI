from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, Field, field_validator
from pydantic.alias_generators import to_camel

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
    """Payload shape for Facility CSF controlled substances (frontend aligned).
    
    Supports backward-compatible field aliases:
    - quantity, qty -> maps to quantity field
    - licenseExpiration, license_expiration, expires_on -> maps to license_expiration
    """

    id: str = Field(..., description="Unique identifier for the controlled substance")
    name: str = Field(..., description="Name of the controlled substance")
    strength: Optional[str] = Field(None, description="Strength/dosage (e.g., '5mg')")
    unit: Optional[str] = Field(None, description="Unit of measurement")
    quantity: Optional[int] = Field(
        None,
        validation_alias="qty",
        description="Quantity requested (accepts 'qty' or 'quantity')"
    )
    schedule: Optional[str] = Field(None, description="DEA schedule (legacy field)")
    dea_code: Optional[str] = Field(None, description="DEA code")
    ndc: Optional[str] = Field(None, description="National Drug Code")
    dosage_form: Optional[str] = Field(None, description="Dosage form (e.g., 'tablet', 'capsule')")
    dea_schedule: Optional[str] = Field(None, description="DEA schedule (II-V)")

    class Config:
        json_schema_extra = {
            "example": {
                "id": "oxy-5mg",
                "name": "Oxycodone 5mg",
                "ndc": "00406-0512-01",
                "strength": "5mg",
                "dosage_form": "tablet",
                "dea_schedule": "II",
                "quantity": 100
            }
        }

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
    """Normalized representation of the Facility Pharmacy Controlled Substance Form.
    
    Supports backward-compatible field aliases:
    - licenseExpiration, license_expiration, expires_on -> pharmacy_license_expiration
    """

    facility_name: str = Field(..., description="Name of the facility")
    facility_type: FacilityFacilityType = Field(..., description="Type of facility")
    account_number: Optional[str] = Field(None, description="Account number")

    pharmacy_license_number: str = Field(..., description="State pharmacy license number")
    pharmacy_license_expiration: Optional[str] = Field(
        None,
        validation_alias="licenseExpiration",
        description="Pharmacy license expiration date (accepts licenseExpiration, license_expiration, or expires_on)"
    )
    dea_number: str = Field(..., description="DEA registration number")

    pharmacist_in_charge_name: str = Field(..., description="Name of pharmacist in charge")
    pharmacist_contact_phone: Optional[str] = Field(None, description="Contact phone number")

    ship_to_state: str = Field(..., max_length=2, description="Two-letter state code for shipping destination")

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

    internal_notes: Optional[str] = Field(None, description="Internal notes for verification team")

    # Support multiple field name variations for license expiration
    @field_validator('pharmacy_license_expiration', mode='before')
    @classmethod
    def normalize_license_expiration(cls, v, info):
        """Accept license_expiration, licenseExpiration, or expires_on."""
        # Pydantic v2 validation_alias handles this, but add explicit support
        return v

    class Config:
        json_schema_extra = {
            "example": {
                "facility_name": "SummitCare Clinics – East Region",
                "facility_type": "facility",
                "account_number": "ACCT-445210",
                "pharmacy_license_number": "PHOH-76321",
                "pharmacy_license_expiration": "2025-12-31",
                "dea_number": "BS1234567",
                "pharmacist_in_charge_name": "Dr. Alexis Monroe",
                "pharmacist_contact_phone": "614-555-0198",
                "ship_to_state": "OH",
                "attestation_accepted": True,
                "internal_notes": "Standard facility CSF submission",
                "controlled_substances": [
                    {
                        "id": "oxy-5mg",
                        "name": "Oxycodone 5mg",
                        "ndc": "00406-0512-01",
                        "strength": "5mg",
                        "dosage_form": "tablet",
                        "dea_schedule": "II",
                        "quantity": 100
                    }
                ]
            }
        }


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
        pharmacy_license_expiration=getattr(form, 'pharmacy_license_expiration', None),
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
