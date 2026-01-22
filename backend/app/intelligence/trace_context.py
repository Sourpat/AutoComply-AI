"""
Phase 8.1: TraceContext - Context manager for enterprise trace observability.

Provides lightweight span tracing that extends intelligence_history with:
- Hierarchical span tracking (parent/child relationships)
- Automatic timing and error capture
- Structured metadata collection
- Safe-by-default (no secrets, applies existing redaction)

Usage:
    from app.intelligence.trace_context import TraceContext
    
    # Start a root span
    with TraceContext.start_span(
        span_name="intelligence_recompute",
        span_kind="internal",
        metadata={"case_id": "case_123", "trigger": "manual"}
    ) as span:
        # Work happens here
        result = compute_intelligence(...)
        
    # Span automatically records duration_ms, error_text, and metadata

    # Nested spans
    with TraceContext.start_span("parent_operation") as parent:
        # ... parent work ...
        
        with TraceContext.start_span("child_operation") as child:
            # child.parent_span_id automatically set to parent.span_id
            # ... child work ...

Author: AutoComply AI
Date: 2026-01-24
"""

import json
import time
import uuid
from contextvars import ContextVar
from datetime import datetime, timezone
from typing import Any, Dict, Optional

# Thread-local storage for trace context
_trace_id_var: ContextVar[Optional[str]] = ContextVar("trace_id", default=None)
_parent_span_id_var: ContextVar[Optional[str]] = ContextVar("parent_span_id", default=None)


class TraceSpan:
    """
    Represents a single span in a trace.
    
    Automatically measures duration and captures errors.
    """
    
    def __init__(
        self,
        span_name: str,
        span_kind: str = "internal",
        metadata: Optional[Dict[str, Any]] = None,
        case_id: Optional[str] = None,
        request_id: Optional[str] = None,
    ):
        """
        Initialize a trace span.
        
        Args:
            span_name: Human-readable operation name (e.g., "ai_inference", "db_query")
            span_kind: Type of span - "internal", "ai_call", "db_query", "http_request"
            metadata: Additional structured data (will be redacted for secrets)
            case_id: Associated case ID (for linking to intelligence_history)
            request_id: Request ID from middleware (for correlation)
        """
        self.span_id = str(uuid.uuid4())
        self.span_name = span_name
        self.span_kind = span_kind
        self.metadata = metadata or {}
        self.case_id = case_id
        self.request_id = request_id
        
        # Get or create trace_id
        self.trace_id = _trace_id_var.get()
        if not self.trace_id:
            self.trace_id = str(uuid.uuid4())
            _trace_id_var.set(self.trace_id)
        
        # Get parent span ID from context
        self.parent_span_id = _parent_span_id_var.get()
        
        # Timing
        self.start_time = time.time()
        self.end_time: Optional[float] = None
        self.duration_ms: Optional[int] = None
        
        # Error tracking
        self.error_text: Optional[str] = None
        
        # Token for context restoration
        self._parent_token = None
    
    def __enter__(self) -> "TraceSpan":
        """Enter context: set this span as parent for nested spans."""
        self._parent_token = _parent_span_id_var.set(self.span_id)
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        """Exit context: record duration and errors, restore parent."""
        # Calculate duration
        self.end_time = time.time()
        self.duration_ms = int((self.end_time - self.start_time) * 1000)
        
        # Capture error if exception occurred
        if exc_type is not None:
            self.error_text = f"{exc_type.__name__}: {str(exc_val)}"
        
        # Record span to intelligence_history if case_id present
        if self.case_id:
            self._record_to_history()
        
        # Restore parent span ID
        if self._parent_token:
            _parent_span_id_var.reset(self._parent_token)
        
        # Don't suppress exceptions
        return False
    
    def _record_to_history(self):
        """
        Record this span to intelligence_history.
        
        Reuses existing insert infrastructure with trace fields populated.
        """
        try:
            from .repository import execute_insert
            from .redaction import redact_dict  # Use existing redaction
            
            # Redact sensitive metadata (safe_mode=True prevents secret leakage)
            safe_metadata = redact_dict(self.metadata, safe_mode=True)
            
            # Create minimal intelligence payload (for compatibility with existing schema)
            # This is a trace-only entry, not a full intelligence computation
            payload = {
                "trace_span": True,
                "span_name": self.span_name,
                "span_kind": self.span_kind,
            }
            
            now = datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')
            
            # Insert directly with trace fields
            execute_insert(
                """
                INSERT INTO intelligence_history (
                    id, case_id, computed_at, payload_json,
                    created_at, actor, reason,
                    trace_id, span_id, parent_span_id,
                    span_name, span_kind, duration_ms, error_text,
                    trace_metadata_json, request_id
                ) VALUES (
                    :id, :case_id, :computed_at, :payload_json,
                    :created_at, :actor, :reason,
                    :trace_id, :span_id, :parent_span_id,
                    :span_name, :span_kind, :duration_ms, :error_text,
                    :trace_metadata_json, :request_id
                )
                """,
                {
                    "id": f"span_{self.span_id[:12]}",
                    "case_id": self.case_id,
                    "computed_at": now,
                    "payload_json": json.dumps(payload),
                    "created_at": now,
                    "actor": "trace_system",
                    "reason": f"Trace span: {self.span_name}",
                    "trace_id": self.trace_id,
                    "span_id": self.span_id,
                    "parent_span_id": self.parent_span_id,
                    "span_name": self.span_name,
                    "span_kind": self.span_kind,
                    "duration_ms": self.duration_ms,
                    "error_text": self.error_text,
                    "trace_metadata_json": json.dumps(safe_metadata),
                    "request_id": self.request_id,
                },
            )
        except Exception as e:
            # Never fail the request due to trace recording errors
            import logging
            logger = logging.getLogger(__name__)
            logger.warning(f"Failed to record trace span: {e}")


class TraceContext:
    """
    Static context manager for creating trace spans.
    
    Provides a clean API for instrumentation:
        with TraceContext.start_span("operation_name") as span:
            # work
            pass
    """
    
    @classmethod
    def start_span(
        cls,
        span_name: str,
        span_kind: str = "internal",
        metadata: Optional[Dict[str, Any]] = None,
        case_id: Optional[str] = None,
        request_id: Optional[str] = None,
    ) -> TraceSpan:
        """
        Start a new trace span.
        
        Args:
            span_name: Human-readable operation name
            span_kind: Type of span (internal, ai_call, db_query, http_request)
            metadata: Additional structured data (auto-redacted)
            case_id: Associated case ID (required for persistence)
            request_id: Request ID from middleware
            
        Returns:
            TraceSpan context manager
            
        Example:
            with TraceContext.start_span(
                "ai_inference",
                span_kind="ai_call",
                metadata={"model": "gpt-4", "tokens": 1500},
                case_id="case_123"
            ) as span:
                result = call_ai_model(...)
        """
        return TraceSpan(
            span_name=span_name,
            span_kind=span_kind,
            metadata=metadata,
            case_id=case_id,
            request_id=request_id,
        )
    
    @classmethod
    def get_current_trace_id(cls) -> Optional[str]:
        """Get the current trace ID from context."""
        return _trace_id_var.get()
    
    @classmethod
    def get_current_span_id(cls) -> Optional[str]:
        """Get the current span ID from context."""
        return _parent_span_id_var.get()
    
    @classmethod
    def set_trace_id(cls, trace_id: str):
        """
        Set trace ID explicitly (for propagating from headers).
        
        Use when trace_id is provided by client via X-Trace-Id header.
        """
        _trace_id_var.set(trace_id)


# Helper for redacting metadata (reuse existing patterns)
def redact_metadata(metadata: Dict[str, Any]) -> Dict[str, Any]:
    """
    Redact sensitive fields from trace metadata.
    
    Reuses existing redaction patterns from app.intelligence.redaction.
    """
    if not metadata:
        return {}
    
    # Fields that should never be logged
    SENSITIVE_KEYS = {
        "api_key", "secret", "password", "token", "authorization",
        "ssn", "social_security", "credit_card", "cvv",
        "email", "phone", "address",
    }
    
    redacted = {}
    for key, value in metadata.items():
        key_lower = key.lower()
        
        # Check if key contains sensitive terms
        if any(sensitive in key_lower for sensitive in SENSITIVE_KEYS):
            redacted[key] = "[REDACTED]"
        else:
            # Keep safe values
            redacted[key] = value
    
    return redacted
