from __future__ import annotations

from datetime import datetime, timezone
from threading import Lock
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field
import uuid


class DecisionSnapshotIn(BaseModel):
    """
    Snapshot payload sent by UI/agents when a decision is made.

    This is intentionally generic so we can reuse it for CSF, Ohio, PDMA,
    and any future engines.
    """

    engine_family: str  # e.g. "csf", "ohio_tddd", "pdma"
    decision_type: str  # e.g. "csf_practitioner", "ohio_tddd", "pdma_sample"
    status: str  # engine-specific status string
    jurisdiction: Optional[str] = None

    regulatory_reference_ids: List[str] = Field(default_factory=list)
    # /mnt/data/... paths; treated as URLs by the runtime
    source_documents: List[str] = Field(default_factory=list)

    # Arbitrary JSON; typically { form, verdict } or { decision, explanation }
    payload: Dict[str, Any] = Field(default_factory=dict)


class DecisionRecord(DecisionSnapshotIn):
    id: str
    timestamp: str  # ISO 8601 UTC


_lock = Lock()
_records: List[DecisionRecord] = []
_MAX_RECORDS = 200


def record_decision(snapshot: DecisionSnapshotIn) -> DecisionRecord:
    record = DecisionRecord(
        id=str(uuid.uuid4()),
        timestamp=datetime.now(timezone.utc).isoformat(),
        **snapshot.model_dump(),
    )

    with _lock:
        _records.append(record)
        if len(_records) > _MAX_RECORDS:
            # Keep only the most recent N
            del _records[:-_MAX_RECORDS]

    return record


def get_recent_decisions(limit: int = 20) -> List[DecisionRecord]:
    with _lock:
        # newest first
        return list(reversed(_records))[:limit]
