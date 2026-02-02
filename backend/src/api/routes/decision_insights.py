from __future__ import annotations

from typing import List

from fastapi import APIRouter, HTTPException

from src.api.models.decision import DecisionAuditEntryModel
from src.autocomply.audit.decision_log import get_decision_log
from src.policy.contracts import get_active_contract
from src.autocomply.insights.decision_insights import (
    DecisionInsight,
    generate_decision_insight,
)

router = APIRouter(prefix="/ai/decisions", tags=["ai-decisions"])


@router.get("/insights/{trace_id}", response_model=DecisionInsight)
async def get_decision_insights(trace_id: str) -> DecisionInsight:
    log = get_decision_log()
    entries = log.get_entries_for_trace(trace_id)

    active_contract = get_active_contract()
    active_version = active_contract.version if active_contract else None

    if not entries:
        raise HTTPException(status_code=404, detail="No decisions found for this trace_id")

    models: List[DecisionAuditEntryModel] = []
    for entry in entries:
        used_version = entry.policy_contract_version_used
        drift = (
            bool(used_version and active_version and used_version != active_version)
            if used_version or active_version
            else None
        )
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
                policy_contract_version_used=used_version,
                policy_contract_version_active=active_version,
                policy_drift=drift,
            )
        )

    return generate_decision_insight(trace_id=trace_id, entries=models)
