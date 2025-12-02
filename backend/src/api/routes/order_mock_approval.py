from fastapi import APIRouter

from src.api.routes.csf_hospital import evaluate_hospital_csf_endpoint
from src.api.routes.license_ohio_tddd import ohio_tddd_evaluate
from src.domain.order_mock_approval import (
    OhioHospitalOrderApprovalRequest,
    OhioHospitalOrderApprovalResult,
)

router = APIRouter(tags=["orders_mock"])


@router.post(
    "/orders/mock/ohio-hospital-approval",
    response_model=OhioHospitalOrderApprovalResult,
)
async def ohio_hospital_mock_order_approval(
    request: OhioHospitalOrderApprovalRequest,
) -> OhioHospitalOrderApprovalResult:
    """
    Mock orchestration endpoint that shows how CSF + Ohio TDDD
    decisions combine into a final order decision for an Ohio
    hospital ordering controlled substances.
    """

    # --- Step 1: Hospital CSF evaluation ---
    csf_decision = await evaluate_hospital_csf_endpoint(request.hospital_csf)

    notes: list[str] = []
    csf_status = (
        csf_decision.status.value
        if hasattr(csf_decision.status, "value")
        else str(csf_decision.status)
    )

    notes.append(
        f"Hospital CSF decision: {csf_status} – {csf_decision.reason}"
    )

    tddd_decision = None

    # --- Step 2: Optional Ohio TDDD evaluation ---
    if request.ohio_tddd is not None:
        tddd_decision = await ohio_tddd_evaluate(request.ohio_tddd)
        tddd_status = (
            tddd_decision.status
            if isinstance(tddd_decision.status, str)
            else str(tddd_decision.status)
        )
        notes.append(
            f"Ohio TDDD decision: {tddd_status} – {tddd_decision.reason}"
        )
    else:
        notes.append(
            "No Ohio TDDD payload provided – skipping license evaluation for this mock order."
        )

    # --- Step 3: Compute final decision ---
    tddd_status = (
        tddd_decision.status if tddd_decision is not None else None
    )
    if tddd_status is not None and not isinstance(tddd_status, str):
        tddd_status = str(tddd_status)

    # Default: needs_review (conservative)
    final_status = "needs_review"

    # If either side is blocked, overall is blocked
    if csf_status == "blocked" or tddd_status == "blocked":
        final_status = "blocked"
    # If CSF is ok_to_ship and TDDD is either ok_to_ship or absent, we allow
    elif csf_status == "ok_to_ship" and (tddd_status in (None, "ok_to_ship")):
        final_status = "ok_to_ship"
    # Else (e.g. CSF ok but TDDD needs_review, or CSF needs_review): final stays needs_review

    notes.append(f"Final mock order decision: {final_status}")

    return OhioHospitalOrderApprovalResult(
        csf_status=csf_status,
        csf_reason=csf_decision.reason,
        csf_missing_fields=csf_decision.missing_fields,
        tddd_status=tddd_status,
        tddd_reason=tddd_decision.reason if tddd_decision is not None else None,
        tddd_missing_fields=(
            tddd_decision.missing_fields if tddd_decision is not None else None
        ),
        final_decision=final_status,
        notes=notes,
    )
