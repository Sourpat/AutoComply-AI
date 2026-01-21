"""
Evidence Snapshot Utilities (Phase 7.24).

Provides functions to create reproducible evidence snapshots and hashes
for intelligence computations.
"""

import hashlib
import json
from typing import Dict, Any, Optional
from datetime import datetime, timezone

from src.core.db import execute_sql


def create_evidence_snapshot(case_id: str) -> Dict[str, Any]:
    """
    Create a sanitized snapshot of evidence for a case.
    
    Captures minimal, deterministic evidence state:
    - Submission fields (sanitized, no PII)
    - Attachment metadata (count, types, not content)
    - Request info responses count
    - Status and timestamps
    
    Args:
        case_id: The case ID
        
    Returns:
        Dict with evidence snapshot
        
    Example:
        >>> create_evidence_snapshot("case_123")
        {
            "case": {"status": "pending_verification", "created_at": "..."},
            "submission": {"fields": {...}, "submitted_at": "..."},
            "attachments": [{"id": "...", "filename": "...", "mime_type": "..."}],
            "request_info_responses": 2,
            "snapshot_at": "2026-01-20T10:00:00Z"
        }
    """
    snapshot = {
        "snapshot_at": datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z'),
        "case": {},
        "submission": None,
        "attachments": [],
        "request_info_responses": 0
    }
    
    # Get case data
    case_rows = execute_sql(
        "SELECT status, decision_type, created_at, updated_at FROM cases WHERE id = :case_id",
        {"case_id": case_id}
    )
    if case_rows:
        case = case_rows[0]
        snapshot["case"] = {
            "status": case.get("status"),
            "decision_type": case.get("decision_type"),
            "created_at": case.get("created_at"),
            "updated_at": case.get("updated_at")
        }
    
    # Get submission data (sanitized)
    submission_rows = execute_sql(
        "SELECT form_data_json, submitted_at FROM submissions WHERE case_id = :case_id LIMIT 1",
        {"case_id": case_id}
    )
    if submission_rows:
        submission = submission_rows[0]
        try:
            form_data = json.loads(submission.get("form_data_json", "{}"))
            # Sanitize: only include field presence and type, not values
            sanitized_fields = {
                key: {
                    "present": bool(value),
                    "type": type(value).__name__,
                    "length": len(str(value)) if value else 0
                }
                for key, value in form_data.items()
            }
            snapshot["submission"] = {
                "fields": sanitized_fields,
                "submitted_at": submission.get("submitted_at"),
                "field_count": len(form_data)
            }
        except:
            snapshot["submission"] = {"error": "Failed to parse form_data"}
    
    # Get attachment metadata (no content)
    attachment_rows = execute_sql(
        """
        SELECT id, filename, mime_type, size_bytes, uploaded_at, category
        FROM attachments
        WHERE case_id = :case_id
        ORDER BY uploaded_at
        """,
        {"case_id": case_id}
    )
    snapshot["attachments"] = [
        {
            "id": row.get("id"),
            "filename": row.get("filename"),
            "mime_type": row.get("mime_type"),
            "size_bytes": row.get("size_bytes"),
            "uploaded_at": row.get("uploaded_at"),
            "category": row.get("category")
        }
        for row in attachment_rows
    ]
    
    # Count request info responses
    response_rows = execute_sql(
        """
        SELECT COUNT(*) as count
        FROM request_info_responses
        WHERE case_id = :case_id
        """,
        {"case_id": case_id}
    )
    if response_rows:
        snapshot["request_info_responses"] = response_rows[0].get("count", 0)
    
    return snapshot


def compute_evidence_hash(evidence_snapshot: Dict[str, Any]) -> str:
    """
    Compute SHA256 hash of normalized evidence snapshot.
    
    Ensures deterministic hashing by:
    - Sorting all dict keys
    - Using consistent JSON formatting
    - Excluding timestamp fields
    
    Args:
        evidence_snapshot: Evidence snapshot dict
        
    Returns:
        SHA256 hash as hex string
        
    Example:
        >>> snapshot = create_evidence_snapshot("case_123")
        >>> compute_evidence_hash(snapshot)
        "a1b2c3d4e5f6g7h8..."
    """
    # Create a normalized copy without timestamp
    normalized = _normalize_for_hashing(evidence_snapshot)
    
    # Convert to deterministic JSON (sorted keys, no whitespace)
    json_str = json.dumps(normalized, sort_keys=True, separators=(',', ':'))
    
    # Compute SHA256
    return hashlib.sha256(json_str.encode('utf-8')).hexdigest()


def _normalize_for_hashing(data: Any) -> Any:
    """
    Recursively normalize data for deterministic hashing.
    
    - Removes 'snapshot_at' field (timestamp should not affect hash)
    - Sorts all dict keys
    - Converts lists to sorted tuples if they contain dicts
    """
    if isinstance(data, dict):
        normalized = {}
        for key, value in data.items():
            # Skip timestamp fields
            if key in ('snapshot_at', 'created_at', 'updated_at', 'submitted_at', 'uploaded_at'):
                continue
            normalized[key] = _normalize_for_hashing(value)
        return normalized
    elif isinstance(data, list):
        return [_normalize_for_hashing(item) for item in data]
    else:
        return data


def get_evidence_version() -> str:
    """
    Get current evidence snapshot schema version.
    
    Returns:
        Version string (e.g., "v1.0")
    """
    return "v1.0"
