from typing import Any, Dict, List, Optional

from fastapi import APIRouter
from pydantic import BaseModel

from src.api.models.decision import (
    DecisionOutcome,
    DecisionStatus,
    RegulatoryReference,
)
from src.autocomply.domain.decision_risk import compute_risk_for_status
from src.api.routes.csf_hospital import evaluate_hospital_csf_endpoint
from src.api.routes.license_ohio_tddd import ohio_tddd_evaluate
from src.domain.order_mock_approval import (
    OhioHospitalOrderApprovalRequest,
)

router = APIRouter(tags=["orders_mock"])


class MockOhioFacilityOrderApprovalRequest(BaseModel):
    facility_csf_decision: DecisionStatus
    ohio_tddd_decision: DecisionStatus


class MockOrderDecisionResponse(BaseModel):
    decision: DecisionOutcome
    csf_engine: Optional[str] = None
    license_engine: Optional[str] = None
    scenario_id: Optional[str] = None
    developer_trace: Optional[Dict[str, Any]] = None
    # Legacy fields maintained for backward compatibility with existing tests/UI.
    csf_status: Optional[str] = None
    csf_reason: Optional[str] = None
    csf_missing_fields: Optional[List[str]] = None
    tddd_status: Optional[str] = None
    tddd_reason: Optional[str] = None
    tddd_missing_fields: Optional[List[str]] = None
    final_decision: Optional[str] = None
    notes: Optional[List[str]] = None
    explanation: Optional[str] = None
    license_status: Optional[str] = None
    license_reason: Optional[str] = None
    license_missing_fields: Optional[List[str]] = None


@router.post(
    "/orders/mock/ohio-hospital-approval",
    response_model=MockOrderDecisionResponse,
)
async def ohio_hospital_mock_order_approval(
    request: OhioHospitalOrderApprovalRequest,
) -> MockOrderDecisionResponse:
    """
    Mock orchestration endpoint that shows how CSF + Ohio TDDD
    decisions combine into a final order decision for an Ohio
    hospital ordering controlled substances.
    """

    # --- Step 1: Hospital CSF evaluation ---
    csf_decision = await evaluate_hospital_csf_endpoint(request.hospital_csf)

    notes: list[str] = []
    csf_status = _normalize_status(csf_decision.status)

    notes.append(
        f"Hospital CSF decision: {csf_status.value} – {csf_decision.reason}"
    )

    tddd_decision = None

    # --- Step 2: Optional Ohio TDDD evaluation ---
    if request.ohio_tddd is not None:
        tddd_decision = await ohio_tddd_evaluate(request.ohio_tddd)
        tddd_status = _normalize_status(tddd_decision.status)
        notes.append(
            f"Ohio TDDD decision: {tddd_status.value} – {tddd_decision.reason}"
        )
    else:
        notes.append(
            "No Ohio TDDD payload provided – skipping license evaluation for this mock order."
        )

    # --- Step 3: Compute final decision ---
    tddd_status = _normalize_status(tddd_decision.status) if tddd_decision else None

    final_status = DecisionStatus.NEEDS_REVIEW

    if csf_status == DecisionStatus.BLOCKED or tddd_status == DecisionStatus.BLOCKED:
        final_status = DecisionStatus.BLOCKED
    elif csf_status == DecisionStatus.OK_TO_SHIP and (
        tddd_status in (None, DecisionStatus.OK_TO_SHIP)
    ):
        final_status = DecisionStatus.OK_TO_SHIP

    notes.append(f"Final mock order decision: {final_status.value}")

    regulatory_references: List[RegulatoryReference] = _normalize_references(
        getattr(csf_decision, "regulatory_references", [])
    )
    if tddd_decision is not None:
        regulatory_references.extend(
            _normalize_references(getattr(tddd_decision, "regulatory_references", []))
        )

    risk_level, risk_score = compute_risk_for_status(final_status.value)

    decision = DecisionOutcome(
        status=final_status,
        reason=_final_reason(
            final_status=final_status,
            csf_status=csf_status,
            tddd_status=tddd_status,
            default_reason="Hospital CSF evaluation requires review.",
        ),
        risk_level=risk_level,
        risk_score=risk_score,
        regulatory_references=regulatory_references,
        debug_info={"notes": notes} if notes else None,
    )

    return MockOrderDecisionResponse(
        decision=decision,
        csf_engine="hospital",
        license_engine="ohio-tddd" if request.ohio_tddd is not None else None,
        scenario_id="ohio-hospital-happy-path",
        developer_trace={"notes": notes},
        csf_status=csf_status.value,
        csf_reason=csf_decision.reason,
        csf_missing_fields=getattr(csf_decision, "missing_fields", None),
        tddd_status=tddd_status.value if tddd_status else None,
        tddd_reason=tddd_decision.reason if tddd_decision is not None else None,
        tddd_missing_fields=(
            getattr(tddd_decision, "missing_fields", None)
            if tddd_decision is not None
            else None
        ),
        final_decision=decision.status.value,
        notes=notes,
    )


@router.post(
    "/orders/mock/ohio-facility-approval",
    response_model=MockOrderDecisionResponse,
    summary="Mock order decision for an Ohio facility (CSF + TDDD)",
)
async def mock_ohio_facility_approval(
    payload: MockOhioFacilityOrderApprovalRequest,
) -> MockOrderDecisionResponse:
    """
    Combines Facility CSF decision + Ohio TDDD license decision into a single
    mock order approval outcome.
    """

    csf = payload.facility_csf_decision
    lic = payload.ohio_tddd_decision

    if DecisionStatus.BLOCKED in (csf, lic):
        final = DecisionStatus.BLOCKED
        explanation = (
            "Order blocked: at least one of Facility CSF or Ohio TDDD license "
            "is blocked."
        )
    elif DecisionStatus.NEEDS_REVIEW in (csf, lic):
        final = DecisionStatus.NEEDS_REVIEW
        explanation = (
            "Order needs manual review: Facility CSF and Ohio TDDD license "
            "are not both ok_to_ship."
        )
    else:
        final = DecisionStatus.OK_TO_SHIP
        explanation = (
            "Order approved: Facility CSF and Ohio TDDD license are both "
            "ok_to_ship for this Ohio facility."
        )

    risk_level, risk_score = compute_risk_for_status(final.value)

    decision = DecisionOutcome(
        status=final,
        reason=explanation,
        risk_level=risk_level,
        risk_score=risk_score,
        regulatory_references=[],
    )

    return MockOrderDecisionResponse(
        decision=decision,
        csf_engine="facility",
        license_engine="ohio-tddd",
        scenario_id="ohio-facility-happy-path",
        final_decision=decision.status.value,
        notes=[explanation],
        csf_status=csf.value,
        tddd_status=lic.value,
        explanation=explanation,
    )


def _normalize_status(status: DecisionStatus | str) -> DecisionStatus:
    if isinstance(status, DecisionStatus):
        return status
    return DecisionStatus(str(status))


def _final_reason(
    *,
    final_status: DecisionStatus,
    csf_status: DecisionStatus,
    tddd_status: DecisionStatus | None,
    default_reason: str,
) -> str:
    if final_status == DecisionStatus.BLOCKED:
        blocker = "Ohio TDDD license" if tddd_status == DecisionStatus.BLOCKED else "Hospital CSF"
        return f"Order blocked: {blocker} is blocked for this Ohio hospital order."

    if final_status == DecisionStatus.OK_TO_SHIP:
        return "Order approved: hospital CSF and Ohio TDDD license are both ok_to_ship."

    if tddd_status is None:
        return "Order needs manual review: TDDD license was not provided; hospital CSF alone is insufficient."

    return default_reason


def _normalize_references(
    references: List[RegulatoryReference | str | dict] | None,
) -> List[RegulatoryReference]:
    normalized: List[RegulatoryReference] = []
    if references is None:
        return normalized

    for ref in references:
        if isinstance(ref, RegulatoryReference):
            normalized.append(ref)
        elif isinstance(ref, dict):
            normalized.append(RegulatoryReference(**ref))
        else:
            normalized.append(RegulatoryReference(id=str(ref), label=str(ref)))

    return normalized
