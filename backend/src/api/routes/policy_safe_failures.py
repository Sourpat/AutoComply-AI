from __future__ import annotations

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Query
from pydantic import BaseModel

from src.autocomply.audit.decision_log import get_decision_log

router = APIRouter(prefix="/api/policy", tags=["policy-safe-failures"])


class SafeFailureSnapshot(BaseModel):
    trace_id: str
    engine_family: str
    decision_type: str
    created_at: str
    decision_status: str
    safe_failure: Dict[str, Any]
    policy_trace: Optional[Dict[str, Any]] = None


class SafeFailureTraceResponse(BaseModel):
    trace_id: str
    safe_failure: Optional[Dict[str, Any]] = None
    policy_trace: Optional[Dict[str, Any]] = None


@router.get("/safe-failures/recent", response_model=List[SafeFailureSnapshot])
async def list_recent_safe_failures(limit: int = Query(25, ge=1, le=200)) -> List[SafeFailureSnapshot]:
    log = get_decision_log()
    entries = []
    for trace_entries in log._by_trace.values():
        for entry in trace_entries:
            safe_failure = getattr(entry.decision, "safe_failure", None)
            if safe_failure:
                entries.append(entry)

    entries.sort(key=lambda item: item.created_at, reverse=True)
    entries = entries[:limit]

    snapshots: List[SafeFailureSnapshot] = []
    for entry in entries:
        safe_failure = getattr(entry.decision, "safe_failure", None)
        if not safe_failure:
            continue
        snapshots.append(
            SafeFailureSnapshot(
                trace_id=entry.trace_id,
                engine_family=entry.engine_family,
                decision_type=entry.decision_type,
                created_at=entry.created_at.isoformat(),
                decision_status=entry.status,
                safe_failure=safe_failure,
                policy_trace=getattr(entry.decision, "policy_trace", None),
            )
        )

    return snapshots


@router.get("/safe-failures/{trace_id}", response_model=SafeFailureTraceResponse)
async def get_safe_failure_for_trace(trace_id: str) -> SafeFailureTraceResponse:
    log = get_decision_log()
    entries = log.get_by_trace(trace_id)

    if not entries:
        return SafeFailureTraceResponse(trace_id=trace_id)

    for entry in reversed(entries):
        safe_failure = getattr(entry.decision, "safe_failure", None)
        if safe_failure:
            return SafeFailureTraceResponse(
                trace_id=trace_id,
                safe_failure=safe_failure,
                policy_trace=getattr(entry.decision, "policy_trace", None),
            )

    return SafeFailureTraceResponse(trace_id=trace_id)
