from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter, Query

from src.domain.verification import (
    VerificationRequest,
    VerificationRequestIn,
    create_verification_request,
    list_verification_requests,
)

router = APIRouter(prefix="/verifications", tags=["verifications"])


@router.post("/submit", response_model=VerificationRequest)
def submit_verification_request(
    payload: VerificationRequestIn,
) -> VerificationRequest:
    """
    Create a new verification request.

    In this sandbox this is stored in an in-memory queue. In a real environment,
    this would feed a queue, ticketing system, or n8n workflow.
    """
    return create_verification_request(payload)


@router.get("/queue", response_model=List[VerificationRequest])
def get_verification_queue(
    status: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=100),
) -> List[VerificationRequest]:
    """
    List verification requests, newest first.
    Optionally filter by status (pending/in_progress/resolved).
    """
    return list_verification_requests(status=status, limit=limit)
