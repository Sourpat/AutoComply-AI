from __future__ import annotations

from typing import List, Literal

from pydantic import BaseModel

from src.api.models.decision import DecisionAuditEntryModel, DecisionStatus


RiskLevel = Literal["low", "medium", "high", "mixed"]


class DecisionInsight(BaseModel):
    trace_id: str
    overall_status: DecisionStatus
    overall_risk: RiskLevel
    summary: str
    recommendations: list[str]


def _pick_overall_status(entries: List[DecisionAuditEntryModel]) -> DecisionStatus:
    # Simple priority: blocked > needs_review > ok_to_ship
    for status in (
        DecisionStatus.BLOCKED,
        DecisionStatus.NEEDS_REVIEW,
        DecisionStatus.OK_TO_SHIP,
    ):
        if any(e.decision.status == status for e in entries):
            return status
    # Fallback:
    return DecisionStatus.OK_TO_SHIP


def _pick_overall_risk(entries: List[DecisionAuditEntryModel]) -> RiskLevel:
    levels = {(e.decision.risk_level or "").lower() for e in entries}
    levels.discard("")

    if not levels:
        return "low"
    if len(levels) > 1:
        return "mixed"
    level = next(iter(levels))
    if level in {"low", "medium", "high"}:
        return level  # type: ignore[return-value]
    return "mixed"


def generate_decision_insight(
    trace_id: str, entries: List[DecisionAuditEntryModel]
) -> DecisionInsight:
    overall_status = _pick_overall_status(entries)
    overall_risk: RiskLevel = _pick_overall_risk(entries)

    # Build a short summary
    parts = []
    parts.append(f"Found {len(entries)} decision(s) for trace {trace_id}.")

    families = {e.engine_family for e in entries}
    if "csf" in families:
        parts.append("CSF evaluation was performed.")
    if "license" in families:
        parts.append("License checks were evaluated.")
    if "order" in families:
        parts.append("An order-level decision was produced.")

    parts.append(f"Overall status is {overall_status.value!r} with {overall_risk} risk.")

    summary = " ".join(parts)

    # Recommendations based on status / risk
    recs: list[str] = []
    if overall_status == DecisionStatus.BLOCKED:
        recs.append(
            "Review blocked decisions, focusing on license expiry, DEA mismatches, or invalid ship-to states."
        )
    if overall_status == DecisionStatus.NEEDS_REVIEW:
        recs.append(
            "Investigate decisions marked as 'needs_review', especially state mismatches or missing information."
        )
    if overall_risk in {"medium", "high", "mixed"}:
        recs.append(
            "Consider escalating this trace to a compliance specialist before shipping controlled substances."
        )
    if overall_status == DecisionStatus.OK_TO_SHIP and overall_risk == "low":
        recs.append(
            "No immediate blockers detected; proceed while maintaining routine audit review."
        )
    if not recs:
        recs.append("No specific recommendations; review decisions as per standard procedures.")

    return DecisionInsight(
        trace_id=trace_id,
        overall_status=overall_status,
        overall_risk=overall_risk,
        summary=summary,
        recommendations=recs,
    )
