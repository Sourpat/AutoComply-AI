import os
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Query, Response
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from pydantic import AliasChoices, ConfigDict

from src.autocomply.domain.decision_packet import build_decision_packet
from src.autocomply.domain.attachments_store import get_attachment, list_attachments_for_submission
from src.autocomply.domain.audit_zip import (
    build_audit_manifest_and_files,
    build_audit_zip_bundle,
)
from src.autocomply.domain.submissions_store import (
    SubmissionStatus,
    get_submission_store,
    set_submission_status,
)
from src.autocomply.domain.packet_pdf import render_decision_packet_pdf
from src.autocomply.domain.verifier_store import (
    add_action,
    add_note,
    assign_case,
    bulk_action,
    bulk_assign,
    get_final_packet,
    get_case,
    list_cases,
    list_events,
    list_notes,
    set_case_decision,
    write_final_packet,
)

router = APIRouter(prefix="/api/verifier", tags=["verifier"])


class VerifierCase(BaseModel):
    case_id: str
    submission_id: str | None = None
    status: str
    submission_status: str | None = None
    jurisdiction: str | None = None
    assignee: str | None = None
    assigned_at: str | None = None
    locked: bool = False
    decision: dict | None = None
    created_at: str
    updated_at: str
    summary: str
    submission_summary: dict | None = None
    request_info: dict | None = None


class VerifierEvent(BaseModel):
    id: int
    case_id: str
    event_type: str
    payload_json: str
    created_at: str


class VerifierNote(BaseModel):
    id: int
    case_id: str
    note: str
    actor: str | None = None
    created_at: str


class VerifierCasesResponse(BaseModel):
    items: list[VerifierCase]
    limit: int
    offset: int
    count: int


class VerifierCaseDetailResponse(BaseModel):
    case: VerifierCase
    events: list[VerifierEvent]
    notes: list[VerifierNote]


class VerifierActionRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    action: str = Field(
        ..., validation_alias=AliasChoices("action", "type"), description="approve|reject|needs_review|triage"
    )
    actor: str | None = None
    reason: str | None = None
    payload: dict | None = None


class VerifierActionResponse(BaseModel):
    case: VerifierCase
    event: VerifierEvent


class VerifierNoteRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    note: str = Field(..., validation_alias=AliasChoices("note", "text"))
    actor: str | None = None


class VerifierNoteResponse(BaseModel):
    note: VerifierNote
    event: VerifierEvent


class VerifierAssignmentRequest(BaseModel):
    assignee: str | None = None
    actor: str | None = None


class VerifierBulkActionRequest(BaseModel):
    case_ids: list[str]
    action: str = Field(..., description="approve|reject|needs_review")
    actor: str | None = None
    reason: str | None = None


class VerifierBulkAssignRequest(BaseModel):
    case_ids: list[str]
    assignee: str | None = None
    actor: str | None = None


class VerifierBulkResponse(BaseModel):
    updated_count: int
    failures: list[dict]


class VerifierDecisionRequest(BaseModel):
    type: str = Field(..., description="approve|reject|request_info")
    reason: str | None = None
    actor: str | None = None


async def _resolve_packet_for_case(case_id: str, include_explain: bool) -> dict:
    payload = get_case(case_id)
    if not payload:
        raise HTTPException(status_code=404, detail="Case not found")

    case_row = payload.get("case", {})
    if case_row.get("locked"):
        final_packet = get_final_packet(case_id)
        if final_packet:
            return final_packet

    return await build_decision_packet(
        case_id,
        actor=os.getenv("VERIFIER_DEFAULT_ASSIGNEE", "verifier-1"),
        include_explain=include_explain,
    )


def _build_submission_summary(submission_id: str | None) -> dict | None:
    if not submission_id:
        return None
    store = get_submission_store()
    submission = store.get_submission(submission_id)
    if not submission:
        return None

    payload = submission.payload or {}
    notes = payload.get("notes")
    if isinstance(notes, list):
        notes_count = len([item for item in notes if item])
    else:
        notes_count = 1 if isinstance(notes, str) and notes.strip() else 0
    attachments = payload.get("attachments") or []
    attachment_count = len(attachments) if isinstance(attachments, list) else 0

    attachment_records = list_attachments_for_submission(submission_id)
    if attachment_records:
        attachment_count = len(attachment_records)

    return {
        "submitter_name": payload.get("submitter_name") or payload.get("subject") or submission.title,
        "created_at": submission.created_at,
        "notes_count": notes_count,
        "attachment_count": attachment_count,
        "status": submission.status,
        "request_info": submission.request_info,
    }


@router.get("/cases", response_model=VerifierCasesResponse)
def list_verifier_cases(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    status: str | None = Query(None),
    jurisdiction: str | None = Query(None),
    assignee: str | None = Query(None),
    submission_status: str | None = Query(None),
) -> dict:
    assignee_filter = assignee
    if assignee == "me":
        assignee_filter = os.getenv("VERIFIER_DEFAULT_ASSIGNEE", "verifier-1")
    items, count = list_cases(
        limit=limit,
        offset=offset,
        status=status,
        jurisdiction=jurisdiction,
        assignee=assignee_filter,
    )
    store = get_submission_store()
    filtered_items = []
    for item in items:
        submission_id = item.get("submission_id")
        submission = store.get_submission(submission_id) if submission_id else None
        if submission_status:
            if not submission or submission.status != submission_status:
                continue
        item["submission_status"] = submission.status if submission else None
        item["request_info"] = submission.request_info if submission else None
        item["submission_summary"] = _build_submission_summary(submission_id)
        filtered_items.append(item)
    return {
        "items": filtered_items,
        "limit": limit,
        "offset": offset,
        "count": count,
    }


@router.post("/cases/bulk/actions", response_model=VerifierBulkResponse)
def post_verifier_bulk_action(payload: VerifierBulkActionRequest) -> dict:
    try:
        result = bulk_action(
            payload.case_ids,
            payload.action,
            actor=payload.actor,
            reason=payload.reason,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return result


@router.post("/cases/bulk/assign", response_model=VerifierBulkResponse)
def post_verifier_bulk_assign(payload: VerifierBulkAssignRequest) -> dict:
    result = bulk_assign(payload.case_ids, payload.assignee, actor=payload.actor)
    return result


@router.get("/cases/{case_id}/packet")
async def get_verifier_decision_packet(
    case_id: str,
    include_explain: int = Query(1, ge=0, le=1),
) -> dict:
    try:
        return await _resolve_packet_for_case(case_id, include_explain == 1)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/cases/{case_id}/packet.pdf")
async def get_verifier_decision_packet_pdf(
    case_id: str,
    include_explain: int = Query(1, ge=0, le=1),
) -> Response:
    try:
        packet = await _resolve_packet_for_case(case_id, include_explain == 1)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    pdf_bytes = render_decision_packet_pdf(packet)
    headers = {
        "Content-Disposition": f"attachment; filename=decision-packet-{case_id}.pdf"
    }
    return Response(content=pdf_bytes, media_type="application/pdf", headers=headers)


@router.get("/cases/{case_id}/audit.zip")
async def get_verifier_audit_zip(
    case_id: str,
    include_explain: int = Query(1, ge=0, le=1),
) -> Response:
    payload = get_case(case_id)
    if not payload:
        raise HTTPException(status_code=404, detail="Case not found")
    case_row = payload.get("case", {})
    submission_id = case_row.get("submission_id")
    locked = bool(case_row.get("locked"))

    packet = None
    if locked:
        packet = get_final_packet(case_id)
    if not packet:
        packet = await build_decision_packet(
            case_id,
            actor=os.getenv("VERIFIER_DEFAULT_ASSIGNEE", "verifier-1"),
            include_explain=include_explain == 1,
        )

    try:
        zip_bytes, _manifest = build_audit_zip_bundle(
            packet,
            case_id=case_id,
            submission_id=submission_id,
            locked=locked,
        )
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    headers = {
        "Content-Disposition": f"attachment; filename=audit-packet-{case_id}.zip"
    }
    return Response(content=zip_bytes, media_type="application/zip", headers=headers)


@router.get("/cases/{case_id}/audit/manifest")
async def get_verifier_audit_manifest(
    case_id: str,
    include_explain: int = Query(1, ge=0, le=1),
) -> dict:
    payload = get_case(case_id)
    if not payload:
        raise HTTPException(status_code=404, detail="Case not found")
    case_row = payload.get("case", {})
    submission_id = case_row.get("submission_id")
    locked = bool(case_row.get("locked"))

    packet = None
    if locked:
        packet = get_final_packet(case_id)
    if not packet:
        packet = await build_decision_packet(
            case_id,
            actor=os.getenv("VERIFIER_DEFAULT_ASSIGNEE", "verifier-1"),
            include_explain=include_explain == 1,
        )

    try:
        manifest, _packet_bytes, _evidence = build_audit_manifest_and_files(
            packet,
            case_id=case_id,
            submission_id=submission_id,
            locked=locked,
        )
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return manifest


@router.get("/cases/{case_id}", response_model=VerifierCaseDetailResponse)
def get_verifier_case(case_id: str) -> dict:
    payload = get_case(case_id)
    if not payload:
        raise HTTPException(status_code=404, detail="Case not found")
    submission_id = payload["case"].get("submission_id")
    if submission_id:
        store = get_submission_store()
        submission = store.get_submission(submission_id)
        if submission and submission.status == SubmissionStatus.SUBMITTED:
            set_submission_status(submission_id, SubmissionStatus.IN_REVIEW, "verifier")
            submission = store.get_submission(submission_id)
        payload["case"]["submission_status"] = submission.status if submission else None
        payload["case"]["request_info"] = submission.request_info if submission else None
    payload["case"]["submission_summary"] = _build_submission_summary(submission_id)
    return payload


@router.get("/cases/{case_id}/submission")
def get_verifier_case_submission(case_id: str) -> dict:
    payload = get_case(case_id)
    if not payload:
        raise HTTPException(status_code=404, detail="Case not found")
    submission_id = payload["case"].get("submission_id")
    if not submission_id:
        raise HTTPException(status_code=404, detail="Submission not linked")
    store = get_submission_store()
    submission = store.get_submission(submission_id)
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")
    return submission.model_dump()


@router.get("/cases/{case_id}/attachments")
def list_verifier_case_attachments(case_id: str) -> list[dict]:
    payload = get_case(case_id)
    if not payload:
        raise HTTPException(status_code=404, detail="Case not found")
    submission_id = payload["case"].get("submission_id")
    if not submission_id:
        return []
    return list_attachments_for_submission(submission_id)


@router.get("/attachments/{attachment_id}/download")
def download_verifier_attachment(attachment_id: str) -> FileResponse:
    try:
        record, file_path = get_attachment(attachment_id)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Attachment not found")
    return FileResponse(
        path=str(file_path),
        media_type=record.get("content_type") or "application/octet-stream",
        filename=record.get("filename") or "attachment",
    )


@router.post("/cases/{case_id}/actions", response_model=VerifierActionResponse)
def post_verifier_action(case_id: str, payload: VerifierActionRequest) -> dict:
    try:
        case_row, event_row = add_action(
            case_id,
            payload.action,
            actor=payload.actor,
            reason=payload.reason,
            payload=payload.payload,
        )
    except ValueError as exc:
        status = 409 if str(exc) == "case locked" else 400
        raise HTTPException(status_code=status, detail=str(exc)) from exc

    if not case_row or not event_row:
        raise HTTPException(status_code=404, detail="Case not found")
    return {"case": case_row, "event": event_row}


@router.post("/cases/{case_id}/notes", response_model=VerifierNoteResponse)
def post_verifier_note(case_id: str, payload: VerifierNoteRequest) -> dict:
    try:
        note_row, event_row = add_note(case_id, payload.note, actor=payload.actor)
    except ValueError as exc:
        status = 409 if str(exc) == "case locked" else 400
        raise HTTPException(status_code=status, detail=str(exc)) from exc

    if not note_row or not event_row:
        raise HTTPException(status_code=404, detail="Case not found")
    return {"note": note_row, "event": event_row}


@router.get("/cases/{case_id}/events", response_model=list[VerifierEvent])
def get_verifier_events(case_id: str) -> list[dict]:
    payload = get_case(case_id)
    if not payload:
        raise HTTPException(status_code=404, detail="Case not found")
    return list_events(case_id)


@router.get("/cases/{case_id}/notes", response_model=list[VerifierNote])
def get_verifier_notes(case_id: str) -> list[dict]:
    payload = get_case(case_id)
    if not payload:
        raise HTTPException(status_code=404, detail="Case not found")
    return list_notes(case_id)


@router.patch("/cases/{case_id}/assignment", response_model=VerifierCase)
def patch_verifier_assignment(case_id: str, payload: VerifierAssignmentRequest) -> dict:
    try:
        case_row, _ = assign_case(case_id, payload.assignee, actor=payload.actor)
    except ValueError as exc:
        status = 409 if str(exc) == "case locked" else 400
        raise HTTPException(status_code=status, detail=str(exc)) from exc
    if not case_row:
        raise HTTPException(status_code=404, detail="Case not found")
    submission_id = case_row.get("submission_id")
    if submission_id and payload.assignee:
        store = get_submission_store()
        submission = store.get_submission(submission_id)
        if submission and submission.status == SubmissionStatus.SUBMITTED:
            set_submission_status(submission_id, SubmissionStatus.IN_REVIEW, "verifier")
    return case_row


@router.post("/cases/{case_id}/decision", response_model=VerifierCase)
async def post_verifier_decision(
    case_id: str,
    payload: VerifierDecisionRequest,
    include_explain: int = Query(1, ge=0, le=1),
) -> dict:
    if payload.type in {"reject", "request_info"} and not (payload.reason or "").strip():
        raise HTTPException(status_code=400, detail="Reason is required")

    try:
        case_row, _ = set_case_decision(
            case_id,
            payload.type,
            payload.reason,
            payload.actor,
        )
    except ValueError as exc:
        status = 409 if str(exc) == "case locked" else 400
        raise HTTPException(status_code=status, detail=str(exc)) from exc

    if not case_row:
        raise HTTPException(status_code=404, detail="Case not found")

    submission_id = case_row.get("submission_id")
    if payload.type == "request_info" and submission_id:
        request_info = {
            "message": payload.reason,
            "requested_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            "requested_by": payload.actor,
        }
        set_submission_status(
            submission_id,
            SubmissionStatus.NEEDS_INFO,
            "verifier",
            request_info=request_info,
        )
    if payload.type == "approve" and submission_id:
        set_submission_status(submission_id, SubmissionStatus.APPROVED, "verifier")
    if payload.type == "reject" and submission_id:
        set_submission_status(submission_id, SubmissionStatus.REJECTED, "verifier")

    if case_row.get("locked"):
        packet = await build_decision_packet(
            case_id,
            actor=payload.actor or os.getenv("VERIFIER_DEFAULT_ASSIGNEE", "verifier-1"),
            include_explain=include_explain == 1,
        )
        packet.setdefault("finalization", {})
        packet["finalization"]["is_final"] = True
        packet["finalization"]["decision"] = case_row.get("decision")
        write_final_packet(case_id, packet)

    return case_row


@router.get("/cases/{case_id}/final-packet")
def get_verifier_final_packet(case_id: str) -> dict:
    packet = get_final_packet(case_id)
    if not packet:
        raise HTTPException(status_code=404, detail="Final packet not found")
    return packet


