from __future__ import annotations

import os
from datetime import datetime, timezone
import uuid
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, ConfigDict, Field

from src.autocomply.domain.submissions_store import (
    SubmissionStatus,
    SubmissionStore,
    get_submission_store,
    set_submission_status,
)
from src.autocomply.domain.verifier_store import (
    add_note,
    get_case_by_submission_id,
    get_or_create_case_for_submission,
)
from src.config import get_settings

router = APIRouter(prefix="/api/submitter", tags=["submitter"])


class SubmitterAttachment(BaseModel):
    name: str
    content_type: str | None = None
    size_bytes: int | None = None
    metadata: dict | None = None


class SubmitterSubmissionRequest(BaseModel):
    model_config = ConfigDict(extra="allow")

    submission_id: str | None = None
    client_token: str | None = None
    subject: str | None = None
    submitter_name: str | None = None
    jurisdiction: str | None = None
    doc_type: str | None = None
    notes: str | None = None
    attachments: List[SubmitterAttachment] = Field(default_factory=list)


class SubmitterSubmissionResponse(BaseModel):
    submission_id: str
    verifier_case_id: str
    status: str


class SubmitterRespondRequest(BaseModel):
    message: str | None = None


def _ensure_allowed() -> None:
    settings = get_settings()
    env_marker = os.getenv("ENV", "").lower()
    if env_marker == "ci":
        return
    if settings.APP_ENV.lower() == "dev":
        return
    raise HTTPException(status_code=403, detail="Submitter submissions disabled")


def _find_existing_submission(store: SubmissionStore, payload: SubmitterSubmissionRequest):
    if payload.submission_id:
        existing = store.get_submission(payload.submission_id)
        if existing:
            return existing
    if payload.client_token:
        existing = store.get_submission_by_client_token(payload.client_token)
        if existing:
            return existing
    return None


@router.post("/submissions", response_model=SubmitterSubmissionResponse)
def create_submitter_submission(payload: SubmitterSubmissionRequest) -> SubmitterSubmissionResponse:
    _ensure_allowed()

    store = get_submission_store()
    existing = _find_existing_submission(store, payload)
    if existing:
        case = get_or_create_case_for_submission(
            existing.submission_id,
            jurisdiction=payload.jurisdiction,
            summary=payload.subject or f"Submission {existing.submission_id}",
        )
        return SubmitterSubmissionResponse(
            submission_id=existing.submission_id,
            verifier_case_id=case["case_id"],
            status=case["status"],
        )

    submission_id = payload.submission_id or str(uuid.uuid4())
    subject = payload.subject or f"Submission {submission_id}"
    doc_type = payload.doc_type or "submitter"
    tenant = payload.jurisdiction or "unknown"
    submission_payload: Dict[str, Any] = {
        "subject": subject,
        "submitter_name": payload.submitter_name,
        "jurisdiction": payload.jurisdiction,
        "doc_type": doc_type,
        "notes": payload.notes,
        "attachments": [item.model_dump() for item in payload.attachments],
        "client_token": payload.client_token,
    }

    submission = store.create_submission(
        csf_type=doc_type,
        tenant=tenant,
        title=subject,
        subtitle=doc_type,
        trace_id=f"submitter-{submission_id}",
        payload=submission_payload,
        summary=payload.notes,
        submission_id=submission_id,
        client_token=payload.client_token,
    )

    case = get_or_create_case_for_submission(
        submission.submission_id,
        jurisdiction=payload.jurisdiction,
        summary=subject,
    )

    return SubmitterSubmissionResponse(
        submission_id=submission.submission_id,
        verifier_case_id=case["case_id"],
        status=case["status"],
    )


@router.get("/submissions")
def list_submitter_submissions(
    status: str | None = Query(None),
    limit: int = Query(50, ge=1, le=200),
) -> list[dict]:
    _ensure_allowed()
    store = get_submission_store()
    statuses = None
    if status:
        try:
            statuses = [SubmissionStatus(status)]
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid status")
    submissions = store.list_submissions(status=statuses, limit=limit)
    return [submission.model_dump() for submission in submissions]


@router.get("/submissions/{submission_id}")
def get_submitter_submission(submission_id: str) -> dict:
    _ensure_allowed()
    store = get_submission_store()
    submission = store.get_submission(submission_id)
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")
    return submission.model_dump()


@router.post("/submissions/{submission_id}/respond")
def respond_submitter_submission(
    submission_id: str,
    payload: SubmitterRespondRequest,
) -> dict:
    _ensure_allowed()
    store = get_submission_store()
    submission = store.get_submission(submission_id)
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")

    responses = submission.payload.get("responses") if isinstance(submission.payload, dict) else None
    if responses is None:
        responses = []
    responses.append(
        {
            "message": payload.message,
            "responded_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        }
    )
    submission.payload["responses"] = responses

    if payload.message:
        case = get_case_by_submission_id(submission_id)
        if case:
            try:
                add_note(case["case_id"], payload.message, actor="submitter")
            except ValueError:
                pass

    if submission.status == SubmissionStatus.NEEDS_INFO:
        set_submission_status(submission_id, SubmissionStatus.SUBMITTED, "submitter")

    return submission.model_dump()
