"""
Pydantic models for analytics responses.
"""

from pydantic import BaseModel, Field
from typing import List


class AnalyticsSummary(BaseModel):
    """Overall summary metrics."""
    
    totalCases: int = Field(description="Total number of cases")
    openCount: int = Field(description="Cases with status new, in_review, or needs_info")
    closedCount: int = Field(description="Cases with status approved, blocked, or closed")
    overdueCount: int = Field(description="Cases past their due date")
    dueSoonCount: int = Field(description="Cases due within 24 hours")


class StatusBreakdownItem(BaseModel):
    """Status distribution."""
    
    status: str = Field(description="Case status")
    count: int = Field(description="Number of cases with this status")


class DecisionTypeBreakdownItem(BaseModel):
    """Decision type distribution."""
    
    decisionType: str = Field(description="Decision type (e.g., csf, license_verification)")
    count: int = Field(description="Number of cases of this type")


class TimeSeriesPoint(BaseModel):
    """Time series data point."""
    
    date: str = Field(description="Date in YYYY-MM-DD format")
    count: int = Field(description="Count for this date")


class TopEventTypeItem(BaseModel):
    """Audit event type frequency."""
    
    eventType: str = Field(description="Audit event type")
    count: int = Field(description="Number of occurrences")


class EvidenceTagItem(BaseModel):
    """Evidence tag frequency."""
    
    tag: str = Field(description="Evidence tag")
    count: int = Field(description="Number of occurrences")


class VerifierActivityItem(BaseModel):
    """Verifier activity metrics."""
    
    actor: str = Field(description="Actor name (verifier)")
    count: int = Field(description="Number of audit events created by this actor")


class RequestInfoBreakdownItem(BaseModel):
    """Request info reason frequency."""
    
    reason: str = Field(description="Reason for requesting info (from meta)")
    count: int = Field(description="Number of occurrences")


class AnalyticsResponse(BaseModel):
    """Complete analytics response."""
    
    summary: AnalyticsSummary = Field(description="Overall summary metrics")
    statusBreakdown: List[StatusBreakdownItem] = Field(
        description="Distribution of cases by status",
        default_factory=list
    )
    decisionTypeBreakdown: List[DecisionTypeBreakdownItem] = Field(
        description="Distribution of cases by decision type",
        default_factory=list
    )
    casesCreatedTimeSeries: List[TimeSeriesPoint] = Field(
        description="Cases created per day (last 14 days)",
        default_factory=list
    )
    casesClosedTimeSeries: List[TimeSeriesPoint] = Field(
        description="Cases closed per day (last 14 days)",
        default_factory=list
    )
    topEventTypes: List[TopEventTypeItem] = Field(
        description="Most frequent audit event types (last 30 days)",
        default_factory=list
    )
    verifierActivity: List[VerifierActivityItem] = Field(
        description="Verifier activity by actor (last 30 days)",
        default_factory=list
    )
    evidenceTags: List[EvidenceTagItem] = Field(
        description="Most common evidence tags",
        default_factory=list
    )
    requestInfoReasons: List[RequestInfoBreakdownItem] = Field(
        description="Request info reasons (last 30 days)",
        default_factory=list
    )
