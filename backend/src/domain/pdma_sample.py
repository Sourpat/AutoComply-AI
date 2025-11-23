from __future__ import annotations

from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, Field


class PdmaProductCategory(str, Enum):
    RX_BRAND = "rx_brand"
    RX_GENERIC = "rx_generic"
    OTC = "otc"
    DEVICE = "device"


class PdmaChannel(str, Enum):
    OFFICE = "office"  # direct to prescriber office
    CLINIC = "clinic"
    HOSPITAL = "hospital"
    PHARMACY = "pharmacy"
    WAREHOUSE = "warehouse"


class PdmaPatientType(str, Enum):
    ADULT = "adult"
    PEDIATRIC = "pediatric"


class RegulatoryReference(BaseModel):
    id: str
    label: str
    source_document: str  # NOTE: this is a /mnt/data/... path, treated as URL by runtime


class PdmaSampleRequest(BaseModel):
    """
    Minimal PDMA-style sample eligibility request.

    This is intentionally simplified. It is *not* legal advice and does not
    encode the full PDMA; it just gives us a realistic rule slice and payload.
    """

    account_number: str = Field(..., min_length=1)
    prescriber_npi: str = Field(..., min_length=1)
    prescriber_name: str = Field(..., min_length=1)
    prescriber_specialty: str = Field(..., min_length=1)
    prescriber_state: str = Field(..., min_length=2, max_length=2)

    patient_type: PdmaPatientType

    product_name: str = Field(..., min_length=1)
    product_ndc: Optional[str] = None
    product_category: PdmaProductCategory

    quantity_requested: int = Field(
        ...,
        gt=0,
        le=100,
        description="Requested number of sample packs (simple upper bound for demo).",
    )

    distribution_channel: PdmaChannel

    is_government_account: bool = False
    is_federal_staff: bool = False


class PdmaVerdictStatus(str, Enum):
    ELIGIBLE = "eligible"
    INELIGIBLE = "ineligible"
    MANUAL_REVIEW = "manual_review"


class PdmaSampleVerdict(BaseModel):
    status: PdmaVerdictStatus
    reasons: List[str]
    regulatory_references: List[RegulatoryReference]


# Single PDMA regulatory reference, mapped to an existing document under /mnt/data.
PDMA_REGULATORY_REFERENCE = RegulatoryReference(
    id="pdma_sample_eligibility",
    label="PDMA-style sample eligibility policy (demo)",
    # Using an existing uploaded document as the backing artifact.
    source_document="/mnt/data/FLORIDA TEST.pdf",
)


def evaluate_pdma_sample(request: PdmaSampleRequest) -> PdmaSampleVerdict:
    """
    Tiny PDMA-style rule slice.

    This is deliberately simplified and only meant to show how a new
    regulatory rule family can plug into the engine/explain/RAG pipeline.
    """

    reasons: List[str] = []
    status = PdmaVerdictStatus.ELIGIBLE

    # 1) Government / federal accounts: ineligible for samples
    if request.is_government_account or request.is_federal_staff:
        status = PdmaVerdictStatus.INELIGIBLE
        reasons.append(
            "Samples cannot be distributed to government or federal accounts "
            "under the PDMA-style policy used in this demo."
        )

    # 2) Only Rx products may be sampled
    if request.product_category in {PdmaProductCategory.OTC, PdmaProductCategory.DEVICE}:
        # Upgrade to INELIGIBLE if not already worse than manual_review
        status = PdmaVerdictStatus.INELIGIBLE
        reasons.append(
            "Only prescription (Rx) products may be sampled; OTC and devices "
            "are not eligible in this demo policy."
        )

    # 3) Channel restrictions: samples should go to HCP settings, not pharmacies/warehouses
    if request.distribution_channel in {PdmaChannel.PHARMACY, PdmaChannel.WAREHOUSE}:
        # If we already have hard ineligibility, keep it; otherwise mark as manual review
        if status == PdmaVerdictStatus.ELIGIBLE:
            status = PdmaVerdictStatus.MANUAL_REVIEW
        reasons.append(
            "Distribution channel is pharmacy/warehouse. This typically requires "
            "manual compliance review rather than direct sample shipment."
        )

    # 4) Large quantities push to manual review
    if request.quantity_requested > 50 and status == PdmaVerdictStatus.ELIGIBLE:
        status = PdmaVerdictStatus.MANUAL_REVIEW
        reasons.append(
            "Requested quantity is unusually high and should be reviewed by compliance."
        )

    # 5) Pediatric + non-specialist prescriber → manual review
    if (
        request.patient_type == PdmaPatientType.PEDIATRIC
        and "pediatr" not in request.prescriber_specialty.lower()
        and status == PdmaVerdictStatus.ELIGIBLE
    ):
        status = PdmaVerdictStatus.MANUAL_REVIEW
        reasons.append(
            "Pediatric patient but prescriber specialty does not appear pediatric-focused; "
            "route to manual review."
        )

    # If no rule fired, add a positive reason for transparency
    if not reasons:
        reasons.append(
            "No PDMA-style blocking conditions matched; request is eligible in this demo engine."
        )

    return PdmaSampleVerdict(
        status=status,
        reasons=reasons,
        regulatory_references=[PDMA_REGULATORY_REFERENCE],
    )


class PdmaSampleExplainRequest(BaseModel):
    decision: PdmaSampleVerdict


class PdmaSampleExplainResponse(BaseModel):
    decision: PdmaSampleVerdict
    short_explanation: str
    regulatory_references: List[RegulatoryReference]
