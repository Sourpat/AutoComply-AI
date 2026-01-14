"""
Analytics repository for SQLite-backed workflow data.

Provides aggregated metrics and insights using deterministic SQL queries.
Safe with empty databases and optimized for indexed fields.
"""

import json
from datetime import datetime, timedelta
from typing import List, Dict, Any
from collections import Counter

from src.core.db import execute_sql
from .models import (
    AnalyticsSummary,
    StatusBreakdownItem,
    DecisionTypeBreakdownItem,
    TimeSeriesPoint,
    TopEventTypeItem,
    EvidenceTagItem,
    VerifierActivityItem,
    RequestInfoBreakdownItem,
    AnalyticsResponse,
)


class AnalyticsRepository:
    """Repository for analytics queries on workflow data."""
    
    def __init__(self):
        """Initialize analytics repository."""
        pass
    
    def get_summary(self, decision_type: str | None = None) -> AnalyticsSummary:
        """Get overall summary metrics, optionally filtered by decision type."""
        # Build WHERE clause for decision type filter
        dt_filter = "" if not decision_type else " AND decision_type = :decision_type"
        params = {"decision_type": decision_type} if decision_type else {}
        
        # Total cases
        total_result = execute_sql(
            f"SELECT COUNT(*) as count FROM cases WHERE 1=1{dt_filter}",
            params
        )
        total_cases = total_result[0]["count"] if total_result else 0
        
        # Open cases (new, in_review, needs_info)
        open_result = execute_sql(
            f"SELECT COUNT(*) as count FROM cases WHERE status IN ('new', 'in_review', 'needs_info'){dt_filter}",
            params
        )
        open_count = open_result[0]["count"] if open_result else 0
        
        # Closed cases (approved, blocked, closed)
        closed_result = execute_sql(
            f"SELECT COUNT(*) as count FROM cases WHERE status IN ('approved', 'blocked', 'closed'){dt_filter}",
            params
        )
        closed_count = closed_result[0]["count"] if closed_result else 0
        
        # Overdue cases (due_at < NOW)
        now_iso = datetime.now().isoformat()
        overdue_params = {**params, "now": now_iso}
        overdue_result = execute_sql(
            f"SELECT COUNT(*) as count FROM cases WHERE due_at < :now AND status NOT IN ('approved', 'blocked', 'closed'){dt_filter}",
            overdue_params
        )
        overdue_count = overdue_result[0]["count"] if overdue_result else 0
        
        # Due soon (within 24 hours)
        due_soon_threshold = (datetime.utcnow() + timedelta(hours=24)).isoformat()
        due_soon_params = {**params, "threshold": due_soon_threshold, "now": now_iso}
        due_soon_result = execute_sql(
            f"SELECT COUNT(*) as count FROM cases WHERE due_at <= :threshold AND due_at >= :now AND status NOT IN ('approved', 'blocked', 'closed'){dt_filter}",
            due_soon_params
        )
        due_soon_count = due_soon_result[0]["count"] if due_soon_result else 0
        
        return AnalyticsSummary(
            totalCases=total_cases,
            openCount=open_count,
            closedCount=closed_count,
            overdueCount=overdue_count,
            dueSoonCount=due_soon_count,
        )
    
    def get_status_breakdown(self, decision_type: str | None = None) -> List[StatusBreakdownItem]:
        """Get distribution of cases by status, optionally filtered by decision type."""
        dt_filter = "" if not decision_type else " WHERE decision_type = :decision_type"
        params = {"decision_type": decision_type} if decision_type else {}
        
        rows = execute_sql(
            f"SELECT status, COUNT(*) as count FROM cases{dt_filter} GROUP BY status ORDER BY count DESC",
            params
        )
        return [StatusBreakdownItem(status=row["status"], count=row["count"]) for row in rows]
    
    def get_decision_type_breakdown(self) -> List[DecisionTypeBreakdownItem]:
        """Get distribution of cases by decision type."""
        rows = execute_sql(
            "SELECT decision_type, COUNT(*) as count FROM cases GROUP BY decision_type ORDER BY count DESC"
        )
        return [
            DecisionTypeBreakdownItem(decisionType=row["decision_type"], count=row["count"])
            for row in rows
        ]
    
    def get_cases_created_time_series(self, days: int = 14, decision_type: str | None = None) -> List[TimeSeriesPoint]:
        """Get cases created per day for the last N days, optionally filtered by decision type."""
        cutoff_date = (datetime.utcnow() - timedelta(days=days)).isoformat()
        dt_filter = "" if not decision_type else " AND decision_type = :decision_type"
        params = {"cutoff": cutoff_date}
        if decision_type:
            params["decision_type"] = decision_type
        
        rows = execute_sql(
            f"SELECT DATE(created_at) as date, COUNT(*) as count FROM cases WHERE created_at >= :cutoff{dt_filter} GROUP BY DATE(created_at) ORDER BY date ASC",
            params
        )
        return [TimeSeriesPoint(date=row["date"], count=row["count"]) for row in rows]
    
    def get_cases_closed_time_series(self, days: int = 14, decision_type: str | None = None) -> List[TimeSeriesPoint]:
        """
        Get cases closed per day for the last N days, optionally filtered by decision type.
        Uses updated_at when status changed to closed/approved/blocked.
        """
        cutoff_date = (datetime.utcnow() - timedelta(days=days)).isoformat()
        dt_filter = "" if not decision_type else " AND decision_type = :decision_type"
        params = {"cutoff": cutoff_date}
        if decision_type:
            params["decision_type"] = decision_type
        
        rows = execute_sql(
            f"SELECT DATE(updated_at) as date, COUNT(*) as count FROM cases WHERE status IN ('approved', 'blocked', 'closed') AND updated_at >= :cutoff{dt_filter} GROUP BY DATE(updated_at) ORDER BY date ASC",
            params
        )
        return [TimeSeriesPoint(date=row["date"], count=row["count"]) for row in rows]
    
    def get_top_event_types(self, days: int = 30, limit: int = 10) -> List[TopEventTypeItem]:
        """Get most frequent audit event types in the last N days."""
        cutoff_date = (datetime.utcnow() - timedelta(days=days)).isoformat()
        rows = execute_sql(
            "SELECT event_type, COUNT(*) as count FROM audit_events WHERE created_at >= :cutoff GROUP BY event_type ORDER BY count DESC LIMIT :limit",
            {"cutoff": cutoff_date, "limit": limit}
        )
        return [TopEventTypeItem(eventType=row["event_type"], count=row["count"]) for row in rows]
    
    def get_verifier_activity(self, days: int = 30, limit: int = 10) -> List[VerifierActivityItem]:
        """Get verifier activity by actor in the last N days."""
        cutoff_date = (datetime.utcnow() - timedelta(days=days)).isoformat()
        rows = execute_sql(
            "SELECT actor_name, COUNT(*) as count FROM audit_events WHERE created_at >= :cutoff AND actor_name != 'system' GROUP BY actor_name ORDER BY count DESC LIMIT :limit",
            {"cutoff": cutoff_date, "limit": limit}
        )
        return [VerifierActivityItem(actor=row["actor_name"] or "Unknown", count=row["count"]) for row in rows]
    
    def get_evidence_tags(self, limit: int = 20, decision_type: str | None = None) -> List[EvidenceTagItem]:
        """
        Get most common evidence tags across cases, optionally filtered by decision type.
        Returns empty list if evidence column doesn't exist in schema.
        """
        # Evidence tags feature not yet implemented in schema
        # Return empty list for now
        return []
    
    def get_request_info_reasons(self, days: int = 30, limit: int = 10) -> List[RequestInfoBreakdownItem]:
        """
        Get request info reasons from audit events meta field.
        Parses meta JSON to extract reason if present.
        """
        cutoff_date = (datetime.utcnow() - timedelta(days=days)).isoformat()
        rows = execute_sql(
            "SELECT meta FROM audit_events WHERE event_type = 'requested_info' AND created_at >= :cutoff AND meta IS NOT NULL",
            {"cutoff": cutoff_date}
        )
        
        reason_counter: Counter = Counter()
        
        for row in rows:
            meta_json = row["meta"]
            try:
                meta_data = json.loads(meta_json)
                if isinstance(meta_data, dict) and 'reason' in meta_data:
                    reason = meta_data['reason']
                    if isinstance(reason, str) and reason:
                        reason_counter[reason] += 1
                    elif isinstance(reason, str):
                        reason_counter['(no reason provided)'] += 1
            except (json.JSONDecodeError, TypeError):
                continue
        
        # Get top N reasons
        top_reasons = reason_counter.most_common(limit)
        
        return [RequestInfoBreakdownItem(reason=reason, count=count) for reason, count in top_reasons]
    
    def get_avg_age_open(self) -> float:
        """
        Get average age of open cases in hours.
        Returns 0.0 if no open cases.
        """
        rows = execute_sql(
            "SELECT createdAt FROM cases WHERE status IN ('new', 'in_review', 'needs_info')"
        )
        
        now = datetime.utcnow()
        ages_hours = []
        
        for row in rows:
            created_at_str = row["createdAt"]
            try:
                created_at = datetime.fromisoformat(created_at_str.replace('Z', '+00:00'))
                age_hours = (now - created_at).total_seconds() / 3600
                ages_hours.append(age_hours)
            except (ValueError, AttributeError):
                # Skip malformed dates
                continue
        
        if not ages_hours:
            return 0.0
        
        return sum(ages_hours) / len(ages_hours)
    
    def get_avg_time_to_close(self) -> float:
        """
        Get average time to close cases in hours.
        Calculated as (updatedAt - createdAt) for closed cases.
        Returns 0.0 if no closed cases.
        """
        rows = execute_sql(
            "SELECT createdAt, updatedAt FROM cases WHERE status IN ('approved', 'blocked', 'closed')"
        )
        
        durations_hours = []
        
        for row in rows:
            created_at_str, updated_at_str = row["createdAt"], row["updatedAt"]
            try:
                created_at = datetime.fromisoformat(created_at_str.replace('Z', '+00:00'))
                updated_at = datetime.fromisoformat(updated_at_str.replace('Z', '+00:00'))
                duration_hours = (updated_at - created_at).total_seconds() / 3600
                durations_hours.append(duration_hours)
            except (ValueError, AttributeError):
                # Skip malformed dates
                continue
        
        if not durations_hours:
            return 0.0
        
        return sum(durations_hours) / len(durations_hours)
    
    def get_audit_time_series(self, days: int = 14) -> List[TimeSeriesPoint]:
        """Get audit events per day for the last N days."""
        cutoff_date = (datetime.utcnow() - timedelta(days=days)).isoformat()
        rows = execute_sql(
            "SELECT DATE(createdAt) as date, COUNT(*) as count FROM audit_events WHERE createdAt >= :cutoff GROUP BY DATE(createdAt) ORDER BY date ASC",
            {"cutoff": cutoff_date}
        )
        return [TimeSeriesPoint(date=row["date"], count=row["count"]) for row in rows]
    
    def get_packet_inclusion_stats(self) -> Dict[str, Any]:
        """
        Get packet inclusion statistics.
        Returns:
            - totalEvidence: Total evidence items
            - packetedEvidence: Evidence items in packets
            - inclusionRate: Percentage (0-100)
        """
        rows = execute_sql(
            "SELECT evidence, packetEvidenceIds FROM cases WHERE evidence IS NOT NULL AND evidence != '[]'"
        )
        
        total_evidence = 0
        packeted_evidence = 0
        
        for row in rows:
            evidence_json, packet_ids_json = row["evidence"], row.get("packetEvidenceIds")
            
            try:
                evidence_items = json.loads(evidence_json)
                if not isinstance(evidence_items, list):
                    continue
                
                total_evidence += len(evidence_items)
                
                # Parse packet IDs
                packet_ids = []
                if packet_ids_json:
                    try:
                        packet_ids = json.loads(packet_ids_json)
                        if not isinstance(packet_ids, list):
                            packet_ids = []
                    except (json.JSONDecodeError, TypeError):
                        packet_ids = []
                
                # Count evidence items in packet
                for item in evidence_items:
                    if isinstance(item, dict) and 'id' in item:
                        if item['id'] in packet_ids:
                            packeted_evidence += 1
            
            except (json.JSONDecodeError, TypeError):
                continue
        
        inclusion_rate = 0.0
        if total_evidence > 0:
            inclusion_rate = (packeted_evidence / total_evidence) * 100
        
        return {
            "totalEvidence": total_evidence,
            "packetedEvidence": packeted_evidence,
            "inclusionRate": round(inclusion_rate, 2),
        }
    
    def get_analytics(
        self,
        days: int = 30,
        decision_type: str | None = None
    ) -> AnalyticsResponse:
        """Get complete analytics response with all metrics.
        
        Args:
            days: Number of days for time series and event metrics
            decision_type: Optional filter by decision type
        """
        return AnalyticsResponse(
            summary=self.get_summary(decision_type=decision_type),
            statusBreakdown=self.get_status_breakdown(decision_type=decision_type),
            decisionTypeBreakdown=self.get_decision_type_breakdown(),
            casesCreatedTimeSeries=self.get_cases_created_time_series(days=days),
            casesClosedTimeSeries=self.get_cases_closed_time_series(days=days),
            topEventTypes=self.get_top_event_types(days=days, limit=10),
            verifierActivity=self.get_verifier_activity(days=days, limit=10),
            evidenceTags=self.get_evidence_tags(limit=20),
            requestInfoReasons=self.get_request_info_reasons(days=days, limit=10),
        )


# Singleton instance
analytics_repo = AnalyticsRepository()
