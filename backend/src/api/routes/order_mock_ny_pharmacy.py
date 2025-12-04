from typing import Dict, Optional

from fastapi import APIRouter

from src.api.models.decision import (
    DecisionOutcome,
    DecisionStatus,
    RegulatoryReference,
)
from src.autocomply.domain.decision_risk import compute_risk_for_status
from src.api.routes.license_ny_pharmacy import ny_pharmacy_evaluate
from src.domain.order_mock_ny_pharmacy import NyPharmacyOrderApprovalRequest
from src.api.routes.order_mock_approval import (
    MockOrderDecisionResponse,
    _normalize_references,
)

router = APIRouter(tags=["orders_mock"])


@router.post(
    "/orders/mock/ny-pharmacy-approval",
    response_model=MockOrderDecisionResponse,
)
async def ny_pharmacy_mock_order_approval(
    request: NyPharmacyOrderApprovalRequest,
) -> MockOrderDecisionResponse:
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

    license_status = (
        license_decision.status
        if isinstance(license_decision.status, DecisionStatus)
        else DecisionStatus(str(license_decision.status))
    )

    final_status = DecisionStatus.NEEDS_REVIEW
    if license_status == DecisionStatus.BLOCKED:
        final_status = DecisionStatus.BLOCKED
    elif license_status == DecisionStatus.OK_TO_SHIP:
        final_status = DecisionStatus.OK_TO_SHIP

    notes.append(f"Final mock order decision (NY-only): {final_status.value}")

    if final_status == DecisionStatus.OK_TO_SHIP:
        reason = "Order approved: NY Pharmacy license is ok_to_ship for this order."
    elif final_status == DecisionStatus.BLOCKED:
        reason = "Order blocked: NY Pharmacy license is blocked."
    else:
        reason = "Order needs manual review: NY Pharmacy license is not ok_to_ship."

    risk_level, risk_score = compute_risk_for_status(final_status.value)

    decision = DecisionOutcome(
        status=final_status,
        reason=reason,
        risk_level=risk_level,
        risk_score=risk_score,
        regulatory_references=_normalize_references(
            getattr(license_decision, "regulatory_references", [])
        ),
        debug_info={"notes": notes},
    )

    developer_trace: Optional[Dict[str, str]] = {"notes": notes}

    return MockOrderDecisionResponse(
        decision=decision,
        license_engine="ny-pharmacy",
        scenario_id="ny-pharmacy-happy-path",
        developer_trace=developer_trace,
        license_status=license_status.value,
        license_reason=license_decision.reason,
        license_missing_fields=getattr(license_decision, "missing_fields", None),
        final_decision=decision.status.value,
        notes=notes,
    )


@router.get(
    "/orders/mock/ny-pharmacy-expired-license",
    response_model=MockOrderDecisionResponse,
)
async def ny_pharmacy_expired_license_mock() -> MockOrderDecisionResponse:
    """
    Mock order: NY pharmacy where the license is EXPIRED.

    Expected:
    - License decision: blocked + high risk due to expiration.
    """

    status = DecisionStatus.BLOCKED
    reason = (
        "Order blocked: NY pharmacy license is expired, so controlled substance "
        "orders cannot be shipped until the license is renewed."
    )

    risk_level, risk_score = compute_risk_for_status(status.value)

    decision = DecisionOutcome(
        status=status,
        reason=reason,
        risk_level=risk_level,
        risk_score=risk_score,
        regulatory_references=[
            RegulatoryReference(
                id="ny-pharmacy-core",
                jurisdiction="US-NY",
                source="NY Pharmacy Board (stub)",
                citation=None,
                label="NY pharmacy license required and must be active",
            )
        ],
        trace_id=None,
        debug_info=None,
    )

    return MockOrderDecisionResponse(
        decision=decision,
        csf_engine=None,
        license_engine="ny-pharmacy",
        scenario_id="ny-pharmacy-expired-license",
        developer_trace=None,
    )


@router.get(
    "/orders/mock/ny-pharmacy-wrong-state",
    response_model=MockOrderDecisionResponse,
)
async def ny_pharmacy_wrong_state_mock() -> MockOrderDecisionResponse:
    """
    Mock order: NY pharmacy license but ship-to state is NOT NY.

    Expected:
    - License decision: needs_review + medium risk.
    """

    status = DecisionStatus.NEEDS_REVIEW
    reason = (
        "Order requires review: ship-to state is outside New York, so this NY pharmacy "
        "license may not cover dispensing in the destination state."
    )

    risk_level, risk_score = compute_risk_for_status(status.value)

    decision = DecisionOutcome(
        status=status,
        reason=reason,
        risk_level=risk_level,
        risk_score=risk_score,
        regulatory_references=[
            RegulatoryReference(
                id="ny-pharmacy-core",
                jurisdiction="US-NY",
                source="NY Pharmacy Board (stub)",
                citation=None,
                label="NY pharmacy license scope may be limited to New York",
            )
        ],
        trace_id=None,
        debug_info=None,
    )

    return MockOrderDecisionResponse(
        decision=decision,
        csf_engine=None,
        license_engine="ny-pharmacy",
        scenario_id="ny-pharmacy-wrong-state",
        developer_trace=None,
    )
