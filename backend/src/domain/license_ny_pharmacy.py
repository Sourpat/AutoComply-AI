from typing import List, Optional

from datetime import date

from pydantic import BaseModel, Field, root_validator


class NyPharmacyFormData(BaseModel):
    """
    Input payload for NY Pharmacy license checks.

    In a real system, this would be aligned to actual NY
    Board of Pharmacy registration fields. For this prototype
    we keep it intentionally simple but explicit.
    """

    pharmacy_name: Optional[str] = Field(
        None, description="Name of the pharmacy or facility. Optional for mocks."
    )
    account_number: Optional[str] = Field(
        None, description="Customer account number. Optional for mocks."
    )
    ship_to_state: str = Field(
        "NY",
        description="Ship-to state. For this engine we expect NY.",
    )
    dea_number: Optional[str] = Field(
        None,
        description="DEA registration number, if applicable.",
    )
    ny_state_license_number: Optional[str] = Field(
        None,
        description="NY State Board of Pharmacy license number.",
    )
    license_number: Optional[str] = Field(
        None,
        description=(
            "Generic license number alias to align with scenario builders or other"
            " license payload shapes."
        ),
    )
    expiration_date: Optional[date] = Field(
        None,
        description="License expiration date (ISO format).",
    )
    attestation_accepted: bool = Field(
        True,
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

    @root_validator(pre=True)
    def require_some_license_number(cls, values: dict) -> dict:
        has_license_number = (
            values.get("ny_state_license_number") is not None
            or values.get("license_number") is not None
        )
        if not has_license_number:
            raise ValueError("ny_state_license_number or license_number is required")
        return values


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
