from typing import Optional

from fastapi import APIRouter, Query

from app.workflow.router import PaginatedCasesResponse, get_workflow_cases

router = APIRouter(prefix="/api/workflow", tags=["workflow"])


@router.get("/cases", response_model=PaginatedCasesResponse)
def get_workflow_cases_alias(
    status: Optional[str] = Query(None, description="Filter by status"),
    assignedTo: Optional[str] = Query(None, description="Filter by assignee"),
    decisionType: Optional[str] = Query(None, description="Filter by decision type"),
    q: Optional[str] = Query(None, description="Search in title/summary"),
    overdue: Optional[bool] = Query(None, description="Show only overdue cases"),
    unassigned: Optional[bool] = Query(None, description="Show only unassigned cases"),
    sla_status: Optional[str] = Query(None, description="Filter by SLA status: ok, warning, breach"),
    limit: int = Query(100, ge=1, le=1000, description="Number of items per page (default 100, max 1000)"),
    offset: int = Query(0, ge=0, description="Number of items to skip"),
    sortBy: str = Query("createdAt", description="Sort field: createdAt, dueAt, updatedAt, or age"),
    sortDir: str = Query("desc", description="Sort direction: asc or desc"),
) -> PaginatedCasesResponse:
    return get_workflow_cases(
        status=status,
        assignedTo=assignedTo,
        decisionType=decisionType,
        q=q,
        overdue=overdue,
        unassigned=unassigned,
        sla_status=sla_status,
        limit=limit,
        offset=offset,
        sortBy=sortBy,
        sortDir=sortDir,
    )