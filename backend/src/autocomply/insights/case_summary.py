from __future__ import annotations

from typing import List, Set

from pydantic import BaseModel

from src.api.models.compliance_models import RegulatorySource
from src.api.models.decision import DecisionAuditEntryModel, DecisionStatus
from src.autocomply.audit.decision_log import get_decision_log
from src.autocomply.insights.decision_insights import (
    DecisionInsight,
    generate_decision_insight,
)
from src.autocomply.regulations.knowledge import get_regulatory_knowledge


class CaseDecisionSummary(BaseModel):
    """
    Flattened view of a single engine decision in a case.
    Useful for UI + external integrations.
    """

    engine_family: str
    decision_type: str
    status: DecisionStatus
    reason: str
    risk_level: str | None = None
    trace_id: str | None = None


class ComplianceCaseSummary(BaseModel):
    """
    Canonical per-trace summary that can be consumed by
    checkout pipelines, n8n flows, or external systems.
    """

    trace_id: str
    overall_status: DecisionStatus
    overall_risk: str
    decisions: List[CaseDecisionSummary]
    regulatory_references: List[str]
    rag_sources: List[RegulatorySource]
    insight: DecisionInsight


def _pick_overall_status(entries: list[DecisionAuditEntryModel]) -> DecisionStatus:
    # Priority: blocked > needs_review > ok_to_ship
    for status in (
        DecisionStatus.BLOCKED,
        DecisionStatus.NEEDS_REVIEW,
        DecisionStatus.OK_TO_SHIP,
    ):
        if any(e.decision.status == status for e in entries):
            return status
    # Fallback
    return DecisionStatus.OK_TO_SHIP


def _pick_overall_risk(entries: list[DecisionAuditEntryModel]) -> str:
    levels: Set[str] = set((e.decision.risk_level or "").lower() for e in entries)
    levels.discard("")
    if not levels:
        return "low"
    if len(levels) == 1:
        return next(iter(levels))
    return "mixed"


def _to_models(entries: list) -> list[DecisionAuditEntryModel]:
    models: list[DecisionAuditEntryModel] = []
    for entry in entries:
        models.append(
            DecisionAuditEntryModel(
                trace_id=entry.trace_id,
                engine_family=entry.engine_family,
                decision_type=entry.decision_type,
                status=entry.status,
                reason=entry.reason,
                risk_level=entry.risk_level,
                created_at=getattr(entry.created_at, "isoformat", lambda: "")(),
                decision=entry.decision,
            )
        )
    return models


def build_case_summary(trace_id: str) -> ComplianceCaseSummary:
    log = get_decision_log()
    raw_entries = log.get_entries_for_trace(trace_id)

    if not raw_entries:
        raise ValueError(f"No decisions found for trace_id={trace_id!r}")

    entries = _to_models(raw_entries)

    # Overall status + risk
    overall_status = _pick_overall_status(entries)
    overall_risk = _pick_overall_risk(entries)

    # Flatten per-decision summaries
    decisions: list[CaseDecisionSummary] = []
    for e in entries:
        decisions.append(
            CaseDecisionSummary(
                engine_family=e.engine_family,
                decision_type=e.decision_type,
                status=e.decision.status,
                reason=e.decision.reason,
                risk_level=e.decision.risk_level,
                trace_id=e.decision.trace_id,
            )
        )

    # Aggregate regulatory references from all decisions (if they expose them)
    all_refs: Set[str] = set()
    # Aggregate sources using RegulatoryKnowledge as the single source of truth
    knowledge = get_regulatory_knowledge()
    all_sources: dict[str, RegulatorySource] = {}

    for e in entries:
        refs = getattr(e.decision, "regulatory_references", None) or []
        for ref in refs:
            ref_id = getattr(ref, "id", None) if not isinstance(ref, str) else ref
            if ref_id:
                all_refs.add(str(ref_id))

    # If no explicit refs, you can optionally infer based on engine_family/decision_type:
    if not all_refs:
        for e in entries:
            sources_for_engine = knowledge.get_context_for_engine(
                engine_family=e.engine_family,
                decision_type=e.decision_type,
            )
            for src in sources_for_engine:
                if src.id:
                    all_refs.add(src.id)
                    all_sources[src.id] = src

    # If refs exist, map them to sources via knowledge
    if all_refs:
        sources_from_refs = knowledge.get_sources_for_doc_ids(sorted(all_refs))
        for src in sources_from_refs:
            if src.id:
                all_sources[src.id] = src

    regulatory_references = sorted(all_refs)
    rag_sources = list(all_sources.values())

    # Build the insight (reuses existing logic)
    insight = generate_decision_insight(trace_id=trace_id, entries=entries)

    return ComplianceCaseSummary(
        trace_id=trace_id,
        overall_status=overall_status,
        overall_risk=overall_risk,
        decisions=decisions,
        regulatory_references=regulatory_references,
        rag_sources=rag_sources,
        insight=insight,
    )
