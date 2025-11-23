from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, Field

from autocomply.domain.controlled_substances import ControlledSubstanceItem
from autocomply.domain.csf_practitioner import CsDecisionStatus


class EmsServiceType(str, Enum):
    EMS_SERVICE = "ems_service"
    AMBULANCE_SERVICE = "ambulance_service"
    FIRE_DEPARTMENT = "fire_department"
    AIR_MEDICAL = "air_medical"
    OTHER = "other"


class EmsCsfForm(BaseModel):
    """
    Normalized representation of the EMS Controlled Substance Form.

    Mirrors typical fields from
    'Online Controlled Substance Form - EMS form.pdf'.
    """

    # Service identity
    service_name: str = Field(...)
    service_type: EmsServiceType
    account_number: Optional[str] = None

    # Licensing
    agency_license_number: str = Field(
        ..., description="EMS agency/service license"
    )
    dea_number: Optional[str] = Field(
        default=None,
        description=(
            "DEA number if applicable. Some EMS agencies may operate under "
            "a medical director's DEA; we treat this as optional for now."
        ),
    )

    # Responsible medical director / officer
    medical_director_name: str = Field(...)

    # Jurisdiction
    ship_to_state: str = Field(..., max_length=2)

    # Attestation
    attestation_accepted: bool = Field(
        default=False,
        description="True if the service accepted the CSF attestation clause.",
    )

    controlled_substances: List[ControlledSubstanceItem] = Field(
        default_factory=list,
        description=("Controlled substance items associated with this EMS CSF."),
    )

    # Internal notes
    internal_notes: Optional[str] = None


class EmsCsfDecision(BaseModel):
    status: CsDecisionStatus
    reason: str
    missing_fields: List[str] = Field(default_factory=list)


def evaluate_ems_csf(form: EmsCsfForm) -> EmsCsfDecision:
    """
    First-pass decision logic for EMS CSF.

    Conservative baseline:
    - Require service_name, agency_license_number, medical_director_name, ship_to_state.
    - DEA number is optional for now (depends on operating model).
    - Require attestation_accepted to allow shipping.
    """
    missing: List[str] = []

    if not form.service_name.strip():
        missing.append("service_name")
    if not form.agency_license_number.strip():
        missing.append("agency_license_number")
    if not form.medical_director_name.strip():
        missing.append("medical_director_name")
    if not form.ship_to_state.strip():
        missing.append("ship_to_state")

    if missing:
        return EmsCsfDecision(
            status=CsDecisionStatus.BLOCKED,
            reason=(
                "EMS CSF is missing required service/licensing fields: "
                + ", ".join(missing)
            ),
            missing_fields=missing,
        )

    if not form.attestation_accepted:
        return EmsCsfDecision(
            status=CsDecisionStatus.BLOCKED,
            reason=(
                "EMS service has not accepted the controlled substances attestation. "
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
        return EmsCsfDecision(
            status=CsDecisionStatus.MANUAL_REVIEW,
            reason=(
                "EMS CSF includes high-risk Schedule II controlled substances "
                "for ship-to state FL. Example item(s): "
                f"{example_names}. Requires manual compliance review per "
                "Florida Controlled Substances Addendum (csf_fl_addendum)."
            ),
            missing_fields=[],
        )

    return EmsCsfDecision(
        status=CsDecisionStatus.OK_TO_SHIP,
        reason=(
            "All required service, licensing, jurisdiction, and attestation details "
            "are present. EMS CSF is approved to proceed."
        ),
        missing_fields=[],
    )
