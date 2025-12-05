from typing import Optional

from fastapi import APIRouter, Request

from src.api.models.decision import (
    DecisionOutcome,
    DecisionStatus,
    RegulatoryReference,
)
from src.api.routes.order_mock_approval import MockOrderDecisionResponse
from src.autocomply.audit.decision_log import get_decision_log
from src.autocomply.domain.decision_risk import compute_risk_for_status
from src.autocomply.domain.trace import TRACE_HEADER_NAME, generate_trace_id
from src.domain.order_mock_ny_pharmacy import NyPharmacyOrderApprovalRequest

router = APIRouter(tags=["orders_mock"])


def _build_mock_decision(
    *,
    status: DecisionStatus,
    reason: str,
    trace_id: str,
    reference_label: str,
) -> DecisionOutcome:
    risk_level, risk_score = compute_risk_for_status(status.value)

    return DecisionOutcome(
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
                label=reference_label,
            )
        ],
        trace_id=trace_id,
        debug_info=None,
    )


def _record_mock_decision(decision: DecisionOutcome) -> None:
    decision_log = get_decision_log()
    decision_log.record(
        trace_id=decision.trace_id,
        engine_family="order",
        decision_type="order_ny_pharmacy_mock",
        decision=decision,
    )


def _build_mock_response(
    *, decision: DecisionOutcome, scenario_id: str, notes: list[str]
) -> MockOrderDecisionResponse:
    return MockOrderDecisionResponse(
        decision=decision,
        license_engine="ny-pharmacy",
        scenario_id=scenario_id,
        developer_trace={"notes": notes} if notes else None,
        final_decision=decision.status.value,
        notes=notes,
        license_status=decision.status.value,
        license_reason=decision.reason,
        license_missing_fields=None,
    )


@router.api_route(
    "/orders/mock/ny-pharmacy-approval",
    methods=["GET", "POST"],
    response_model=MockOrderDecisionResponse,
)
async def ny_pharmacy_mock_order_approval(
    http_request: Request,
    order_request: Optional[NyPharmacyOrderApprovalRequest] = None,
) -> MockOrderDecisionResponse:
    """Happy-path NY pharmacy order mock: license active + NY ship-to."""

    incoming_trace_id = http_request.headers.get(TRACE_HEADER_NAME)
    trace_id = incoming_trace_id or generate_trace_id()

    decision = _build_mock_decision(
        status=DecisionStatus.OK_TO_SHIP,
        reason="NY pharmacy order approved: license appears active for NY ship-to.",
        reference_label="NY pharmacy license appears active for New York ship-to.",
        trace_id=trace_id,
    )
    notes = ["NY pharmacy mock order scenario: approval / happy path."]

    _record_mock_decision(decision)

    return _build_mock_response(
        decision=decision,
        scenario_id="ny-pharmacy-approval",
        notes=notes,
    )


@router.get(
    "/orders/mock/ny-pharmacy-expired-license",
    response_model=MockOrderDecisionResponse,
)
async def ny_pharmacy_expired_license_mock(
    http_request: Request,
) -> MockOrderDecisionResponse:
    """Mock order: NY pharmacy where the license is expired."""

    incoming_trace_id = http_request.headers.get(TRACE_HEADER_NAME)
    trace_id = incoming_trace_id or generate_trace_id()

    decision = _build_mock_decision(
        status=DecisionStatus.BLOCKED,
        reason="NY pharmacy order blocked: license appears expired for NY ship-to.",
        reference_label="NY pharmacy license required and must be active",
        trace_id=trace_id,
    )
    notes = ["NY pharmacy mock order scenario: expired license."]

    _record_mock_decision(decision)

    return _build_mock_response(
        decision=decision,
        scenario_id="ny-pharmacy-expired-license",
        notes=notes,
    )


@router.get(
    "/orders/mock/ny-pharmacy-wrong-state",
    response_model=MockOrderDecisionResponse,
)
async def ny_pharmacy_wrong_state_mock(
    http_request: Request,
) -> MockOrderDecisionResponse:
    """Mock order: NY pharmacy license but ship-to state is NOT NY."""

    incoming_trace_id = http_request.headers.get(TRACE_HEADER_NAME)
    trace_id = incoming_trace_id or generate_trace_id()

    decision = _build_mock_decision(
        status=DecisionStatus.NEEDS_REVIEW,
        reason="NY pharmacy order requires review: ship-to state is outside New York.",
        reference_label="NY pharmacy license scope may be limited to New York",
        trace_id=trace_id,
    )
    notes = ["NY pharmacy mock order scenario: wrong ship-to state."]

    _record_mock_decision(decision)

    return _build_mock_response(
        decision=decision,
        scenario_id="ny-pharmacy-wrong-state",
        notes=notes,
    )
