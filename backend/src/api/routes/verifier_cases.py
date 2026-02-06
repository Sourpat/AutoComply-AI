import os

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from src.autocomply.domain.decision_packet import build_decision_packet
from src.autocomply.domain.verifier_store import (
    add_action,
    add_note,
    assign_case,
    bulk_action,
    bulk_assign,
    get_case,
    list_cases,
    list_events,
    list_notes,
)

router = APIRouter(prefix="/api/verifier", tags=["verifier"])


class VerifierCase(BaseModel):
    case_id: str
    submission_id: str | None = None
    status: str
    jurisdiction: str | None = None
    assignee: str | None = None
    assigned_at: str | None = None
    created_at: str
    updated_at: str
    summary: str


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
    action: str = Field(..., description="approve|reject|needs_review")
    actor: str | None = None
    reason: str | None = None


class VerifierActionResponse(BaseModel):
    case: VerifierCase
    event: VerifierEvent


class VerifierNoteRequest(BaseModel):
    note: str
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


@router.get("/cases", response_model=VerifierCasesResponse)
def list_verifier_cases(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    status: str | None = Query(None),
    jurisdiction: str | None = Query(None),
    assignee: str | None = Query(None),
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
    return {
        "items": items,
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
        return await build_decision_packet(
            case_id,
            actor=os.getenv("VERIFIER_DEFAULT_ASSIGNEE", "verifier-1"),
            include_explain=include_explain == 1,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/cases/{case_id}", response_model=VerifierCaseDetailResponse)
def get_verifier_case(case_id: str) -> dict:
    payload = get_case(case_id)
    if not payload:
        raise HTTPException(status_code=404, detail="Case not found")
    return payload


@router.post("/cases/{case_id}/actions", response_model=VerifierActionResponse)
def post_verifier_action(case_id: str, payload: VerifierActionRequest) -> dict:
    try:
        case_row, event_row = add_action(
            case_id,
            payload.action,
            actor=payload.actor,
            reason=payload.reason,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    if not case_row or not event_row:
        raise HTTPException(status_code=404, detail="Case not found")
    return {"case": case_row, "event": event_row}


@router.post("/cases/{case_id}/notes", response_model=VerifierNoteResponse)
def post_verifier_note(case_id: str, payload: VerifierNoteRequest) -> dict:
    try:
        note_row, event_row = add_note(case_id, payload.note, actor=payload.actor)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

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
    case_row, _ = assign_case(case_id, payload.assignee, actor=payload.actor)
    if not case_row:
        raise HTTPException(status_code=404, detail="Case not found")
    return case_row


