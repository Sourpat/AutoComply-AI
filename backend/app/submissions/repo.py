"""
Submission Repository

SQLite-backed storage for submissions.
"""

import json
from datetime import datetime
from typing import Dict, List, Optional
from uuid import uuid4

from src.core.db import execute_sql, execute_insert, execute_update, execute_delete

from .models import (
    SubmissionRecord,
    SubmissionCreateInput,
    SubmissionListFilters,
)


# ============================================================================
# Helper Functions
# ============================================================================

def _row_to_submission(row: Dict) -> SubmissionRecord:
    """Convert database row to SubmissionRecord."""
    return SubmissionRecord(
        id=row["id"],
        createdAt=datetime.fromisoformat(row["created_at"]),
        decisionType=row["decision_type"],
        submittedBy=row["submitted_by"],
        accountId=row["account_id"],
        locationId=row["location_id"],
        formData=json.loads(row["form_data"]) if row["form_data"] else {},
        rawPayload=json.loads(row["raw_payload"]) if row["raw_payload"] else {},
        evaluatorOutput=json.loads(row["evaluator_output"]) if row["evaluator_output"] else None,
        status=row.get("status"),
    )


# ============================================================================
# CRUD Operations
# ============================================================================

def create_submission(input_data: SubmissionCreateInput) -> SubmissionRecord:
    """
    Create a new submission.
    
    Args:
        input_data: Submission creation data
        
    Returns:
        Created SubmissionRecord
        
    Example:
        >>> submission = create_submission(SubmissionCreateInput(
        ...     decisionType="csf",
        ...     submittedBy="user@example.com",
        ...     formData={"name": "Dr. Smith", "license": "12345"}
        ... ))
        >>> print(submission.id)
    """
    submission_id = str(uuid4())
    now = datetime.utcnow()
    
    execute_insert("""
        INSERT INTO submissions (
            id, created_at, decision_type, submitted_by, account_id,
            location_id, form_data, raw_payload, evaluator_output, status
        ) VALUES (
            :id, :created_at, :decision_type, :submitted_by, :account_id,
            :location_id, :form_data, :raw_payload, :evaluator_output, :status
        )
    """, {
        "id": submission_id,
        "created_at": now.isoformat(),
        "decision_type": input_data.decisionType,
        "submitted_by": input_data.submittedBy,
        "account_id": input_data.accountId,
        "location_id": input_data.locationId,
        "form_data": json.dumps(input_data.formData),
        "raw_payload": json.dumps(input_data.rawPayload) if input_data.rawPayload else None,
        "evaluator_output": json.dumps(input_data.evaluatorOutput) if input_data.evaluatorOutput else None,
        "status": "submitted",
    })
    
    # Return created submission
    return get_submission(submission_id)


def get_submission(submission_id: str) -> Optional[SubmissionRecord]:
    """
    Retrieve a submission by ID.
    
    Args:
        submission_id: Submission UUID
        
    Returns:
        SubmissionRecord if found, None otherwise
        
    Example:
        >>> submission = get_submission("550e8400-e29b-41d4-a716-446655440000")
        >>> if submission:
        ...     print(submission.decisionType)
    """
    rows = execute_sql(
        "SELECT * FROM submissions WHERE id = :id",
        {"id": submission_id}
    )
    
    if not rows:
        return None
    
    return _row_to_submission(rows[0])


def list_submissions(filters: Optional[SubmissionListFilters] = None) -> List[SubmissionRecord]:
    """
    List submissions with optional filtering.
    
    Args:
        filters: Optional filters (decisionType, submittedBy, accountId, locationId)
        
    Returns:
        List of SubmissionRecords sorted by createdAt (newest first)
        
    Example:
        >>> # Get all CSF submissions
        >>> csf_submissions = list_submissions(
        ...     SubmissionListFilters(decisionType="csf")
        ... )
        
        >>> # Get submissions by user
        >>> user_submissions = list_submissions(
        ...     SubmissionListFilters(submittedBy="user@example.com")
        ... )
    """
    # Build dynamic WHERE clause
    where_clauses = []
    params = {}
    
    if filters:
        if filters.decisionType:
            where_clauses.append("decision_type = :decision_type")
            params["decision_type"] = filters.decisionType
        
        if filters.submittedBy:
            where_clauses.append("submitted_by = :submitted_by")
            params["submitted_by"] = filters.submittedBy
        
        if filters.accountId:
            where_clauses.append("account_id = :account_id")
            params["account_id"] = filters.accountId
        
        if filters.locationId:
            where_clauses.append("location_id = :location_id")
            params["location_id"] = filters.locationId
    
    # Build SQL
    sql = "SELECT * FROM submissions"
    if where_clauses:
        sql += " WHERE " + " AND ".join(where_clauses)
    sql += " ORDER BY created_at DESC"
    
    rows = execute_sql(sql, params)
    return [_row_to_submission(row) for row in rows]


def delete_submission(submission_id: str) -> bool:
    """
    Delete a submission.
    
    Args:
        submission_id: Submission UUID
        
    Returns:
        True if deleted, False if not found
        
    Example:
        >>> deleted = delete_submission("550e8400-e29b-41d4-a716-446655440000")
    """
    count = execute_delete(
        "DELETE FROM submissions WHERE id = :id",
        {"id": submission_id}
    )
    return count > 0


def clear_all_submissions():
    """
    Clear all submissions from store (useful for testing).
    
    Example:
        >>> clear_all_submissions()
    """
    execute_delete("DELETE FROM submissions", {})
