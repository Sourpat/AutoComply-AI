"""
Phase 7.33: Request ID Middleware
Generates and propagates X-Request-Id for request tracing and observability.

Author: AutoComply AI
Date: 2026-01-21
"""

import uuid
import logging
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp

logger = logging.getLogger(__name__)

REQUEST_ID_HEADER = "X-Request-Id"


class RequestIDMiddleware(BaseHTTPMiddleware):
    """
    Middleware to generate and propagate request IDs for tracing.
    
    Features:
    - Generates UUID if X-Request-Id not present in request
    - Reuses X-Request-Id if provided by client
    - Adds X-Request-Id to response headers
    - Includes request_id in structured logs
    - Stores request_id in request.state for downstream access
    
    Usage:
        app.add_middleware(RequestIDMiddleware)
        
        # In route handlers:
        request_id = request.state.request_id
    """
    
    def __init__(self, app: ASGIApp):
        super().__init__(app)
    
    async def dispatch(self, request: Request, call_next):
        # Get or generate request ID
        request_id = request.headers.get(REQUEST_ID_HEADER)
        
        if not request_id:
            # Generate new UUID for this request
            request_id = str(uuid.uuid4())
        
        # Store in request state for route handlers
        request.state.request_id = request_id
        
        # Log incoming request with ID
        logger.info(
            f"Request started: {request.method} {request.url.path}",
            extra={
                "request_id": request_id,
                "method": request.method,
                "path": request.url.path,
                "client_ip": request.client.host if request.client else None,
            }
        )
        
        try:
            # Process request
            response: Response = await call_next(request)
            
            # Add request ID to response headers
            response.headers[REQUEST_ID_HEADER] = request_id
            
            # Log successful response
            logger.info(
                f"Request completed: {request.method} {request.url.path} - {response.status_code}",
                extra={
                    "request_id": request_id,
                    "status_code": response.status_code,
                }
            )
            
            return response
            
        except Exception as exc:
            # Log exception with request ID
            logger.error(
                f"Request failed: {request.method} {request.url.path}",
                extra={
                    "request_id": request_id,
                    "error": str(exc),
                },
                exc_info=True
            )
            raise


def get_request_id(request: Request) -> str:
    """
    Helper to retrieve request ID from request state.
    
    Args:
        request: FastAPI Request object
        
    Returns:
        Request ID (UUID string)
        
    Example:
        request_id = get_request_id(request)
    """
    return getattr(request.state, "request_id", None) or str(uuid.uuid4())
