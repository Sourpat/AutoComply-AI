from enum import Enum
from typing import List

from pydantic import BaseModel, Field

from src.autocomply.domain.csf_practitioner import CsDecisionStatus
from src.autocomply.domain.compliance_artifacts import (
    COMPLIANCE_ARTIFACTS,
    ComplianceArtifact,
)


class CsfType(str, Enum):
    PRACTITIONER = "practitioner"
    HOSPITAL = "hospital"
    FACILITY = "facility"
    RESEARCHER = "researcher"
    SURGERY_CENTER = "surgery_center"
    EMS = "ems"


class CsfDecisionSummary(BaseModel):
    """
    Minimal, engine-agnostic view of a CSF decision.

    Mirrors common fields across Practitioner/Hospital/Researcher/Surgery/EMS
    decision models so the explain endpoint can work for all of them.
    """

    status: CsDecisionStatus
    reason: str
    missing_fields: List[str] = Field(default_factory=list)
    regulatory_references: List[str] = Field(
        default_factory=list,
        description=(
            "IDs of compliance artifacts that directly informed this decision "
            "(e.g., csf_fl_addendum)."
        ),
    )


class CsfExplanation(BaseModel):
    """
    Narrative explanation for a CSF decision, suitable for UI / Codex / logs.
    """

    explanation: str
    regulatory_references: List[str] = Field(
        default_factory=list,
        description="Echo of the decision's regulatory_references field.",
    )


def _lookup_artifacts(ids: List[str]) -> List[ComplianceArtifact]:
    if not ids:
        return []
    id_set = set(ids)
    return [a for a in COMPLIANCE_ARTIFACTS if a.id in id_set]


def explain_csf_decision(
    csf_type: CsfType,
    decision: CsfDecisionSummary,
) -> CsfExplanation:
    """
    Build a human-readable explanation for a CSF decision, enriched with
    references to compliance artifacts (e.g., csf_fl_addendum).
    """

    lines: List[str] = []

    type_label_map = {
        CsfType.PRACTITIONER: "Practitioner CSF",
        CsfType.HOSPITAL: "Hospital CSF",
        CsfType.FACILITY: "Facility CSF",
        CsfType.RESEARCHER: "Researcher CSF",
        CsfType.SURGERY_CENTER: "Surgery Center CSF",
        CsfType.EMS: "EMS CSF",
    }
    type_label = type_label_map.get(csf_type, "CSF")

    # High-level decision summary
    if decision.status == CsDecisionStatus.OK_TO_SHIP:
        lines.append(f"{type_label} decision: Order is allowed to proceed.")
    elif decision.status == CsDecisionStatus.BLOCKED:
        lines.append(
            f"{type_label} decision: Order is blocked until required "
            "information is provided."
        )
    elif decision.status == CsDecisionStatus.MANUAL_REVIEW:
        lines.append(
            f"{type_label} decision: Order requires manual compliance review "
            "before shipping."
        )
    else:
        lines.append(f"{type_label} decision status: {decision.status.value}.")

    # Engine rationale
    if decision.reason:
        lines.append(f"Rationale: {decision.reason}")

    # Missing fields, if any
    if decision.missing_fields:
        missing_str = ", ".join(decision.missing_fields)
        lines.append(f"Missing or incomplete fields: {missing_str}.")

    # Regulatory references -> resolve to named artifacts
    if decision.regulatory_references:
        artifacts = _lookup_artifacts(decision.regulatory_references)
        if artifacts:
            lines.append("Regulatory basis:")
            for art in artifacts:
                lines.append(
                    f"- {art.name} [{art.jurisdiction}] (id={art.id})"
                )
        else:
            lines.append(
                "Regulatory references were provided, but no matching artifacts "
                "were found in the coverage registry."
            )

    explanation_text = "\n".join(lines)

    return CsfExplanation(
        explanation=explanation_text,
        regulatory_references=decision.regulatory_references,
    )
