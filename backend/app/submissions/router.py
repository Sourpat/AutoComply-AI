"""
Submissions API Router

FastAPI endpoints for submission persistence.
"""

from typing import List, Optional
from fastapi import APIRouter, HTTPException, Query

from .models import (
    SubmissionRecord,
    SubmissionCreateInput,
    SubmissionListFilters,
)
from .repo import (
    create_submission,
    get_submission,
    list_submissions,
)


router = APIRouter(prefix="/submissions", tags=["submissions"])


@router.get("", response_model=List[SubmissionRecord])
def list_submission_records(
    decisionType: Optional[str] = Query(None, description="Filter by decision type"),
    submittedBy: Optional[str] = Query(None, description="Filter by submitter"),
    accountId: Optional[str] = Query(None, description="Filter by account"),
    locationId: Optional[str] = Query(None, description="Filter by location"),
):
    """
    List all submissions with optional filtering.
    
    Query Parameters:
        decisionType: Filter by decision type (csf, csa, etc.)
        submittedBy: Filter by submitter email/user
        accountId: Filter by account/tenant ID
        locationId: Filter by location ID
    
    Returns:
        List of SubmissionRecords sorted by createdAt (newest first)
    """
    filters = SubmissionListFilters(
        decisionType=decisionType,
        submittedBy=submittedBy,
        accountId=accountId,
        locationId=locationId,
    )
    return list_submissions(filters)


@router.get("/{submission_id}", response_model=SubmissionRecord)
def get_submission_by_id(submission_id: str):
    """
    Get a submission by ID.
    
    Path Parameters:
        submission_id: Submission UUID
    
    Returns:
        SubmissionRecord
    
    Raises:
        404: Submission not found
    """
    submission = get_submission(submission_id)
    if not submission:
        raise HTTPException(status_code=404, detail=f"Submission not found: {submission_id}")
    return submission


@router.post("", response_model=SubmissionRecord, status_code=201)
def create_new_submission(input_data: SubmissionCreateInput):
    """
    Create a new submission.
    
    Body:
        SubmissionCreateInput with submission data
    
    Returns:
        Created SubmissionRecord (201 Created)
    
    Example:
        POST /submissions
        {
            "decisionType": "csf",
            "submittedBy": "user@example.com",
            "formData": {
                "name": "Dr. Sarah Smith",
                "licenseNumber": "12345",
                "specialty": "Anesthesiology"
            }
        }
    """
    return create_submission(input_data)
