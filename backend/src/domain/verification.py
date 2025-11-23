from __future__ import annotations

from datetime import datetime, timezone
from threading import Lock
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field
import uuid


class VerificationStatus(str):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    RESOLVED = "resolved"


class VerificationRequestIn(BaseModel):
    """
    Payload sent when a decision needs human verification.

    This is deliberately generic so all engines (CSF, Ohio, PDMA, etc.)
    can use the same structure.
    """

    engine_family: str  # e.g. "csf", "ohio_tddd", "pdma"
    decision_type: str  # e.g. "csf_practitioner", "ohio_tddd", "pdma_sample"
    jurisdiction: Optional[str] = None

    reason_for_review: str  # e.g. "manual_review", "gov_account", etc.
    decision_snapshot_id: Optional[str] = None

    regulatory_reference_ids: List[str] = Field(default_factory=list)
    # /mnt/data/... paths; treated as URLs by the runtime
    source_documents: List[str] = Field(default_factory=list)

    # Optional question or context from user / UI
    user_question: Optional[str] = None
    channel: Optional[str] = None  # e.g. "web_sandbox", "api", "batch"

    # Arbitrary JSON – typically { form, decision, explain_short?, rag_answer? }
    payload: Dict[str, Any] = Field(default_factory=dict)


class VerificationRequest(VerificationRequestIn):
    id: str
    created_at: str  # ISO 8601 UTC
    status: str = VerificationStatus.PENDING


_lock = Lock()
_requests: List[VerificationRequest] = []
_MAX_REQUESTS = 200


def create_verification_request(data: VerificationRequestIn) -> VerificationRequest:
    req = VerificationRequest(
        id=str(uuid.uuid4()),
        created_at=datetime.now(timezone.utc).isoformat(),
        status=VerificationStatus.PENDING,
        **data.model_dump(),
    )

    with _lock:
        _requests.append(req)
        if len(_requests) > _MAX_REQUESTS:
            del _requests[:-_MAX_REQUESTS]

    return req


def list_verification_requests(
    status: Optional[str] = None, limit: int = 50
) -> List[VerificationRequest]:
    with _lock:
        items = list(reversed(_requests))  # newest first
        if status:
            items = [r for r in items if r.status == status]
        return items[:limit]
