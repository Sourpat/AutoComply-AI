from typing import List

from pydantic import BaseModel

from src.domain.license_ny_pharmacy import NyPharmacyFormData


class NyPharmacyOrderApprovalRequest(BaseModel):
    """
    Mock order-approval request that uses only the NY Pharmacy license engine.
    In a real system this would also include product / order-line info.
    """

    ny_pharmacy: NyPharmacyFormData


class NyPharmacyOrderApprovalResult(BaseModel):
    """
    Combined view of NY Pharmacy license decision and an order-level decision.
    """

    license_status: str
    license_reason: str
    license_missing_fields: List[str]

    final_decision: str  # "ok_to_ship" | "needs_review" | "blocked"
    notes: List[str]
