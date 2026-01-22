"""
Development Debugging Endpoints

TEMPORARY endpoints for diagnosing data consistency issues.
Should be removed in production or protected by dev-mode flag.
"""

from fastapi import APIRouter, HTTPException, Query, Header
from pydantic import BaseModel
from typing import List, Optional
import logging

from src.core.db import execute_sql
from src.config import get_settings
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


# ============================================================================
# Demo Data Seeding
# ============================================================================

class SeedDemoResponse(BaseModel):
    """Response from /dev/seed endpoint."""
    ok: bool
    cases_created: int
    message: str


@router.post("/seed", response_model=SeedDemoResponse)
def seed_demo_endpoint(
    admin_unlocked: bool = Query(False, description="Admin unlock flag (set to 1 for access)"),
    x_user_role: Optional[str] = Query(None, alias="x-user-role", description="User role header"),
    authorization: Optional[str] = Header(None, description="Bearer token for authentication")
):
    """
    Manually trigger demo data seeding.
    
    **Authorization** (any of the following):
    - Authorization: Bearer <DEV_SEED_TOKEN> header (if DEV_SEED_TOKEN is set)
    - admin_unlocked=1 query parameter
    - x-user-role=devsupport query parameter
    
    Creates a small set of realistic demo workflow cases if the cases table is empty.
    Idempotent - safe to call multiple times (returns 0 cases created if already seeded).
    
    **Demo Cases Created**:
    - csf_practitioner: Dr. Sarah Chen - DEA Registration Application
    - csf_facility: Bright Hope Pharmacy - Facility License Renewal
    - ohio_tddd: MedSupply Corp - Ohio TDDD Application
    - license: Apex Healthcare - Expired License Alert
    - csa: Schedule Reclassification - Hydrocodone Combination Products
    
    **Query Parameters**:
    - admin_unlocked: Set to 1 to bypass auth check
    - x-user-role: Set to "devsupport" for access
    
    **Headers**:
    - Authorization: Bearer <token> (if DEV_SEED_TOKEN is configured)
    
    **Example**:
    ```
    POST /dev/seed?admin_unlocked=1
    POST /dev/seed?x-user-role=devsupport
    POST /dev/seed -H "Authorization: Bearer <token>"
    ```
    
    Returns:
        SeedDemoResponse with number of cases created
    """
    settings = get_settings()
    
    # Production hardening: Check if demo seed is enabled
    if settings.is_production and not settings.demo_seed_enabled:
        raise HTTPException(
            status_code=403,
            detail="Forbidden: Demo seed endpoint is disabled in production. Set DEMO_SEED_ENABLED=true to enable."
        )
    
    # Authorization check (multi-layered)
    authorized = False
    
    # 1. Check DEV_SEED_TOKEN if configured
    if settings.DEV_SEED_TOKEN:
        # If DEV_SEED_TOKEN is set, REQUIRE valid Authorization header
        if authorization:
            # Extract bearer token (case-insensitive)
            token = authorization.strip()
            # Handle "Bearer " prefix (case-insensitive)
            if token.lower().startswith("bearer "):
                token = token[7:].strip()  # Remove "Bearer " (7 chars)
            
            if token == settings.DEV_SEED_TOKEN:
                authorized = True
                logger.info("Seed endpoint authorized via DEV_SEED_TOKEN")
        
        # If DEV_SEED_TOKEN is set but Authorization is missing/wrong, reject
        # (do NOT fall back to admin_unlocked or x-user-role when token is configured)
        if not authorized:
            raise HTTPException(
                status_code=403,
                detail="Forbidden: DEV_SEED_TOKEN is configured, requires valid Authorization: Bearer <token> header"
            )
    elif settings.is_production:
        # In production, REQUIRE DEV_SEED_TOKEN (don't allow fallback auth)
        raise HTTPException(
            status_code=403,
            detail="Forbidden: Production requires DEV_SEED_TOKEN to be configured"
        )
    else:
        # 2. Fallback to admin_unlocked or devsupport role (only in non-prod if DEV_SEED_TOKEN not set)
        if admin_unlocked:
            authorized = True
            logger.info("Seed endpoint authorized via admin_unlocked=1")
        elif x_user_role == "devsupport":
            authorized = True
            logger.info("Seed endpoint authorized via x-user-role=devsupport")
        
        if not authorized:
            raise HTTPException(
                status_code=403,
                detail="Forbidden: Requires admin_unlocked=1 or x-user-role=devsupport"
            )
    
    # Import seed function
    from app.dev.seed_demo import seed_demo_data
    
    try:
        cases_created = seed_demo_data()
        
        if cases_created > 0:
            message = f"Successfully seeded {cases_created} demo cases"
        else:
            message = "Demo data already exists - no new cases created"
        
        return SeedDemoResponse(
            ok=True,
            cases_created=cases_created,
            message=message
        )
    except Exception as e:
        logger.error(f"Failed to seed demo data: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to seed demo data: {str(e)}"
        )
