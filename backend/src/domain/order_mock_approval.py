from typing import List, Optional

from pydantic import BaseModel

from src.autocomply.domain.csf_hospital import HospitalCsfForm
from src.domain.license_ohio_tddd import OhioTdddFormData


class OhioHospitalOrderApprovalRequest(BaseModel):
    """
    Mock request that bundles:
    - A Hospital CSF form
    - Optional Ohio TDDD license details
    """

    hospital_csf: HospitalCsfForm
    ohio_tddd: Optional[OhioTdddFormData] = None


class OhioHospitalOrderApprovalResult(BaseModel):
    """
    Combined view of CSF decision + Ohio TDDD license decision
    and a final mock order decision.
    """

    csf_status: str
    csf_reason: str
    csf_missing_fields: List[str]

    tddd_status: Optional[str] = None
    tddd_reason: Optional[str] = None
    tddd_missing_fields: Optional[List[str]] = None

    final_decision: str  # "ok_to_ship" | "needs_review" | "blocked"
    notes: List[str]
