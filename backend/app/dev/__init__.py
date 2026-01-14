"""
Development Debugging Endpoints

TEMPORARY endpoints for diagnosing data consistency issues.
Should be removed in production or protected by dev-mode flag.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import logging

from src.core.db import execute_sql
from app.submissions.repo import list_submissions
from app.workflow.repo import list_cases
from app.submissions.models import SubmissionListFilters
from app.workflow.models import CaseListFilters

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/dev", tags=["dev"])


# ============================================================================
# Response Models
# ============================================================================

class SubmissionCaseMapping(BaseModel):
    """Sample submission-case mapping for consistency verification."""
    submission_id: str
    case_id: Optional[str]
    case_status: Optional[str]
    submission_is_deleted: bool
    submission_created_at: str
    case_created_at: Optional[str]


class ConsistencyReport(BaseModel):
    """Comprehensive consistency report for submission/case sync."""
    # Totals
    submissions_total: int
    submissions_active: int  # not deleted
    submissions_deleted: int
    cases_total: int
    cases_active: int  # not cancelled
    cases_cancelled: int
    
    # Orphan detection
    orphan_cases_count: int  # cases without submission
    orphan_submissions_count: int  # submissions without case
    
    # Sample mappings
    sample_mappings: List[SubmissionCaseMapping]
    
    # Additional diagnostics
    recent_submissions: List[dict]
    recent_cases: List[dict]


# ============================================================================
# Endpoints
# ============================================================================

@router.get("/consistency", response_model=ConsistencyReport)
def get_consistency_report():
    """
    Check submission/case data consistency.
    
    Diagnoses:
    - Total counts for submissions and cases
    - Active vs deleted/cancelled counts
    - Orphan detection (submissions without cases, cases without submissions)
    - Sample mappings showing submission→case relationships
    - Recent records for manual inspection
    
    Returns:
        ConsistencyReport with full diagnostic information
        
    Use this to verify:
    1. Every active submission has a linked case
    2. Deleted submissions have cancelled cases
    3. Counts match between submitter view and verifier queue
    4. IDs are correctly linked
    """
    # Get all submissions
    all_submissions = list_submissions(SubmissionListFilters(includeDeleted=True))
    submissions_total = len(all_submissions)
    submissions_active = sum(1 for s in all_submissions if not s.isDeleted)
    submissions_deleted = sum(1 for s in all_submissions if s.isDeleted)
    
    # Get all cases (including cancelled)
    all_cases, cases_total = list_cases(
        filters=CaseListFilters(),
        limit=10000,
        offset=0,
        sort_by="createdAt",
        sort_dir="desc"
    )
    cases_active = sum(1 for c in all_cases if c.status != 'cancelled')
    cases_cancelled = sum(1 for c in all_cases if c.status == 'cancelled')
    
    # Build submission ID → case lookup
    case_by_submission_id = {c.submissionId: c for c in all_cases if c.submissionId}
    
    # Find orphans
    orphan_submissions = []  # submissions without cases
    orphan_cases = []  # cases without submissions
    
    submission_ids = {s.id for s in all_submissions}
    for case in all_cases:
        if case.submissionId and case.submissionId not in submission_ids:
            orphan_cases.append(case)
    
    orphan_submissions_count = 0
    for submission in all_submissions:
        if submission.id not in case_by_submission_id:
            orphan_submissions.append(submission)
            orphan_submissions_count += 1
    
    orphan_cases_count = len(orphan_cases)
    
    # Build sample mappings (first 10 submissions)
    sample_mappings = []
    for submission in all_submissions[:10]:
        linked_case = case_by_submission_id.get(submission.id)
        sample_mappings.append(SubmissionCaseMapping(
            submission_id=submission.id,
            case_id=linked_case.id if linked_case else None,
            case_status=linked_case.status if linked_case else None,
            submission_is_deleted=submission.isDeleted,
            submission_created_at=submission.createdAt.isoformat(),
            case_created_at=linked_case.createdAt.isoformat() if linked_case else None,
        ))
    
    # Get recent submissions (raw data for inspection)
    recent_submissions = []
    for s in all_submissions[:5]:
        recent_submissions.append({
            "id": s.id,
            "created_at": s.createdAt.isoformat(),
            "decision_type": s.decisionType,
            "is_deleted": s.isDeleted,
            "deleted_at": s.deletedAt.isoformat() if s.deletedAt else None,
        })
    
    # Get recent cases (raw data for inspection)
    recent_cases = []
    for c in all_cases[:5]:
        recent_cases.append({
            "id": c.id,
            "submission_id": c.submissionId,
            "created_at": c.createdAt.isoformat(),
            "status": c.status,
            "title": c.title,
        })
    
    return ConsistencyReport(
        submissions_total=submissions_total,
        submissions_active=submissions_active,
        submissions_deleted=submissions_deleted,
        cases_total=cases_total,
        cases_active=cases_active,
        cases_cancelled=cases_cancelled,
        orphan_cases_count=orphan_cases_count,
        orphan_submissions_count=orphan_submissions_count,
        sample_mappings=sample_mappings,
        recent_submissions=recent_submissions,
        recent_cases=recent_cases,
    )

