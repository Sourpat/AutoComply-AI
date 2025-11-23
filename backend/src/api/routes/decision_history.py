from __future__ import annotations

from typing import List

from fastapi import APIRouter, Query

from src.domain.decision_history import (
    DecisionSnapshotIn,
    DecisionRecord,
    get_recent_decisions,
    record_decision,
)

router = APIRouter(prefix="/decisions", tags=["decisions"])


@router.post("/history", response_model=DecisionRecord)
def create_decision_snapshot(payload: DecisionSnapshotIn) -> DecisionRecord:
    """
    Store a snapshot of a decision for history / DevSupport purposes.

    In-memory only; suitable for sandbox and demo environments.
    """
    return record_decision(payload)


@router.get("/history", response_model=List[DecisionRecord])
def list_decision_history(
    limit: int = Query(20, ge=1, le=100),
) -> List[DecisionRecord]:
    """
    Return the most recent decision snapshots, newest first.
    """
    return get_recent_decisions(limit=limit)
