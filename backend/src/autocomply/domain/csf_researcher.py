from enum import Enum
from typing import List, Optional

from pydantic import AliasChoices, BaseModel, Field
from pydantic.config import ConfigDict

from src.autocomply.domain.controlled_substances import ControlledSubstanceItem
from src.autocomply.domain.csf_practitioner import CsDecisionStatus


class ResearcherFacilityType(str, Enum):
    FACILITY = "facility"
    HOSPITAL = "hospital"
    LONG_TERM_CARE = "long_term_care"
    SURGICAL_CENTER = "surgical_center"
    CLINIC = "clinic"
    RESEARCHER = "researcher"
    OTHER = "other"


class ResearcherControlledSubstance(BaseModel):
    """Payload shape for Researcher CSF controlled substances (frontend aligned)."""

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
        return ControlledSubstanceItem(
            id=self.id,
            name=self.name,
            ndc=self.ndc,
            strength=self.strength,
            dosage_form=self.dosage_form,
            dea_schedule=self.schedule or self.dea_schedule,
        )


class ResearcherCsfForm(BaseModel):
    """Normalized representation of the Researcher Controlled Substance Form."""

    model_config = ConfigDict(populate_by_name=True)

    facility_name: str = Field(..., validation_alias=AliasChoices("facility_name", "institution_name"))
    facility_type: Optional[str] = Field(default="researcher", validation_alias="facility_type")
    account_number: Optional[str] = None

    pharmacy_license_number: str = Field(..., validation_alias=AliasChoices("pharmacy_license_number", "state_license_number"))
    dea_number: Optional[str] = None

    pharmacist_in_charge_name: str = Field(
        ...,
        validation_alias=AliasChoices(
            "pharmacist_in_charge_name", "principal_investigator_name", "researcher_name"
        ),
    )
    pharmacist_contact_phone: Optional[str] = None

    ship_to_state: str = Field(..., max_length=2)

    attestation_accepted: bool = Field(default=False)

    controlled_substances: List[ResearcherControlledSubstance] = Field(default_factory=list)

    internal_notes: Optional[str] = None


class ResearcherCsfDecision(BaseModel):
    status: CsDecisionStatus
    reason: str
    missing_fields: List[str] = Field(default_factory=list)
    regulatory_references: List[str] = Field(default_factory=list)


def evaluate_researcher_csf(form: ResearcherCsfForm) -> ResearcherCsfDecision:
    """
    First-pass decision logic for Researcher CSF.

    Mirrors the EMS/Facility baseline checks until we add Researcher-specific
    rules. Requires core identity/licensing fields and attestation acceptance.
    """

    missing: List[str] = []

    cs_items: List[ControlledSubstanceItem] = []
    for item in form.controlled_substances:
        if hasattr(item, "to_controlled_substance_item"):
            cs_items.append(item.to_controlled_substance_item())
        elif isinstance(item, ControlledSubstanceItem):
            cs_items.append(item)
        elif hasattr(item, "model_dump"):
            cs_items.append(ControlledSubstanceItem.model_validate(item.model_dump()))
        elif isinstance(item, dict):
            cs_items.append(ControlledSubstanceItem.model_validate(item))
        else:
            cs_items.append(ControlledSubstanceItem.model_validate(item))

    if not form.facility_name.strip():
        missing.extend(["facility_name", "institution_name"])
    if not form.pharmacy_license_number.strip():
        missing.extend(["pharmacy_license_number", "state_license_number"])
    if not form.pharmacist_in_charge_name.strip():
        missing.extend(
            ["pharmacist_in_charge_name", "principal_investigator_name", "researcher_name"]
        )
    if not form.ship_to_state.strip():
        missing.append("ship_to_state")

    if missing:
        return ResearcherCsfDecision(
            status=CsDecisionStatus.BLOCKED,
            reason=(
                "Researcher CSF is missing required facility/licensing fields: "
                + ", ".join(missing)
            ),
            missing_fields=missing,
            regulatory_references=["csf_researcher_form"],
        )

    if not form.attestation_accepted:
        return ResearcherCsfDecision(
            status=CsDecisionStatus.BLOCKED,
            reason=(
                "The Researcher CSF attestation has not been accepted. "
                "The attestation clause must be acknowledged before controlled "
                "substances can be shipped."
            ),
            missing_fields=["attestation_accepted"],
            regulatory_references=["csf_researcher_form"],
        )

    ship_state = (form.ship_to_state or "").upper()
    high_risk_items = [
        item for item in cs_items if (item.dea_schedule or "").upper() in {"II", "CII"}
    ]

    if high_risk_items and ship_state == "FL":
        example_names = ", ".join(item.name for item in high_risk_items[:3])
        return ResearcherCsfDecision(
            status=CsDecisionStatus.MANUAL_REVIEW,
            reason=(
                "Researcher CSF includes high-risk Schedule II controlled substances "
                "for ship-to state FL. Example item(s): "
                f"{example_names}. Requires manual compliance review per "
                "Florida Controlled Substances Addendum (csf_fl_addendum)."
            ),
            missing_fields=[],
            regulatory_references=["csf_researcher_form", "csf_fl_addendum"],
        )

    return ResearcherCsfDecision(
        status=CsDecisionStatus.OK_TO_SHIP,
        reason=(
            "All required facility, jurisdiction, and attestation details "
            "are present. Researcher CSF is approved to proceed."
        ),
        missing_fields=[],
        regulatory_references=["csf_researcher_form"],
    )
