from __future__ import annotations

import importlib.util
import os
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field

from autocomply.domain.compliance_artifacts import (
    COMPLIANCE_ARTIFACTS,
    ComplianceArtifact,
)
from src.api.models.compliance_models import RegulatoryContextItem, RegulatorySource

USE_REAL_RAG = os.getenv("AUTOCOMPLY_ENABLE_RAG", "0") == "1"

HAVE_RAG_DEPENDENCIES = False

if USE_REAL_RAG and importlib.util.find_spec("openai") and importlib.util.find_spec(
    "rag.regulatory_docs_retriever"
):
    from openai import OpenAI
    from rag.regulatory_docs_retriever import (
        RetrievedRegulatoryChunk,
        retrieve_regulatory_chunks,
    )

    HAVE_RAG_DEPENDENCIES = True


class RegulatoryRagRequestModel(BaseModel):
    """
    Backend-facing model for a regulatory RAG query.

    - question: natural language question ("Explain why this CSF went to manual review").
    - regulatory_references: artifact IDs (e.g. ["csf_practitioner_form", "csf_fl_addendum"]).
    - decision: optional raw decision JSON (for context).
    """

    question: str = Field(..., min_length=1)
    regulatory_references: List[str] = Field(default_factory=list)
    decision: Optional[Dict[str, Any]] = None


class RegulatoryRagAnswer(BaseModel):
    """
    Response from the RAG pipeline (or stub).
    """

    answer: str
    regulatory_references: List[str] = Field(
        default_factory=list,
        description="Echo of the regulatory_references requested.",
    )
    artifacts_used: List[str] = Field(
        default_factory=list,
        description="IDs of artifacts that were actually loaded / considered.",
    )
    sources: List[RegulatorySource] = Field(
        default_factory=list,
        description="List of regulatory sources or citations used in the answer.",
    )
    debug: Dict[str, Any] = Field(
        default_factory=dict,
        description="Optional debug info (mode, counts, etc.).",
    )


def _lookup_artifacts(ids: List[str]) -> List[ComplianceArtifact]:
    if not ids:
        return []
    id_set = set(ids)
    return [a for a in COMPLIANCE_ARTIFACTS if a.id in id_set]


def _build_artifact_context_items(
    artifacts: List[ComplianceArtifact],
) -> List[RegulatoryContextItem]:
    if not artifacts:
        return []

    items: List[RegulatoryContextItem] = []
    for artifact in artifacts:
        snippet = artifact.notes or f"Reference artifact: {artifact.name}"
        items.append(
            RegulatoryContextItem(
                jurisdiction=artifact.jurisdiction,
                snippet=snippet,
                source=f"artifact:{artifact.id}",
            )
        )

    return items


def _build_artifact_sources(artifacts: List[ComplianceArtifact]) -> List[RegulatorySource]:
    if not artifacts:
        return []

    return [
        RegulatorySource(
            id=artifact.id,
            title=artifact.name,
            jurisdiction=artifact.jurisdiction,
            source="artifact",
            snippet=artifact.notes,
            url=artifact.source_document,
        )
        for artifact in artifacts
    ]


def _vector_chunks_to_context(
    chunks: List["RetrievedRegulatoryChunk"],
    default_jurisdiction: Optional[str],
) -> List[RegulatoryContextItem]:
    context_items: List[RegulatoryContextItem] = []

    for chunk in chunks:
        meta = chunk.metadata or {}
        title = (
            meta.get("title")
            or meta.get("file_name")
            or os.path.basename(meta.get("url", "") or "")
            or "Regulatory document"
        )

        context_items.append(
            RegulatoryContextItem(
                jurisdiction=meta.get("jurisdiction") or default_jurisdiction,
                snippet=f"{title}: {chunk.text}",
                source=meta.get("source") or "regulatory_docs",
            )
        )

    return context_items


def _vector_chunks_to_sources(
    chunks: List["RetrievedRegulatoryChunk"],
    default_jurisdiction: Optional[str],
) -> List[RegulatorySource]:
    sources: List[RegulatorySource] = []

    for idx, chunk in enumerate(chunks, start=1):
        meta = chunk.metadata or {}
        title = (
            meta.get("title")
            or meta.get("file_name")
            or os.path.basename(meta.get("url", "") or "")
            or f"Regulatory document {idx}"
        )

        sources.append(
            RegulatorySource(
                id=meta.get("artifact_id") or meta.get("id"),
                title=title,
                jurisdiction=meta.get("jurisdiction") or default_jurisdiction,
                source=meta.get("source") or "regulatory_docs",
                snippet=chunk.text,
                url=meta.get("url"),
            )
        )

    return sources


def _format_context_blocks(context_items: List[RegulatoryContextItem]) -> str:
    if not context_items:
        return ""

    context_blocks: List[str] = []
    for idx, c in enumerate(context_items, start=1):
        header_bits = []
        if c.source:
            header_bits.append(str(c.source))
        if c.jurisdiction:
            header_bits.append(f"[{c.jurisdiction}]")
        header = " ".join(header_bits) if header_bits else f"Source {idx}"

        context_blocks.append(f"{header}\n{c.snippet}")

    return "\n\n---\n\n".join(context_blocks)


def _derive_jurisdiction(
    decision: Optional[Dict[str, Any]],
    artifacts: List[ComplianceArtifact],
) -> Optional[str]:
    if decision:
        for key in ("state", "jurisdiction", "ship_to_state"):
            value = decision.get(key)
            if value:
                return value

    for artifact in artifacts:
        if artifact.jurisdiction:
            return artifact.jurisdiction

    return None


def _build_decision_summary(
    decision: Optional[Dict[str, Any]],
    artifact_labels: List[str],
) -> str:
    if not decision and not artifact_labels:
        return ""

    parts: List[str] = []

    if decision:
        status = decision.get("status")
        if status:
            parts.append(f"status: {status}")

        reason = decision.get("reason")
        if reason:
            parts.append(f"reason: {reason}")

        missing = decision.get("missing_fields")
        if missing:
            parts.append("missing_fields: " + ", ".join(map(str, missing)))

        form_context = decision.get("form") or decision.get("csf_context") or {}
        for key in (
            "facility_name",
            "practitioner_name",
            "ship_to_state",
            "dea_number",
            "state_license_number",
        ):
            value = form_context.get(key) or decision.get(key)
            if value:
                parts.append(f"{key}: {value}")

    if artifact_labels:
        parts.append(f"artifacts: {', '.join(artifact_labels)}")

    return " | ".join(parts)


def _real_rag_answer(
    payload: RegulatoryRagRequestModel,
    artifacts: List[ComplianceArtifact],
) -> RegulatoryRagAnswer:
    """
    Real RAG implementation for regulatory explanations.

    - Prefer chunks from the `autocomply_regulatory_docs` Chroma collection
    - Fall back to the existing artifact/rule-based context
    """
    jurisdiction = _derive_jurisdiction(payload.decision, artifacts)
    artifact_labels = [a.name for a in artifacts if a.name]

    decision_summary = _build_decision_summary(
        payload.decision,
        artifact_labels,
    )

    query_parts: List[str] = []
    if jurisdiction:
        query_parts.append(f"jurisdiction: {jurisdiction}")
    if decision_summary:
        query_parts.append(decision_summary)
    query_parts.append(payload.question)
    rag_query = " | ".join(part for part in query_parts if part)

    vector_chunks: List[RetrievedRegulatoryChunk] = retrieve_regulatory_chunks(
        rag_query,
        k=6,
    )

    vector_context_items = _vector_chunks_to_context(
        vector_chunks,
        jurisdiction,
    )
    vector_sources = _vector_chunks_to_sources(
        vector_chunks,
        jurisdiction,
    )
    artifact_context_items = _build_artifact_context_items(artifacts)
    artifact_sources = _build_artifact_sources(artifacts)
    full_context_items: List[RegulatoryContextItem] = vector_context_items + (
        artifact_context_items or []
    )
    sources: List[RegulatorySource] = vector_sources + artifact_sources
    context_text = _format_context_blocks(full_context_items)

    decision_snippet = ""
    if payload.decision:
        decision_snippet = f"Engine decision JSON:\n{payload.decision}\n"

    system_prompt = (
        "You are an expert in US healthcare regulatory compliance, "
        "with a focus on controlled substances, state licenses, and "
        "distributor responsibilities. Explain the decision clearly, "
        "citing the relevant rules in natural language."
    )

    user_prompt = f"""You are explaining a compliance decision to an internal support agent.

Decision summary:
{decision_summary or '(no decision summary provided)'}

Regulatory context:
{context_text or '(no additional regulatory documents were found, fall back to general rules.)'}

Question from the agent:
{payload.question}

Write a concise, well-structured explanation that:
- Clearly states whether the decision allows or blocks shipment, and why.
- References relevant jurisdictions (e.g., states, federal agencies like DEA).
- Mentions any key forms or licenses (e.g., Ohio TDDD, CSF, DEA registration) that drive the decision.
- Uses plain language suitable for frontline support teams.
"""

    client = OpenAI()
    completion = client.responses.create(
        model=os.getenv("AUTOCOMPLY_RAG_MODEL", "gpt-4.1-mini"),
        input=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
    )

    answer_text = getattr(completion, "output_text", str(completion))

    return RegulatoryRagAnswer(
        answer=answer_text,
        regulatory_references=payload.regulatory_references,
        artifacts_used=[a.id for a in artifacts],
        sources=sources,
        debug={
            "mode": "rag",
            "rag_query": rag_query,
            "vector_chunks": len(vector_chunks),
            "artifact_context": len(artifact_context_items),
            "context_items": [c.model_dump() for c in full_context_items],
        },
    )


def regulatory_rag_explain(payload: RegulatoryRagRequestModel) -> RegulatoryRagAnswer:
    """
    Entry point used by the FastAPI route.

    - Resolves artifacts by regulatory_references.
    - If AUTOCOMPLY_ENABLE_RAG=1 and RAG dependencies are available, runs real RAG.
    - Otherwise returns a deterministic stub answer that still echoes artifacts.
    """

    artifacts = _lookup_artifacts(payload.regulatory_references)

    if USE_REAL_RAG and HAVE_RAG_DEPENDENCIES:
        return _real_rag_answer(payload, artifacts)

    # Stubbed answer (safe for CI and environments without LangChain/OpenAI key)
    artifact_labels = ", ".join(
        f"{a.id} ({a.name})" for a in artifacts
    ) or "none"

    # Include question so it's easy to see in logs/tests
    stub_answer = (
        "Regulatory RAG offline stub. In a full environment this endpoint "
        "would retrieve content from the following artifacts and answer the "
        f"question.\n\nArtifacts: {artifact_labels}\n\nQuestion: {payload.question}"
    )

    return RegulatoryRagAnswer(
        answer=stub_answer,
        regulatory_references=payload.regulatory_references,
        artifacts_used=[a.id for a in artifacts],
        sources=_build_artifact_sources(artifacts),
        debug={
            "mode": "stub",
            "have_rag_dependencies": HAVE_RAG_DEPENDENCIES,
            "use_real_rag_flag": USE_REAL_RAG,
        },
    )


def explain_csf_practitioner_decision(
    decision: Optional[Dict[str, Any]],
    question: str,
    regulatory_references: Optional[List[str]] = None,
) -> RegulatoryRagAnswer:
    """
    Uses regulatory RAG to explain the practitioner CSF decision.

    Builds a decision-aware query that includes status, rationale, missing fields,
    and available facility/practitioner/jurisdiction context before delegating to
    the generic regulatory RAG pipeline.
    """

    regulatory_references = regulatory_references or []
    decision = decision or {}

    # Normalize core references; if nothing provided, default to the primary form id.
    references = regulatory_references or decision.get("regulatory_references") or [
        "csf_practitioner_form"
    ]

    # Preserve any incoming decision fields and explicitly surface CSF context so it
    # can be reflected in the RAG query and prompt.
    form_context = decision.get("form") or {}
    csf_context = {
        key: value
        for key, value in {
            "facility_name": form_context.get("facility_name"),
            "practitioner_name": form_context.get("practitioner_name"),
            "ship_to_state": form_context.get("ship_to_state"),
            "dea_number": form_context.get("dea_number"),
            "state_license_number": form_context.get("state_license_number"),
        }.items()
        if value
    }

    enriched_decision: Dict[str, Any] = {**decision}
    if csf_context:
        enriched_decision["csf_context"] = csf_context

    rag_request = RegulatoryRagRequestModel(
        question=question,
        regulatory_references=references,
        decision=enriched_decision,
    )

    return regulatory_rag_explain(rag_request)


def explain_csf_facility_decision(
    decision: Optional[Dict[str, Any]],
    question: str,
    regulatory_references: Optional[List[str]] = None,
) -> RegulatoryRagAnswer:
    """Use regulatory RAG to explain a Facility CSF decision."""

    regulatory_references = regulatory_references or []
    decision = decision or {}

    references = regulatory_references or decision.get("regulatory_references") or [
        "csf_facility_form"
    ]

    rag_request = RegulatoryRagRequestModel(
        question=question,
        regulatory_references=references,
        decision=decision,
    )

    return regulatory_rag_explain(rag_request)


def explain_csf_hospital_decision(
    decision: Optional[Dict[str, Any]],
    question: str,
    regulatory_references: Optional[List[str]] = None,
) -> RegulatoryRagAnswer:
    """Use regulatory RAG to explain a Hospital CSF decision."""

    regulatory_references = regulatory_references or []
    decision = decision or {}

    references = regulatory_references or decision.get("regulatory_references") or [
        "csf_hospital_form"
    ]

    rag_request = RegulatoryRagRequestModel(
        question=question,
        regulatory_references=references,
        decision=decision,
    )

    return regulatory_rag_explain(rag_request)
