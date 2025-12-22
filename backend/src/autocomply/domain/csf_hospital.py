from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field

from src.autocomply.domain.controlled_substances import ControlledSubstanceItem
# Reuse the same decision status enum as Practitioner CSF to keep things consistent.
from src.autocomply.domain.csf_practitioner import CsDecisionStatus


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

    model_config = ConfigDict(populate_by_name=True, extra="ignore")

    # Facility / pharmacy identity
    facility_name: str = Field(default="")
    facility_type: HospitalFacilityType = Field(default=HospitalFacilityType.HOSPITAL)
    account_number: Optional[str] = None

    # Pharmacy licensing
    pharmacy_license_number: str = Field(default="")
    dea_number: str = Field(default="")

    # Pharmacist-in-charge / contact
    pharmacist_in_charge_name: str = Field(default="")
    pharmacist_contact_phone: Optional[str] = None

    # Jurisdiction context
    ship_to_state: str = Field(default="", max_length=2)

    # Attestation checkbox – required to ship
    attestation_accepted: bool = Field(
        default=False,
        description=(
            "True if the pharmacist-in-charge/facility has accepted the "
            "controlled substances attestation clause."
        ),
    )

    # NEW: attached controlled substances for this form
    controlled_substances: List[ControlledSubstanceItem] = Field(
        default_factory=list,
        description=(
            "Controlled substance items associated with this Hospital CSF. "
            "Populated from the Controlled Substances search UI."
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
    regulatory_references: List[str] = Field(
        default_factory=list,
        description=(
            "IDs of compliance artifacts (e.g. csf_fl_addendum) that directly "
            "informed this decision."
        ),
    )


def evaluate_hospital_csf(form: HospitalCsfForm) -> HospitalCsfDecision:
    """
    First-pass decision logic for Hospital Pharmacy CSF.

    Conservative baseline:
    - Require facility_name, pharmacy_license_number, dea_number,
      pharmacist_in_charge_name, ship_to_state.
    - Require attestation_accepted to be True to allow shipping.
    - BLOCKED when required fields are missing or attestation is not accepted.
    - MANUAL_REVIEW reserved for future complex edge cases (state-specific addendums, etc.).
    
    **Demo Scenarios (for Hospital CSF Sandbox):**
    - EXPIRED TDDD: If pharmacy_license_number contains "EXPIRED", return BLOCKED.
    - State mismatch: If TDDD license but ship_to_state != OH, return BLOCKED.
    """
    
    # --- Demo Scenario: Expired TDDD license ---
    if form.pharmacy_license_number and "EXPIRED" in form.pharmacy_license_number.upper():
        return HospitalCsfDecision(
            status=CsDecisionStatus.BLOCKED,
            reason=(
                "Ohio TDDD license has expired. The facility must provide a current, "
                "active TDDD license before controlled substance orders can be processed."
            ),
            missing_fields=["pharmacy_license_number_active"],
            regulatory_references=["csf_hospital_form", "csf_oh_addendum"],
        )

    # --- Demo Scenario: State mismatch (TDDD but not OH) ---
    if form.ship_to_state and form.pharmacy_license_number:
        ship_state = form.ship_to_state.upper().strip()
        license_num = form.pharmacy_license_number.upper().strip()
        
        if "TDDD" in license_num and ship_state and ship_state != "OH":
            return HospitalCsfDecision(
                status=CsDecisionStatus.BLOCKED,
                reason=(
                    f"State mismatch: This Hospital CSF references an Ohio TDDD license, "
                    f"but the ship-to state is {form.ship_to_state}. Ohio TDDD licenses "
                    "are only valid for shipments to Ohio addresses."
                ),
                missing_fields=["ship_to_state_valid"],
                regulatory_references=["csf_hospital_form", "csf_oh_addendum"],
            )
    
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
            regulatory_references=["csf_hospital_form"],
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
            regulatory_references=["csf_hospital_form"],
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
        return HospitalCsfDecision(
            status=CsDecisionStatus.MANUAL_REVIEW,
            reason=(
                "Hospital CSF includes high-risk Schedule II controlled substances "
                "for ship-to state FL. Example item(s): "
                f"{example_names}. Requires manual compliance review per "
                "Florida Controlled Substances Addendum (csf_fl_addendum)."
            ),
            missing_fields=[],
            regulatory_references=["csf_hospital_form", "csf_fl_addendum"],
        )

    return HospitalCsfDecision(
        status=CsDecisionStatus.OK_TO_SHIP,
        reason=(
            "All required facility, pharmacy license, DEA, jurisdiction, and attestation "
            "details are present. Hospital CSF is approved to proceed."
        ),
        missing_fields=[],
        regulatory_references=["csf_hospital_form"],
    )


def describe_hospital_csf_decision(
    form: HospitalCsfForm,
    decision: HospitalCsfDecision,
) -> str:
    """
    Deterministic explanation for the Hospital CSF decision.
    Useful for logs, audits, or as a base layer for Codex.
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

    # 2. Facility context
    lines.append(
        f"Facility: {form.facility_name or '[missing]'} "
        f"({form.facility_type.value}), ship-to state: {form.ship_to_state or '[missing]'}."
    )

    # 3. Licensing & pharmacist details
    lines.append(
        "Pharmacy licensing and responsible pharmacist: "
        f"pharmacy_license_number={form.pharmacy_license_number or '[missing]'}, "
        f"dea_number={form.dea_number or '[missing]'}, "
        f"pharmacist_in_charge_name={form.pharmacist_in_charge_name or '[missing]'}."
    )

    # 4. Attestation
    if form.attestation_accepted:
        lines.append(
            "Attestation: The facility has accepted the controlled substances attestation clause."
        )
    else:
        lines.append(
            "Attestation: The facility has NOT accepted the controlled substances attestation clause."
        )

    # 5. Missing fields
    if decision.missing_fields:
        lines.append(
            "The engine identified the following missing or incomplete fields: "
            + ", ".join(decision.missing_fields)
            + "."
        )

    if form.controlled_substances:
        lines.append(
            f"Attached controlled substance items: {len(form.controlled_substances)} item(s)."
        )
        example_names = [item.name for item in form.controlled_substances[:3]]
        lines.append("Examples: " + ", ".join(example_names) + ".")
    else:
        lines.append("No controlled substance items were attached to this CSF.")

    return "\n".join(lines)
