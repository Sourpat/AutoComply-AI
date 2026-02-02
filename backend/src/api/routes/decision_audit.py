from __future__ import annotations

from typing import List

from fastapi import APIRouter

from src.autocomply.audit.decision_log import get_decision_log
from src.api.models.decision import DecisionAuditEntryModel
from src.policy.contracts import get_active_contract

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

    active_contract = get_active_contract()
    active_version = active_contract.version if active_contract else None

    if not entries:
        return []

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
                event_type=getattr(entry, "event_type", None),
                trace_id=entry.trace_id,
                engine_family=entry.engine_family,
                decision_type=entry.decision_type,
                status=entry.status,
                reason=entry.reason,
                risk_level=entry.risk_level,
                created_at=entry.created_at.isoformat(),
                decision=entry.decision,
                override=getattr(entry, "override", None),
                policy_contract_version_used=used_version,
                policy_contract_version_active=active_version,
                policy_drift=drift,
            )
        )
    return models
