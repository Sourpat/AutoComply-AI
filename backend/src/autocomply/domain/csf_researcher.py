from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, Field

from autocomply.domain.controlled_substances import ControlledSubstanceItem
from autocomply.domain.csf_practitioner import CsDecisionStatus


class ResearchFacilityType(str, Enum):
    UNIVERSITY = "university"
    HOSPITAL_RESEARCH = "hospital_research"
    PRIVATE_LAB = "private_lab"
    PHARMA_RND = "pharma_rnd"
    OTHER = "other"


class ResearcherCsfForm(BaseModel):
    """
    Normalized representation of the Researcher Controlled Substance Form.

    Mirrors key fields from:
    'Online Controlled Substance Form - Researcher form.pdf'.
    """

    # Facility / institution identity
    institution_name: str = Field(...)
    facility_type: ResearchFacilityType
    account_number: Optional[str] = None

    # Principal investigator / researcher
    principal_investigator_name: str = Field(...)
    researcher_title: Optional[str] = None

    # Licensing / authorization
    state_license_number: Optional[str] = None
    dea_number: Optional[str] = None
    protocol_or_study_id: str = Field(
        ..., description="Internal protocol/study reference."
    )

    # Jurisdiction
    ship_to_state: str = Field(..., max_length=2)

    # Attestation (required)
    attestation_accepted: bool = Field(
        default=False,
        description=(
            "True if the researcher/PI has accepted the controlled substances "
            "attestation clause."
        ),
    )

    # NEW: attached controlled substances
    controlled_substances: List[ControlledSubstanceItem] = Field(
        default_factory=list,
        description=(
            "Controlled substance items associated with this Researcher CSF. "
            "Populated from the Controlled Substances search UI."
        ),
    )

    # Internal notes for support/compliance
    internal_notes: Optional[str] = None


class ResearcherCsfDecision(BaseModel):
    status: CsDecisionStatus
    reason: str
    missing_fields: List[str] = Field(default_factory=list)


def evaluate_researcher_csf(form: ResearcherCsfForm) -> ResearcherCsfDecision:
    """
    First-pass decision logic for Researcher CSF.

    Conservative baseline:
    - Require institution_name, principal_investigator_name, protocol_or_study_id,
      ship_to_state.
    - Treat license/DEA as optional for now, since some research flows may operate
      under institutional authorizations.
    - Require attestation_accepted to allow shipping.
    """
    missing: List[str] = []

    if not form.institution_name.strip():
        missing.append("institution_name")
    if not form.principal_investigator_name.strip():
        missing.append("principal_investigator_name")
    if not form.protocol_or_study_id.strip():
        missing.append("protocol_or_study_id")
    if not form.ship_to_state.strip():
        missing.append("ship_to_state")

    if missing:
        return ResearcherCsfDecision(
            status=CsDecisionStatus.BLOCKED,
            reason=(
                "Researcher CSF is missing required institution/research fields: "
                + ", ".join(missing)
            ),
            missing_fields=missing,
        )

    if not form.attestation_accepted:
        return ResearcherCsfDecision(
            status=CsDecisionStatus.BLOCKED,
            reason=(
                "The researcher has not accepted the controlled substances attestation. "
                "The attestation clause must be acknowledged before controlled "
                "substances can be shipped."
            ),
            missing_fields=["attestation_accepted"],
        )

    return ResearcherCsfDecision(
        status=CsDecisionStatus.OK_TO_SHIP,
        reason=(
            "All required institution, research protocol, jurisdiction, and attestation "
            "details are present. Researcher CSF is approved to proceed."
        ),
        missing_fields=[],
    )


def describe_researcher_csf_decision(
    form: ResearcherCsfForm, decision: ResearcherCsfDecision
) -> str:
    """
    Deterministic explanation for the Researcher CSF decision.
    Helpful for logs / audits or as a base for Codex.
    """
    lines: List[str] = []

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

    lines.append(
        f"Institution: {form.institution_name or '[missing]'} "
        f"({form.facility_type.value}), ship-to state: {form.ship_to_state or '[missing]'}."
    )

    lines.append(
        "Research details: "
        f"principal_investigator_name={form.principal_investigator_name or '[missing]'}, "
        f"protocol_or_study_id={form.protocol_or_study_id or '[missing]'}"
        + "."
    )

    if form.attestation_accepted:
        lines.append(
            "Attestation: The researcher/PI has accepted the controlled substances attestation clause."
        )
    else:
        lines.append(
            "Attestation: The researcher/PI has NOT accepted the controlled substances attestation clause."
        )

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
