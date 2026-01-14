"""
Submission Models

Pydantic models for submission persistence.
"""

from datetime import datetime
from typing import Optional, Dict, Any
from pydantic import BaseModel, Field


class SubmissionRecord(BaseModel):
    """
    Submission record - stores form submission data.
    
    Attributes:
        id: Unique submission ID (UUID)
        createdAt: When submission was created
        updatedAt: When submission was last modified (None if never updated)
        decisionType: Type of decision (csf, csa, etc.)
        submittedBy: Optional user/email who submitted
        accountId: Optional account/tenant ID
        locationId: Optional location ID
        formData: Form field data (key-value pairs)
        rawPayload: Optional raw request payload
        evaluatorOutput: Optional AI/rule engine output
        isDeleted: Soft delete flag (True if deleted)
        deletedAt: When submission was deleted (None if not deleted)
    """
    id: str = Field(..., description="Unique submission ID")
    createdAt: datetime = Field(..., description="Submission timestamp")
    updatedAt: Optional[datetime] = Field(None, description="Last modification timestamp")
    decisionType: str = Field(..., description="Decision type (csf, csa, etc.)")
    submittedBy: Optional[str] = Field(None, description="User who submitted")
    accountId: Optional[str] = Field(None, description="Account/tenant ID")
    locationId: Optional[str] = Field(None, description="Location ID")
    formData: Dict[str, Any] = Field(default_factory=dict, description="Form field data")
    rawPayload: Optional[Dict[str, Any]] = Field(None, description="Raw request payload")
    evaluatorOutput: Optional[Dict[str, Any]] = Field(None, description="AI/evaluator output")
    isDeleted: bool = Field(default=False, description="Soft delete flag")
    deletedAt: Optional[datetime] = Field(None, description="Deletion timestamp")


class SubmissionCreateInput(BaseModel):
    """
    Input for creating a submission.
    
    All fields except decisionType are optional.
    """
    decisionType: str = Field(..., description="Decision type (csf, csa, etc.)")
    submittedBy: Optional[str] = Field(None, description="User who submitted")
    accountId: Optional[str] = Field(None, description="Account/tenant ID")
    locationId: Optional[str] = Field(None, description="Location ID")
    formData: Dict[str, Any] = Field(default_factory=dict, description="Form field data")
    rawPayload: Optional[Dict[str, Any]] = Field(None, description="Raw request payload")
    evaluatorOutput: Optional[Dict[str, Any]] = Field(None, description="AI/evaluator output")


class SubmissionUpdateInput(BaseModel):
    """
    Input for updating a submission.
    
    All fields are optional - only provided fields will be updated.
    """
    decisionType: Optional[str] = Field(None, description="Decision type (csf, csa, etc.)")
    submittedBy: Optional[str] = Field(None, description="User who submitted")
    formData: Optional[Dict[str, Any]] = Field(None, description="Form field data")
    rawPayload: Optional[Dict[str, Any]] = Field(None, description="Raw request payload")
    evaluatorOutput: Optional[Dict[str, Any]] = Field(None, description="AI/evaluator output")


class SubmissionListFilters(BaseModel):
    """
    Query filters for listing submissions.
    
    Supports filtering by:
    - decisionType: Filter by decision type
    - submittedBy: Filter by submitter
    - accountId: Filter by account
    - locationId: Filter by location
    - includeDeleted: Whether to include soft-deleted submissions (default: False)
    """
    decisionType: Optional[str] = Field(None, description="Filter by decision type")
    submittedBy: Optional[str] = Field(None, description="Filter by submitter")
    accountId: Optional[str] = Field(None, description="Filter by account")
    locationId: Optional[str] = Field(None, description="Filter by location")
    includeDeleted: bool = Field(default=False, description="Include deleted submissions")
