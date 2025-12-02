from typing import List

from pydantic import BaseModel, Field


class OhioTdddFormData(BaseModel):
    tddd_number: str
    facility_name: str
    account_number: str | None = None
    ship_to_state: str
    license_type: str = "ohio_tddd"
    attestation_accepted: bool = False
    internal_notes: str | None = None


class OhioTdddDecision(BaseModel):
    status: str
    reason: str
    missing_fields: List[str] = Field(default_factory=list)


class OhioTdddFormCopilotResponse(BaseModel):
    status: str
    reason: str
    missing_fields: List[str]
    regulatory_references: List[str]
    rag_explanation: str
    artifacts_used: List[str]
    rag_sources: List[dict]
