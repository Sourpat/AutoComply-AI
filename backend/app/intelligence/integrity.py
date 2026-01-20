"""
Integrity Utilities for Intelligence History (Phase 7.20).

Provides functions for:
- Computing stable input hashes
- Verifying audit chain integrity
- Detecting tampering
"""

import hashlib
import json
from typing import Dict, Any, List, Optional


def compute_input_hash(case_data: Dict[str, Any], submission_data: Optional[Dict[str, Any]] = None) -> str:
    """
    Compute a stable hash of intelligence computation inputs.
    
    Uses normalized, sorted JSON to ensure consistent hashing across recomputes.
    Includes:
    - Case metadata (status, assigned_to, priority)
    - Submission data (if available)
    - Evidence count
    - Policy version
    
    Args:
        case_data: Case record dict with fields like status, submission_id, etc.
        submission_data: Optional submission record dict
        
    Returns:
        SHA256 hex digest (64 chars)
        
    Example:
        >>> compute_input_hash(
        ...     {"id": "case_123", "status": "in_review", "submission_id": "sub_456"},
        ...     {"decision_type": "csf_practitioner", "form_data": {...}}
        ... )
        "a1b2c3d4..."
    """
    # Build normalized input dict
    normalized_input = {
        "case_id": case_data.get("id", ""),
        "case_status": case_data.get("status", ""),
        "submission_id": case_data.get("submission_id", ""),
        "decision_type": case_data.get("decision_type", ""),
    }
    
    # Add submission data if available
    if submission_data:
        normalized_input["submission_decision_type"] = submission_data.get("decision_type", "")
        normalized_input["submission_timestamp"] = submission_data.get("created_at", "")
        
        # Include responses (full values) - these determine intelligence computation
        responses = submission_data.get("responses", {})
        if isinstance(responses, dict):
            normalized_input["responses"] = {k: v for k, v in sorted(responses.items())}
        
        # Also include form_data if it exists
        form_data = submission_data.get("form_data", {})
        if isinstance(form_data, dict) and form_data:
            normalized_input["form_data"] = {k: v for k, v in sorted(form_data.items())}
    
    # Convert to sorted JSON string for stable hashing
    json_str = json.dumps(normalized_input, sort_keys=True, separators=(',', ':'))
    
    # Compute SHA256 hash
    return hashlib.sha256(json_str.encode('utf-8')).hexdigest()


def verify_audit_chain(history_entries: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Verify integrity of audit chain by checking previous_run_id links.
    
    Args:
        history_entries: List of history entries sorted by computed_at DESC
        
    Returns:
        Dict with:
        - is_valid: bool
        - broken_links: List of entries with invalid previous_run_id
        - orphaned_entries: List of entries not linked by any other
        
    Example:
        >>> verify_audit_chain([
        ...     {"id": "hist_2", "previous_run_id": "hist_1", ...},
        ...     {"id": "hist_1", "previous_run_id": None, ...}
        ... ])
        {"is_valid": True, "broken_links": [], "orphaned_entries": []}
    """
    if not history_entries:
        return {"is_valid": True, "broken_links": [], "orphaned_entries": []}
    
    # Build lookup map
    entry_by_id = {entry["id"]: entry for entry in history_entries}
    
    # Track which entries are referenced
    referenced_ids = set()
    broken_links = []
    
    # Check each entry's previous_run_id
    for entry in history_entries:
        prev_id = entry.get("previous_run_id")
        
        if prev_id:
            referenced_ids.add(prev_id)
            
            # Check if previous entry exists
            if prev_id not in entry_by_id:
                broken_links.append({
                    "entry_id": entry["id"],
                    "missing_previous_id": prev_id,
                    "computed_at": entry.get("computed_at")
                })
    
    # Find orphaned entries (not referenced by any other, except the newest)
    all_ids = set(entry_by_id.keys())
    
    # The newest entry (first in DESC order) should not be referenced
    newest_id = history_entries[0]["id"] if history_entries else None
    
    # Orphaned = not referenced and not the newest
    orphaned_entries = []
    for entry_id in all_ids:
        if entry_id != newest_id and entry_id not in referenced_ids:
            orphaned_entries.append({
                "entry_id": entry_id,
                "computed_at": entry_by_id[entry_id].get("computed_at")
            })
    
    is_valid = len(broken_links) == 0 and len(orphaned_entries) == 0
    
    return {
        "is_valid": is_valid,
        "broken_links": broken_links,
        "orphaned_entries": orphaned_entries,
        "total_entries": len(history_entries),
        "newest_entry_id": newest_id
    }


def detect_duplicate_computations(history_entries: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Detect duplicate computations with identical input_hash.
    
    Useful for identifying unnecessary recomputations or potential tampering.
    
    Args:
        history_entries: List of history entries
        
    Returns:
        List of duplicate groups, each containing:
        - input_hash: The duplicated hash
        - entry_ids: List of entry IDs with this hash
        - count: Number of duplicates
        
    Example:
        >>> detect_duplicate_computations([
        ...     {"id": "hist_2", "input_hash": "abc123", ...},
        ...     {"id": "hist_1", "input_hash": "abc123", ...}
        ... ])
        [{"input_hash": "abc123", "entry_ids": ["hist_2", "hist_1"], "count": 2}]
    """
    hash_to_entries: Dict[str, List[str]] = {}
    
    for entry in history_entries:
        input_hash = entry.get("input_hash")
        if input_hash:
            if input_hash not in hash_to_entries:
                hash_to_entries[input_hash] = []
            hash_to_entries[input_hash].append(entry["id"])
    
    # Return only hashes with duplicates
    duplicates = []
    for input_hash, entry_ids in hash_to_entries.items():
        if len(entry_ids) > 1:
            duplicates.append({
                "input_hash": input_hash,
                "entry_ids": entry_ids,
                "count": len(entry_ids)
            })
    
    return duplicates
