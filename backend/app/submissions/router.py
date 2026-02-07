"""
Submissions API Router

FastAPI endpoints for submission persistence.
"""

from typing import List, Optional
from fastapi import APIRouter, HTTPException, Query, UploadFile, File
import logging

from .models import (
    SubmissionRecord,
    SubmissionCreateInput,
    SubmissionUpdateInput,
    SubmissionListFilters,
)
from .repo import (
    create_submission,
    get_submission,
    list_submissions,
    update_submission,
    soft_delete_submission,
)
from src.autocomply.domain.attachments_store import (
    list_attachments_for_submission,
    save_upload,
    MAX_ATTACHMENT_BYTES,
)
from src.autocomply.domain.submissions_store import get_submission_store

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/submissions", tags=["submissions"])


@router.get("", response_model=List[SubmissionRecord])
def list_submission_records(
    decisionType: Optional[str] = Query(None, description="Filter by decision type"),
    submittedBy: Optional[str] = Query(None, description="Filter by submitter"),
    accountId: Optional[str] = Query(None, description="Filter by account"),
    locationId: Optional[str] = Query(None, description="Filter by location"),
    includeDeleted: bool = Query(False, description="Include deleted submissions"),
):
    """
    List all submissions with optional filtering.
    
    Query Parameters:
        decisionType: Filter by decision type (csf, csa, etc.)
        submittedBy: Filter by submitter email/user
        accountId: Filter by account/tenant ID
        locationId: Filter by location ID
        includeDeleted: Include soft-deleted submissions (default: False)
    
    Returns:
        List of SubmissionRecords sorted by createdAt (newest first)
        Note: Deleted submissions are excluded by default
    """
    filters = SubmissionListFilters(
        decisionType=decisionType,
        submittedBy=submittedBy,
        accountId=accountId,
        locationId=locationId,
        includeDeleted=includeDeleted,
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


def _submission_exists(submission_id: str) -> bool:
    if get_submission(submission_id):
        return True
    store = get_submission_store()
    return store.get_submission(submission_id) is not None


@router.post("/{submission_id}/attachments", response_model=dict)
async def upload_submission_attachment(
    submission_id: str,
    file: UploadFile = File(...),
):
    if not _submission_exists(submission_id):
        raise HTTPException(status_code=404, detail="Submission not found")

    content = await file.read()
    if len(content) > MAX_ATTACHMENT_BYTES:
        raise HTTPException(status_code=413, detail="Attachment too large")

    try:
        record = save_upload(
            content,
            filename=file.filename or "upload.bin",
            content_type=file.content_type,
            submission_id=submission_id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return record


@router.get("/{submission_id}/attachments", response_model=List[dict])
def list_submission_attachments(submission_id: str) -> List[dict]:
    if not _submission_exists(submission_id):
        raise HTTPException(status_code=404, detail="Submission not found")
    return list_attachments_for_submission(submission_id)


@router.post("", response_model=SubmissionRecord, status_code=201)
def create_new_submission(input_data: SubmissionCreateInput):
    """
    Create a new submission and automatically create a linked case.
    
    Body:
        SubmissionCreateInput with submission data
    
    Returns:
        Created SubmissionRecord (201 Created)
        
    Side Effects:
        - Creates a linked case in the workflow queue
        - Sets initial case status based on submission risk level
        - Sets SLA and due date
    
    Example:
        POST /submissions
        {
            "decisionType": "csf_practitioner",
            "submittedBy": "user@example.com",
            "formData": {
                "name": "Dr. Sarah Smith",
                "licenseNumber": "12345",
                "specialty": "Anesthesiology"
            }
        }
    """
    from datetime import datetime, timedelta, timezone
    from app.workflow.models import CaseCreateInput
    from app.workflow.repo import create_case
    
    # Create submission
    submission = create_submission(input_data)
    
    # Automatically create linked case
    # Extract submitter name from formData for case title
    submitter_name = input_data.formData.get('name') or input_data.formData.get('facilityName') or 'Unknown Submitter'
    
    # Determine initial status based on risk level from evaluator output
    initial_status = 'new'
    if input_data.evaluatorOutput and isinstance(input_data.evaluatorOutput, dict):
        risk_level = input_data.evaluatorOutput.get('riskLevel', '').upper()
        if risk_level == 'HIGH':
            initial_status = 'blocked'
        elif risk_level == 'MEDIUM':
            initial_status = 'needs_info'
    
    # Calculate due date (7 days default)
    # Use .replace() to convert +00:00 to Z (standard UTC format)
    due_at = (datetime.now(timezone.utc) + timedelta(days=7)).isoformat().replace('+00:00', 'Z')
    
    # Create case title
    decision_type_labels = {
        'csf_practitioner': 'Practitioner CSF',
        'csf_facility': 'Facility CSF',
        'csf_hospital': 'Hospital CSF',
        'ohio_tddd': 'Ohio TDDD License',
        'ny_pharmacy': 'NY Pharmacy License',
    }
    type_label = decision_type_labels.get(input_data.decisionType, input_data.decisionType.replace('_', ' ').title())
    case_title = f"{type_label} – {submitter_name}"
    
    # Create case
    case_input = CaseCreateInput(
        decisionType=input_data.decisionType,
        submissionId=submission.id,
        title=case_title,
        summary=f"New submission from {submitter_name}",
        status=initial_status,
        dueAt=due_at,
    )
    
    case = create_case(case_input)
    
    # Phase 3.1: Create case_created event
    from app.workflow.repo import create_case_event
    create_case_event(
        case_id=case.id,
        event_type="case_created",
        actor_role="system",
        actor_id=None,
        message=f"Case created from submission by {submitter_name}",
        payload_dict={
            "submission_id": submission.id,
            "decision_type": input_data.decisionType,
            "initial_status": initial_status
        }
    )
    
    # Phase 7.4: Trigger auto-recompute of decision intelligence
    from app.intelligence.lifecycle import request_recompute
    request_recompute(
        case_id=case.id,
        reason="submission_created",
        event_type="submission_created",
        decision_type=input_data.decisionType
    )
    
    # Log creation for debugging
    from src.config import get_settings
    db_path = get_settings().DB_PATH
    logger.info(f"✓ Created submission {submission.id} + case {case.id} in DB: {db_path}")
    
    return submission


@router.patch("/{submission_id}", response_model=SubmissionRecord)
def update_submission_endpoint(submission_id: str, input_data: SubmissionUpdateInput):
    """
    Update an existing submission.
    
    Business Rules:
    - Only submissions with linked cases in 'new' or 'in_review' status can be edited
    - Deleted submissions cannot be edited (410 Gone)
    - Updates set updated_at timestamp automatically
    
    Path Parameters:
        submission_id: Submission UUID
    
    Body:
        SubmissionUpdateInput with fields to update (only non-null fields are updated)
    
    Returns:
        Updated SubmissionRecord
    
    Raises:
        404: Submission not found
        410: Submission is deleted
        403: Linked case status does not allow editing
    
    Example:
        PATCH /submissions/{id}
        {
            "formData": {
                "name": "Dr. Updated Name",
                "licenseNumber": "99999"
            }
        }
    """
    from app.workflow.repo import get_case_by_submission_id
    
    # Get submission
    submission = get_submission(submission_id)
    if not submission:
        raise HTTPException(status_code=404, detail=f"Submission not found: {submission_id}")
    
    # Check if deleted
    if submission.isDeleted:
        raise HTTPException(
            status_code=410,
            detail="Submission is deleted and cannot be edited"
        )
    
    # Get linked case and check status
    case = get_case_by_submission_id(submission_id)
    if case:
        # Only allow editing if case is in editable state
        editable_statuses = ['new', 'in_review', 'needs_info']
        if case.status not in editable_statuses:
            raise HTTPException(
                status_code=403,
                detail=f"Cannot edit submission: linked case has status '{case.status}'. " +
                       f"Editable statuses: {', '.join(editable_statuses)}"
            )
        
        # Update case's updated_at timestamp
        from datetime import datetime
        from app.workflow.repo import update_case, create_case_event
        from app.workflow.models import CaseUpdateInput
        update_case(case.id, CaseUpdateInput(updatedAt=datetime.now(timezone.utc)))
        
        # Phase 3.1: Create submission_updated event
        create_case_event(
            case_id=case.id,
            event_type="submission_updated",
            actor_role="submitter",
            actor_id=submission.submittedBy,
            message="Submission updated by submitter",
            payload_dict={"submission_id": submission_id}
        )
        
        # Phase 7.4: Trigger auto-recompute of decision intelligence
        from app.intelligence.lifecycle import request_recompute
        request_recompute(
            case_id=case.id,
            reason="submission_updated",
            event_type="submission_updated"
        )
    
    # Update submission
    updated = update_submission(submission_id, input_data)
    
    if not updated:
        raise HTTPException(status_code=404, detail=f"Submission not found: {submission_id}")
    
    logger.info(f"✓ Updated submission {submission_id}")
    return updated


@router.delete("/{submission_id}", status_code=204)
def delete_submission_endpoint(submission_id: str):
    """
    Soft delete a submission and cancel its linked case.
    
    Business Rules:
    - Only submissions with linked cases in 'new' status can be deleted
    - Submission must not be assigned to a verifier
    - Sets submission.is_deleted=True, submission.deleted_at=now
    - Sets linked case.status='cancelled', case.updated_at=now
    
    Path Parameters:
        submission_id: Submission UUID
    
    Returns:
        204 No Content on success
    
    Raises:
        404: Submission not found
        410: Already deleted
        403: Linked case status or assignment prevents deletion
    
    Example:
        DELETE /submissions/{id}
    """
    from app.workflow.repo import get_case_by_submission_id, update_case
    from app.workflow.models import CaseUpdateInput
    from datetime import datetime
    
    # Get submission
    submission = get_submission(submission_id)
    if not submission:
        raise HTTPException(status_code=404, detail=f"Submission not found: {submission_id}")
    
    # Check if already deleted
    if submission.isDeleted:
        # Return 204 for idempotent deletion
        return
    
    # Get linked case and check if deletion is allowed
    case = get_case_by_submission_id(submission_id)
    if case:
        # Only allow deletion if case is NEW and unassigned
        if case.status != 'new':
            raise HTTPException(
                status_code=403,
                detail=f"Cannot delete submission: linked case has status '{case.status}'. " +
                       "Only 'new' cases can be deleted."
            )
        
        if case.assignedTo:
            raise HTTPException(
                status_code=403,
                detail="Cannot delete submission: case is assigned to a verifier. " +
                       "Please unassign first."
            )
        
        # Cancel the linked case
        old_status = case.status
        update_case(case.id, CaseUpdateInput(
            status='cancelled',
            updatedAt=datetime.now(timezone.utc)
        ))
        
        # Phase 3.1: Create events for cancellation
        from app.workflow.repo import create_case_event
        
        # submission_cancelled event
        create_case_event(
            case_id=case.id,
            event_type="submission_cancelled",
            actor_role="submitter",
            actor_id=submission.submittedBy,
            message="Submission deleted by submitter",
            payload_dict={"submission_id": submission_id}
        )
        
        # status_changed event (if status actually changed)
        if old_status != 'cancelled':
            create_case_event(
                case_id=case.id,
                event_type="status_changed",
                actor_role="system",
                actor_id=None,
                message=f"Status changed from {old_status} to cancelled (submission deleted)",
                payload_dict={"from": old_status, "to": "cancelled"}
            )
        
        logger.info(f"✓ Cancelled case {case.id} linked to submission {submission_id}")
    
    # Soft delete submission
    success = soft_delete_submission(submission_id)
    
    if not success:
        raise HTTPException(status_code=404, detail=f"Submission not found: {submission_id}")
    
    logger.info(f"✓ Soft deleted submission {submission_id}")
    return
