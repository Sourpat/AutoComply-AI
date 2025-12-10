from typing import List

from pydantic import BaseModel, Field

from autocomply.domain.ohio_tddd import (
    OhioTdddDecisionStatus,
)
from autocomply.domain.compliance_artifacts import (
    COMPLIANCE_ARTIFACTS,
    ComplianceArtifact,
)
from src.api.models.compliance_models import RegulatorySource
from src.autocomply.regulations.knowledge import get_regulatory_knowledge


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

    status: OhioTdddDecisionStatus
    reason: str
    explanation: str
    regulatory_references: List[str] = Field(
        default_factory=list,
        description="Echo of the decision's regulatory_references field.",
    )
    rag_explanation: str = Field(
        ..., description="RAG-friendly echo of the explanation text."
    )
    artifacts_used: List[str] = Field(
        default_factory=list,
        description="IDs of regulatory artifacts used to build the explanation.",
    )
    rag_sources: List[RegulatorySource] = Field(
        default_factory=list,
        description="Full regulatory sources pulled from the knowledge registry.",
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

    knowledge = get_regulatory_knowledge()
    rag_sources = knowledge.get_context_for_engine(
        engine_family="license", decision_type="license_ohio_tddd"
    )
    if not rag_sources:
        rag_sources = knowledge.get_sources_for_doc_ids(["ohio_tddd_rules"])

    regulatory_references = decision.regulatory_references or [
        src.id for src in rag_sources if src.id
    ]

    # Regulatory references -> resolve via coverage
    if regulatory_references:
        artifacts = _lookup_artifacts(regulatory_references)
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
        status=decision.status,
        reason=decision.reason,
        explanation=explanation_text,
        regulatory_references=regulatory_references,
        rag_explanation=explanation_text,
        artifacts_used=list(regulatory_references),
        rag_sources=rag_sources,
    )
