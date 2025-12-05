from __future__ import annotations

from typing import List

from fastapi import APIRouter

from src.autocomply.audit.decision_log import get_decision_log
from src.api.models.decision import DecisionAuditEntryModel

router = APIRouter()


@router.get("/decisions/trace/{trace_id}", response_model=List[DecisionAuditEntryModel])
async def get_decisions_for_trace(trace_id: str) -> List[DecisionAuditEntryModel]:
    """
    Return all recorded decisions for a given trace_id, in the order they were logged.

    This allows consumers (UIs, n8n, agents) to reconstruct the full CSF + license + order
    journey for a specific trace.
    """
    log = get_decision_log()
    entries = log.get_by_trace(trace_id)

    if not entries:
        return []

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
    return models
