from datetime import date
from typing import List, Optional

from pydantic import BaseModel, Field


class OhioTdddFormData(BaseModel):
    tddd_number: Optional[str] = None
    license_number: Optional[str] = None
    facility_name: str
    account_number: str | None = None
    ship_to_state: str
    license_type: str = "ohio_tddd"
    expiration_date: Optional[date] = None
    attestation_accepted: bool = False
    internal_notes: str | None = None

    @property
    def normalized_license_number(self) -> Optional[str]:
        """Return whichever license identifier was provided."""

        return self.tddd_number or self.license_number


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
