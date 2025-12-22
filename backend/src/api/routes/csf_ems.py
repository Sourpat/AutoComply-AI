from typing import Optional
from fastapi import APIRouter, Request
from pydantic import BaseModel

from src.api.models.decision import DecisionOutcome, DecisionStatus, RegulatoryReference
from src.autocomply.domain.trace import ensure_trace_id, TRACE_HEADER_NAME
from src.autocomply.audit.decision_log import get_decision_log
from src.autocomply.domain.decision_risk import compute_risk_for_status
from src.autocomply.domain.csf_copilot import CsfCopilotResult, run_csf_copilot
from src.autocomply.domain.csf_ems import (
    CsDecisionStatus,
    EmsCsfDecision,
    EmsCsfForm,
    evaluate_ems_csf,
)
from src.autocomply.domain.submissions_store import (
    get_submission_store,
    SubmissionPriority,
)
from src.autocomply.domain.trace import generate_trace_id
from src.utils.logger import get_logger

router = APIRouter(prefix="/csf/ems", tags=["csf_ems"])

logger = get_logger(__name__)


@router.post("/evaluate", response_model=EmsCsfDecision)
async def evaluate_ems_csf_endpoint(request: Request, form: EmsCsfForm) -> EmsCsfDecision:
    """Evaluate an EMS Controlled Substance Form and return a decision."""

    # Generate trace ID for decision logging
    incoming_trace_id = request.headers.get(TRACE_HEADER_NAME)
    trace_id = ensure_trace_id(incoming_trace_id)

    logger.info(
        "EMS CSF evaluation request received",
        extra={"engine_family": "csf", "decision_type": "csf_ems", "trace_id": trace_id},
    )

    decision = evaluate_ems_csf(form)

    # Log to decision log for trace replay
    status_map = {
        CsDecisionStatus.OK_TO_SHIP: DecisionStatus.OK_TO_SHIP,
        CsDecisionStatus.BLOCKED: DecisionStatus.BLOCKED,
        CsDecisionStatus.NEEDS_REVIEW: DecisionStatus.NEEDS_REVIEW,
    }
    normalized_status = status_map.get(decision.status, DecisionStatus.NEEDS_REVIEW)

    regulatory_references = [
        RegulatoryReference(id=ref, label=ref) for ref in decision.regulatory_references or []
    ]

    risk_level, risk_score = compute_risk_for_status(normalized_status.value)

    decision_outcome = DecisionOutcome(
        status=normalized_status,
        reason=decision.reason,
        risk_level=risk_level,
        risk_score=risk_score,
        regulatory_references=regulatory_references,
        trace_id=trace_id,
    )

    decision_log = get_decision_log()
    decision_log.record(
        trace_id=trace_id,
        engine_family="csf",
        decision_type="csf_ems",
        decision=decision_outcome,
    )

    logger.info(
        "EMS CSF decision recorded",
        extra={
            "trace_id": trace_id,
            "decision_status": decision.status,
            "controlled_substances_count": len(form.controlled_substances) if form.controlled_substances else 0,
        },
    )

    return decision


@router.post("/form-copilot", response_model=CsfCopilotResult)
async def ems_form_copilot(form: EmsCsfForm) -> CsfCopilotResult:
    """EMS CSF Form Copilot backed by regulatory RAG."""

    copilot_request = {
        "csf_type": "ems",
        "name": form.facility_name,
        "facility_type": getattr(form, "facility_type", "ems"),
        "account_number": form.account_number,
        "pharmacy_license_number": form.pharmacy_license_number,
        "dea_number": form.dea_number,
        "pharmacist_in_charge_name": form.pharmacist_in_charge_name,
        "pharmacist_contact_phone": form.pharmacist_contact_phone,
        "ship_to_state": form.ship_to_state,
        "attestation_accepted": form.attestation_accepted,
        "internal_notes": form.internal_notes,
        "controlled_substances": form.controlled_substances,
    }

    rag_result = await run_csf_copilot(copilot_request)

    logger.info(
        "EMS CSF copilot request received",
        extra={
            "engine_family": "csf",
            "decision_type": "csf_ems",
            "decision_status": rag_result.status,
        },
    )

    return rag_result


class EmsCsfSubmitRequest(BaseModel):
    """Request model for EMS CSF submission with optional trace_id."""
    form: EmsCsfForm
    trace_id: Optional[str] = None


class SubmissionResponse(BaseModel):
    """Response for EMS CSF submission."""
    submission_id: str
    status: str
    created_at: str
    trace_id: str
    decision_status: str | None = None
    reason: str | None = None


@router.post("/submit", response_model=SubmissionResponse)
async def submit_ems_csf(request: EmsCsfSubmitRequest) -> SubmissionResponse:
    """
    Submit an EMS CSF for internal verification tracking.
    
    Uses provided trace_id from evaluate (or generates new one).
    """
    form = request.form
    
    # Use trace_id from evaluate or generate new
    trace_id = request.trace_id or generate_trace_id()
    
    logger.info(
        "EMS CSF submit request received",
        extra={
            "trace_id": trace_id,
            "trace_id_from_evaluate": request.trace_id is not None,
        },
    )
    
    # Run decision engine
    decision = evaluate_ems_csf(form)
    
    # Determine priority
    priority = SubmissionPriority.HIGH if decision.status == "blocked" else SubmissionPriority.MEDIUM
    
    # Create title and subtitle
    facility_name = form.facility_name or form.account_number
    title = f"EMS CSF – {facility_name}"
    
    if decision.status == "blocked":
        subtitle = f"Blocked: {decision.reason}"
    elif decision.status == "manual_review":
        subtitle = f"Review required: {decision.reason}"
    else:
        subtitle = "Submitted for verification"
    
    # Create submission
    store = get_submission_store()
    submission = store.create_submission(
        csf_type="ems",
        tenant=getattr(form, 'tenant', 'ems-default'),
        title=title,
        subtitle=subtitle,
        trace_id=trace_id,
        payload={
            "form": form.model_dump(),
            "decision": decision.model_dump(),
        },
        decision_status=decision.status,
        risk_level="High" if decision.status == "blocked" else "Medium",
        priority=priority,
    )
    
    logger.info(
        "EMS CSF submitted for verification",
        extra={
            "submission_id": submission.submission_id,
            "trace_id": trace_id,
            "decision_status": decision.status,
        },
    )
    
    # Map status for trace recording
    status_map = {
        "ok_to_ship": DecisionStatus.OK_TO_SHIP,
        "blocked": DecisionStatus.BLOCKED,
        "manual_review": DecisionStatus.NEEDS_REVIEW,
    }
    normalized_status = status_map.get(decision.status, DecisionStatus.NEEDS_REVIEW)
    
    # Compute risk for trace recording
    risk_level, risk_score = compute_risk_for_status(normalized_status.value)
    
    # Record submission step to trace log
    decision_outcome = DecisionOutcome(
        status=normalized_status,
        reason=decision.reason,
        risk_level=risk_level,
        risk_score=risk_score,
        regulatory_references=[],
        trace_id=trace_id,
    )
    
    decision_log = get_decision_log()
    decision_log.record(
        trace_id=trace_id,
        engine_family="csf",
        decision_type="csf_ems_submit",
        decision=decision_outcome,
    )
    
    return SubmissionResponse(
        submission_id=submission.submission_id,
        status="submitted",
        created_at=submission.created_at,
        trace_id=trace_id,
        decision_status=decision.status,
        reason=decision.reason,
    )
