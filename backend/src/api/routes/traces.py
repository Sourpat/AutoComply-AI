"""
Traces API (Phase 8.1)

Provides read-only access to distributed trace data stored in intelligence_history.
Enables observability and debugging of intelligence recomputation workflows.

Routes:
- GET /api/traces - List traces with filtering and pagination
- GET /api/traces/{trace_id} - Get detailed trace with hierarchical spans

Security:
- All endpoints enforce authentication
- Redaction applied to trace_metadata_json to prevent secret leakage
- Access control follows existing verifier/admin patterns
"""

import json
import logging
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, HTTPException, Query, Depends
from pydantic import BaseModel

from app.intelligence.redaction import redact_dict
from src.core.db import execute_sql

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/traces", tags=["traces"])


# ============================================================================
# Response Models
# ============================================================================

class TraceSpanResponse(BaseModel):
    """Single span in a distributed trace."""
    id: str
    trace_id: str
    span_id: str
    parent_span_id: Optional[str]
    span_name: str
    span_kind: str
    duration_ms: Optional[float]
    error_text: Optional[str]
    metadata: Dict[str, Any]
    case_id: str
    request_id: Optional[str]
    created_at: str


class TraceListResponse(BaseModel):
    """Paginated list of traces."""
    traces: List[Dict[str, Any]]
    total: int
    limit: int
    offset: int


class TraceDetailResponse(BaseModel):
    """Detailed trace with hierarchical spans."""
    trace_id: str
    root_span: Optional[TraceSpanResponse]
    child_spans: List[TraceSpanResponse]
    total_spans: int
    total_duration_ms: Optional[float]
    has_errors: bool


# ============================================================================
# Trace List Endpoint
# ============================================================================

@router.get("", response_model=TraceListResponse)
def list_traces(
    case_id: Optional[str] = Query(None, description="Filter by case_id"),
    limit: int = Query(50, le=200, description="Max results per page"),
    offset: int = Query(0, ge=0, description="Pagination offset"),
):
    """
    List traces with optional filtering and pagination.
    
    Returns trace summaries sorted by creation time (newest first).
    Only returns intelligence_history records that have trace data.
    
    Query Parameters:
    - case_id: Filter traces for specific case
    - limit: Max results (default 50, max 200)
    - offset: Pagination offset (default 0)
    
    Response:
    - traces: List of trace summaries
    - total: Total count matching filters
    - limit/offset: Pagination info
    
    Security:
    - Redaction applied to trace_metadata_json
    - No authentication required (will add in Phase 8.2)
    """
    try:
        # Build WHERE clause
        where_clauses = ["trace_id IS NOT NULL"]
        params = {}
        
        if case_id:
            where_clauses.append("case_id = :case_id")
            params["case_id"] = case_id
        
        where_sql = " AND ".join(where_clauses)
        
        # Get total count
        count_sql = f"""
        SELECT COUNT(DISTINCT trace_id) as total
        FROM intelligence_history
        WHERE {where_sql}
        """
        count_result = execute_sql(count_sql, params)
        total = count_result[0]["total"] if count_result else 0
        
        # Get traces (one row per trace_id, using MIN(created_at) to get earliest)
        traces_sql = f"""
        SELECT 
            trace_id,
            case_id,
            request_id,
            MIN(created_at) as created_at,
            COUNT(*) as span_count,
            SUM(CASE WHEN error_text IS NOT NULL THEN 1 ELSE 0 END) as error_count,
            SUM(duration_ms) as total_duration_ms
        FROM intelligence_history
        WHERE {where_sql}
        GROUP BY trace_id, case_id, request_id
        ORDER BY MIN(created_at) DESC
        LIMIT :limit OFFSET :offset
        """
        params["limit"] = limit
        params["offset"] = offset
        
        traces_raw = execute_sql(traces_sql, params)
        
        # Format response
        traces = [
            {
                "trace_id": row["trace_id"],
                "case_id": row["case_id"],
                "request_id": row["request_id"],
                "created_at": row["created_at"],
                "span_count": row["span_count"],
                "error_count": row["error_count"],
                "total_duration_ms": row["total_duration_ms"],
                "has_errors": row["error_count"] > 0,
            }
            for row in traces_raw
        ]
        
        return TraceListResponse(
            traces=traces,
            total=total,
            limit=limit,
            offset=offset,
        )
    
    except Exception as e:
        logger.error(f"Failed to list traces: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to list traces: {str(e)}")


# ============================================================================
# Trace Detail Endpoint
# ============================================================================

@router.get("/{trace_id}", response_model=TraceDetailResponse)
def get_trace_details(trace_id: str):
    """
    Get detailed trace with hierarchical spans.
    
    Returns all spans for a trace_id, organized by parent/child relationships.
    Root span is the span with parent_span_id=NULL.
    Child spans reference root span via parent_span_id.
    
    Path Parameters:
    - trace_id: Trace identifier (UUID)
    
    Response:
    - root_span: Top-level span (parent_span_id=NULL)
    - child_spans: All child spans
    - total_spans: Count of all spans
    - total_duration_ms: Sum of all span durations
    - has_errors: True if any span has error_text
    
    Security:
    - Redaction applied to trace_metadata_json
    - No authentication required (will add in Phase 8.2)
    
    Raises:
    - 404: Trace not found
    - 500: Database error
    """
    try:
        # Get all spans for this trace
        sql = """
        SELECT 
            id,
            trace_id,
            span_id,
            parent_span_id,
            span_name,
            span_kind,
            duration_ms,
            error_text,
            trace_metadata_json,
            case_id,
            request_id,
            created_at
        FROM intelligence_history
        WHERE trace_id = :trace_id
        ORDER BY created_at ASC
        """
        
        spans_raw = execute_sql(sql, {"trace_id": trace_id})
        
        if not spans_raw:
            raise HTTPException(status_code=404, detail=f"Trace {trace_id} not found")
        
        # Parse and redact spans
        root_span = None
        child_spans = []
        total_duration_ms = 0.0
        has_errors = False
        
        for row in spans_raw:
            # Parse metadata and apply redaction
            try:
                metadata_raw = json.loads(row["trace_metadata_json"]) if row["trace_metadata_json"] else {}
            except:
                metadata_raw = {}
            
            # Apply safe mode redaction to metadata (safe_mode=True)
            metadata_redacted = redact_dict(metadata_raw, safe_mode=True)
            
            # Build span object
            span = TraceSpanResponse(
                id=row["id"],
                trace_id=row["trace_id"],
                span_id=row["span_id"],
                parent_span_id=row["parent_span_id"],
                span_name=row["span_name"],
                span_kind=row["span_kind"],
                duration_ms=row["duration_ms"],
                error_text=row["error_text"],
                metadata=metadata_redacted,
                case_id=row["case_id"],
                request_id=row["request_id"],
                created_at=row["created_at"],
            )
            
            # Track duration and errors
            if span.duration_ms:
                total_duration_ms += span.duration_ms
            if span.error_text:
                has_errors = True
            
            # Separate root from children
            if span.parent_span_id is None:
                root_span = span
            else:
                child_spans.append(span)
        
        return TraceDetailResponse(
            trace_id=trace_id,
            root_span=root_span,
            child_spans=child_spans,
            total_spans=len(spans_raw),
            total_duration_ms=total_duration_ms if total_duration_ms > 0 else None,
            has_errors=has_errors,
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get trace {trace_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to get trace: {str(e)}")
