from fastapi import APIRouter

from src.api.routes.license_ny_pharmacy import ny_pharmacy_evaluate
from src.domain.order_mock_ny_pharmacy import (
    NyPharmacyOrderApprovalRequest,
    NyPharmacyOrderApprovalResult,
)

router = APIRouter(tags=["orders_mock"])


@router.post(
    "/orders/mock/ny-pharmacy-approval",
    response_model=NyPharmacyOrderApprovalResult,
)
async def ny_pharmacy_mock_order_approval(
    request: NyPharmacyOrderApprovalRequest,
) -> NyPharmacyOrderApprovalResult:
    """
    Mock order-approval endpoint that uses only the NY Pharmacy license engine.

    Rules (for prototype):

    - If NY Pharmacy license evaluation = ok_to_ship -> final_decision = ok_to_ship.
    - Otherwise (needs_review / blocked) -> final_decision mirrors license_status.

    This simulates a license-gated order flow where the license is the main
    decision driver.
    """
    license_decision = await ny_pharmacy_evaluate(request.ny_pharmacy)

    notes: list[str] = [
        f"NY Pharmacy license decision: {license_decision.status} – {license_decision.reason}"
    ]

    license_status = license_decision.status

    # Default result is conservative (needs_review) unless explicitly ok_to_ship.
    final_status = "needs_review"
    if license_status == "blocked":
        final_status = "blocked"
    elif license_status == "ok_to_ship":
        final_status = "ok_to_ship"

    notes.append(f"Final mock order decision (NY-only): {final_status}")

    return NyPharmacyOrderApprovalResult(
        license_status=license_decision.status,
        license_reason=license_decision.reason,
        license_missing_fields=license_decision.missing_fields,
        final_decision=final_status,
        notes=notes,
    )
