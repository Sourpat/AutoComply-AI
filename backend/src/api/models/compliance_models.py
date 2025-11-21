from typing import List, Optional, Literal
from pydantic import BaseModel, Field


# ----------------------------
# License Data Models
# ----------------------------

class DEALicense(BaseModel):
    dea_number: Optional[str] = None
    expiry_date: Optional[str] = None
    schedule: Optional[List[str]] = None
    issue_date: Optional[str] = None
    status: Optional[str] = None


class StateLicense(BaseModel):
    state: Optional[str] = None
    permit_number: Optional[str] = None
    expiry_date: Optional[str] = None
    status: Optional[str] = None


# ----------------------------
# OCR Extraction Output
# ----------------------------

class OCRExtractedData(BaseModel):
    dea_license: Optional[DEALicense] = None
    state_license: Optional[StateLicense] = None
    practitioner_name: Optional[str] = None
    practice_type: Optional[str] = None
    raw_text: Optional[str] = None


# ----------------------------
# Practice Types
# ----------------------------

PracticeType = Literal[
    "Standard",
    "HospitalPharmacy",
    "EMS",
    "Researcher",
    "SurgeryCentre",
    "FloridaPractitioner"
]


# ----------------------------
# Addendum Requirements
# ----------------------------

class AddendumRequirement(BaseModel):
    required: bool = False
    addendum_type: Optional[str] = None
    reason: Optional[str] = None


# ----------------------------
# Attestation Requirements
# ----------------------------

class AttestationRequirement(BaseModel):
    """
    Describes a compliance attestation that must be acknowledged
    before proceeding with controlled-substance checkout.
    """

    id: str = Field(
        ...,
        description=(
            "Stable identifier for this attestation, e.g. "
            "'ryan_haight_telemedicine'."
        ),
    )
    jurisdiction: str = Field(
        ...,
        description=(
            "Jurisdiction or rule family this attestation is tied to, "
            "e.g. 'US-FEDERAL' or 'US-CA'."
        ),
    )
    scenario: str = Field(
        ...,
        description=(
            "Short machine-readable description of when this attestation "
            "applies, e.g. 'telemedicine_schedule_ii_v_remote_sale'."
        ),
    )
    text: str = Field(
        ...,
        description=(
            "Human-readable attestation text that can be displayed in the UI."
        ),
    )
    must_acknowledge: bool = Field(
        default=True,
        description=(
            "Whether the user must actively acknowledge this attestation "
            "before checkout is allowed to proceed."
        ),
    )


# ----------------------------
# Compliance Verdict (Engine Output)
# ----------------------------

class ComplianceVerdict(BaseModel):
    is_valid: bool
    reason: Optional[str] = None
    form_required: Optional[str] = None
    addendum: Optional[AddendumRequirement] = None
    allow_checkout: bool
    attestations_required: List[AttestationRequirement] = Field(
        default_factory=list,
        description=(
            "List of attestation requirements that must be completed or "
            "acknowledged for this decision. Empty if no additional "
            "attestations are required."
        ),
    )
    sources: Optional[List[str]] = None  # from RAG
    metadata: Optional[dict] = None      # optional debugging info
    regulatory_context: Optional[List[dict]] = None


# ----------------------------
# API Input: License Validation Request
# ----------------------------

class LicenseValidationRequest(BaseModel):
    practice_type: PracticeType
    dea_number: Optional[str] = None
    dea_expiry: Optional[str] = None
    state: Optional[str] = None
    state_permit: Optional[str] = None
    state_expiry: Optional[str] = None
    ship_to_state: Optional[str] = None
    purchase_intent: Optional[str] = None
    quantity: Optional[int] = None


# ----------------------------
# API Output: License Validation Response
# ----------------------------

class LicenseValidationResponse(BaseModel):
    success: bool
    verdict: ComplianceVerdict
