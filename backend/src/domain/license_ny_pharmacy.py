from typing import List, Optional

from pydantic import BaseModel, Field


class NyPharmacyFormData(BaseModel):
    """
    Input payload for NY Pharmacy license checks.

    In a real system, this would be aligned to actual NY
    Board of Pharmacy registration fields. For this prototype
    we keep it intentionally simple but explicit.
    """

    pharmacy_name: str = Field(..., description="Name of the pharmacy or facility.")
    account_number: str = Field(..., description="Customer account number.")
    ship_to_state: str = Field(
        "NY",
        description="Ship-to state. For this engine we expect NY.",
    )
    dea_number: Optional[str] = Field(
        None,
        description="DEA registration number, if applicable.",
    )
    ny_state_license_number: str = Field(
        ...,
        description="NY State Board of Pharmacy license number.",
    )
    attestation_accepted: bool = Field(
        ...,
        description="Whether the user accepted license compliance attestation.",
    )
    internal_notes: Optional[str] = Field(
        None,
        description="Free-form notes for internal or support use.",
    )
    license_type: str = Field(
        "ny_pharmacy",
        description="Identifier for the NY Pharmacy license engine.",
    )


class NyPharmacyDecision(BaseModel):
    """
    Output decision for NY Pharmacy license evaluations.
    """

    status: str = Field(
        ...,
        description="ok_to_ship | needs_review | blocked",
    )
    reason: str = Field(..., description="Short explanation of the decision.")
    missing_fields: List[str] = Field(
        default_factory=list,
        description="Any required fields that were missing or invalid.",
    )


class NyPharmacyFormCopilotResponse(BaseModel):
    status: str
    reason: str
    missing_fields: List[str]
    regulatory_references: List[str]
    rag_explanation: str
    artifacts_used: List[str]
    rag_sources: List[dict]
