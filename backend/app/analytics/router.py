"""
Analytics Router for Workflow Console

Provides read-only analytics endpoints for workflow metrics.
Available to both admin and verifier roles.
"""

from typing import Optional
from fastapi import APIRouter, Query, Request
from pydantic import BaseModel, Field

from app.core.authz import get_role
from .repo import analytics_repo
from .models import (
    AnalyticsResponse,
    TopEventTypeItem,
    VerifierActivityItem,
    TimeSeriesPoint,
    EvidenceTagItem,
)


router = APIRouter(prefix="/api/analytics", tags=["analytics"])


# ============================================================================
# Response Models
# ============================================================================

class SLAMetrics(BaseModel):
    """SLA-focused metrics response."""
    
    overdueCount: int = Field(description="Cases past their due date")
    dueSoonCount: int = Field(description="Cases due within 24 hours")
    avgAgeOpen: float = Field(description="Average age of open cases in hours")
    avgTimeToClose: float = Field(description="Average time to close cases in hours (if available)")
    totalOpen: int = Field(description="Total open cases")
    totalClosed: int = Field(description="Total closed cases")


class AuditMetrics(BaseModel):
    """Audit-focused metrics response."""
    
    topEventTypes: list[TopEventTypeItem] = Field(description="Most frequent event types")
    verifierActivity: list[VerifierActivityItem] = Field(description="Verifier activity by actor")
    auditTimeSeries: list[TimeSeriesPoint] = Field(description="Audit events per day")


class EvidenceMetrics(BaseModel):
    """Evidence-focused metrics response."""
    
    evidenceTags: list[EvidenceTagItem] = Field(description="Most common evidence tags")
    packetInclusionRate: float = Field(description="Percentage of evidence included in packets")
    totalEvidence: int = Field(description="Total evidence items across all cases")
    packetedEvidence: int = Field(description="Evidence items included in packets")


# ============================================================================
# Endpoints
# ============================================================================

@router.get("/overview", response_model=AnalyticsResponse)
def get_analytics_overview(
    request: Request,
    days: int = Query(30, ge=1, le=365, description="Number of days to analyze"),
    decisionType: Optional[str] = Query(None, description="Filter by decision type"),
    assignedTo: Optional[str] = Query(None, description="Filter by assigned verifier"),
):
    """
    Get comprehensive analytics overview.
    
    Available to both admin and verifier roles (read-only).
    
    Query Parameters:
        - days: Number of days to analyze (default: 30)
        - decisionType: Filter by decision type (optional)
        - assignedTo: Filter by assigned verifier (optional)
        
    Returns:
        Complete analytics response with summary, breakdowns, and time series
    """
    # Role check (both admin and verifier allowed)
    role = get_role(request)  # noqa: F841
    
    # Get analytics with optional filters
    # Note: assignedTo filtering not yet implemented (requires case-level assignee tracking)
    return analytics_repo.get_analytics(
        days=days,
        decision_type=decisionType
    )


@router.get("/sla", response_model=SLAMetrics)
def get_sla_metrics(request: Request):
    """
    Get SLA-focused metrics.
    
    Available to both admin and verifier roles (read-only).
    
    Returns:
        - Overdue count
        - Due soon count (within 24h)
        - Average age of open cases
        - Average time to close (if calculable)
    """
    # Role check (both admin and verifier allowed)
    role = get_role(request)  # noqa: F841
    
    summary = analytics_repo.get_summary()
    
    # Calculate average age of open cases
    avg_age_open = analytics_repo.get_avg_age_open()
    
    # Calculate average time to close
    avg_time_to_close = analytics_repo.get_avg_time_to_close()
    
    return SLAMetrics(
        overdueCount=summary.overdueCount,
        dueSoonCount=summary.dueSoonCount,
        avgAgeOpen=avg_age_open,
        avgTimeToClose=avg_time_to_close,
        totalOpen=summary.openCount,
        totalClosed=summary.closedCount,
    )


@router.get("/audit", response_model=AuditMetrics)
def get_audit_metrics(
    request: Request,
    days: int = Query(30, ge=1, le=365, description="Number of days to analyze"),
):
    """
    Get audit-focused metrics.
    
    Available to both admin and verifier roles (read-only).
    
    Query Parameters:
        - days: Number of days to analyze (default: 30)
        
    Returns:
        - Top event types
        - Verifier activity
        - Audit events time series
    """
    # Role check (both admin and verifier allowed)
    role = get_role(request)  # noqa: F841
    
    top_event_types = analytics_repo.get_top_event_types(days=days, limit=10)
    verifier_activity = analytics_repo.get_verifier_activity(days=days, limit=10)
    audit_time_series = analytics_repo.get_audit_time_series(days=14)
    
    return AuditMetrics(
        topEventTypes=top_event_types,
        verifierActivity=verifier_activity,
        auditTimeSeries=audit_time_series,
    )


@router.get("/evidence", response_model=EvidenceMetrics)
def get_evidence_metrics(request: Request):
    """
    Get evidence-focused metrics.
    
    Available to both admin and verifier roles (read-only).
    
    Returns:
        - Evidence tag frequency
        - Packet inclusion rate
        - Total evidence items
        - Packeted evidence count
    """
    # Role check (both admin and verifier allowed)
    role = get_role(request)  # noqa: F841
    
    evidence_tags = analytics_repo.get_evidence_tags(limit=20)
    packet_stats = analytics_repo.get_packet_inclusion_stats()
    
    return EvidenceMetrics(
        evidenceTags=evidence_tags,
        packetInclusionRate=packet_stats["inclusionRate"],
        totalEvidence=packet_stats["totalEvidence"],
        packetedEvidence=packet_stats["packetedEvidence"],
    )
