from __future__ import annotations

from typing import List

from fastapi import APIRouter, HTTPException

from src.api.models.decision import DecisionAuditEntryModel
from src.autocomply.audit.decision_log import get_decision_log
from src.autocomply.insights.decision_insights import (
    DecisionInsight,
    generate_decision_insight,
)

router = APIRouter(prefix="/ai/decisions", tags=["ai-decisions"])


@router.get("/insights/{trace_id}", response_model=DecisionInsight)
async def get_decision_insights(trace_id: str) -> DecisionInsight:
    log = get_decision_log()
    entries = log.get_entries_for_trace(trace_id)

    if not entries:
        raise HTTPException(status_code=404, detail="No decisions found for this trace_id")

    models: List[DecisionAuditEntryModel] = []
    for entry in entries:
        models.append(
            DecisionAuditEntryModel(
                trace_id=entry.trace_id,
                engine_family=entry.engine_family,
                decision_type=entry.decision_type,
                status=entry.status,
                reason=entry.reason,
                risk_level=entry.risk_level,
                created_at=entry.created_at.isoformat(),
                decision=entry.decision,
            )
        )

    return generate_decision_insight(trace_id=trace_id, entries=models)
