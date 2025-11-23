from typing import List

from pydantic import BaseModel, Field

from autocomply.domain.ohio_tddd import (
    OhioTdddDecisionStatus,
)
from autocomply.domain.compliance_artifacts import (
    COMPLIANCE_ARTIFACTS,
    ComplianceArtifact,
)


class OhioTdddDecisionSummary(BaseModel):
    """
    Minimal, API-facing view of an Ohio TDDD decision.

    Mirrors the shape of OhioTdddDecision but is engine-agnostic enough
    to be used by the /ohio-tddd/explain endpoint.
    """

    status: OhioTdddDecisionStatus
    reason: str
    missing_fields: List[str] = Field(default_factory=list)
    regulatory_references: List[str] = Field(
        default_factory=list,
        description=(
            "IDs of compliance artifacts (e.g., ohio_tddd_registration) that "
            "directly informed this decision."
        ),
    )


class OhioTdddExplanation(BaseModel):
    """
    Narrative explanation for an Ohio TDDD decision.
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


def explain_ohio_tddd_decision(
    decision: OhioTdddDecisionSummary,
) -> OhioTdddExplanation:
    """
    Build a human-readable explanation for an Ohio TDDD decision, enriched with
    references to compliance artifacts (e.g., ohio_tddd_registration).
    """

    lines: List[str] = []

    # High-level decision summary
    if decision.status in (
        OhioTdddDecisionStatus.APPROVED,
        OhioTdddDecisionStatus.OK_TO_SHIP,
    ):
        lines.append("Ohio TDDD decision: Application is approved.")
    elif decision.status == OhioTdddDecisionStatus.BLOCKED:
        lines.append(
            "Ohio TDDD decision: Application is blocked and cannot proceed "
            "until issues are resolved."
        )
    elif decision.status == OhioTdddDecisionStatus.MANUAL_REVIEW:
        lines.append(
            "Ohio TDDD decision: Application requires manual board/compliance "
            "review before approval."
        )
    else:
        lines.append(f"Ohio TDDD decision status: {decision.status.value}.")

    # Engine rationale
    if decision.reason:
        lines.append(f"Rationale: {decision.reason}")

    # Missing fields, if any
    if decision.missing_fields:
        missing_str = ", ".join(decision.missing_fields)
        lines.append(f"Missing or incomplete fields: {missing_str}.")

    # Regulatory references -> resolve via coverage
    if decision.regulatory_references:
        artifacts = _lookup_artifacts(decision.regulatory_references)
        if artifacts:
            lines.append("Regulatory basis:")
            for art in artifacts:
                lines.append(f"- {art.name} [{art.jurisdiction}] (id={art.id})")
        else:
            lines.append(
                "Regulatory references were provided, but no matching artifacts "
                "were found in the coverage registry."
            )

    explanation_text = "\n".join(lines)

    return OhioTdddExplanation(
        explanation=explanation_text,
        regulatory_references=decision.regulatory_references,
    )
