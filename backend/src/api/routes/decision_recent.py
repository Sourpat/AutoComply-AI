from datetime import datetime

from fastapi import APIRouter, Query
from pydantic import BaseModel

from src.autocomply.audit.decision_log import (
    DecisionTraceSummary,
    get_decision_log,
)

router = APIRouter(prefix="/decisions", tags=["decisions"])


class DecisionTraceSummaryResponse(BaseModel):
    trace_id: str
    last_updated: datetime
    last_status: str
    engine_families: list[str]


@router.get("/recent", response_model=list[DecisionTraceSummaryResponse])
async def list_recent_decisions(
    limit: int = Query(20, ge=1, le=100),
) -> list[DecisionTraceSummaryResponse]:
    """
    Return the most recent decision traces for observability & debugging.
    """
    log = get_decision_log()
    summaries = log.get_recent_traces(limit=limit)

    return [
        DecisionTraceSummaryResponse(
            trace_id=s.trace_id,
            last_updated=s.last_updated,
            last_status=s.last_status.value
            if hasattr(s.last_status, "value")
            else str(s.last_status),
            engine_families=s.engine_families,
        )
        for s in summaries
    ]
