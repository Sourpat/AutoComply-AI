from __future__ import annotations

import uuid
from typing import Optional

TRACE_HEADER_NAME = "x-autocomply-trace-id"


def generate_trace_id() -> str:
    """
    Generate a new trace ID for a decision journey.

    UUIDv4 is fine here; if you later want ULIDs or span IDs, this is the swap point.
    """

    return str(uuid.uuid4())


def ensure_trace_id(existing: Optional[str] = None) -> str:
    """
    Return the existing trace_id if provided, otherwise generate a new one.
    """

    if existing:
        return existing
    return generate_trace_id()
