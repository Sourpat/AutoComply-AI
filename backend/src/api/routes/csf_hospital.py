from typing import List

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field

from src.api.models.decision import (
    DecisionOutcome,
    DecisionStatus,
    RegulatoryReference,
)
from src.autocomply.audit.decision_log import get_decision_log
from src.autocomply.domain.csf_copilot import CsfCopilotResult, run_csf_copilot
from src.autocomply.domain.csf_hospital import HospitalCsfForm, evaluate_hospital_csf
from src.autocomply.domain.decision_risk import compute_risk_for_status
from src.autocomply.domain.trace import TRACE_HEADER_NAME, ensure_trace_id, generate_trace_id
from src.autocomply.domain.submissions_store import (
    get_submission_store,
    SubmissionPriority,
)
from src.autocomply.tenancy.context import TenantContext, get_tenant_context
from src.utils.logger import get_logger

router = APIRouter(
    prefix="/csf/hospital",
    tags=["csf_hospital"],
)

logger = get_logger(__name__)


class HospitalCsfEvaluateResponse(BaseModel):
    """Response wrapper for Hospital CSF evaluations.

    Maintains legacy root-level fields for backward compatibility while also
    exposing the unified ``decision`` payload for new consumers.
    """

    decision: DecisionOutcome
    status: DecisionStatus
    reason: str
    trace_id: str | None = None
    missing_fields: List[str] = Field(default_factory=list)
    regulatory_references: List[str] = Field(default_factory=list)


@router.post("/evaluate", response_model=HospitalCsfEvaluateResponse)
async def evaluate_hospital_csf_endpoint(
    form: HospitalCsfForm,
    request: Request,
    tenant: TenantContext = Depends(get_tenant_context),
) -> HospitalCsfEvaluateResponse:
    """
    Evaluate a Hospital Pharmacy Controlled Substance Form and return a decision.
    """
    tenant_context = tenant if isinstance(tenant, TenantContext) else TenantContext(tenant_id="demo-tenant")
    incoming_trace_id = request.headers.get(TRACE_HEADER_NAME)
    trace_id = ensure_trace_id(incoming_trace_id)

    logger.info(
        "Hospital CSF evaluation request received",
        extra={
            "engine_family": "csf",
            "decision_type": "csf_hospital",
            "tenant_id": tenant_context.tenant_id,
        },
    )

    decision = evaluate_hospital_csf(form)

    status_map = {
        "ok_to_ship": DecisionStatus.OK_TO_SHIP,
        "blocked": DecisionStatus.BLOCKED,
        "manual_review": DecisionStatus.NEEDS_REVIEW,
    }
    normalized_status = status_map.get(decision.status.value, DecisionStatus.NEEDS_REVIEW)

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
        debug_info={"missing_fields": decision.missing_fields} if decision.missing_fields else None,
    )

    decision_log = get_decision_log()
    decision_log.record(
        trace_id=decision_outcome.trace_id or trace_id,
        engine_family="csf",
        decision_type="csf_hospital",
        decision=decision_outcome,
    )

    return HospitalCsfEvaluateResponse(
        decision=decision_outcome,
        status=decision_outcome.status,
        reason=decision_outcome.reason,
        trace_id=decision_outcome.trace_id,
        missing_fields=decision.missing_fields,
        regulatory_references=[ref.id for ref in regulatory_references],
    )


@router.post("/form-copilot", response_model=CsfCopilotResult)
async def hospital_form_copilot(form: HospitalCsfForm) -> CsfCopilotResult:
    """Hospital CSF Form Copilot backed by regulatory RAG."""

    copilot_request = {
        "csf_type": "hospital",
        "name": form.facility_name,
        "facility_type": form.facility_type,
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

    rag_result: CsfCopilotResult = await run_csf_copilot(copilot_request)

    logger.info(
        "Hospital CSF copilot request received",
        extra={
            "engine_family": "csf",
            "decision_type": "csf_hospital",
            "decision_status": rag_result.status,
        },
    )

    return rag_result


class SubmissionResponse(BaseModel):
    """Response for Hospital CSF submission."""
    submission_id: str
    status: str
    created_at: str
    decision_status: DecisionStatus | None = None
    reason: str | None = None


@router.post("/submit", response_model=SubmissionResponse)
async def submit_hospital_csf(form: HospitalCsfForm) -> SubmissionResponse:
    """
    Submit a Hospital CSF for internal verification tracking.
    
    Creates a submission record in the unified submissions store
    with trace_id for replay in Compliance Console.
    """
    # Run decision engine
    decision = evaluate_hospital_csf(form)
    
    # Generate trace ID for replay
    trace_id = generate_trace_id()
    
    # Map status
    status_map = {
        "ok_to_ship": DecisionStatus.OK_TO_SHIP,
        "blocked": DecisionStatus.BLOCKED,
        "manual_review": DecisionStatus.NEEDS_REVIEW,
    }
    normalized_status = status_map.get(decision.status.value, DecisionStatus.NEEDS_REVIEW)
    
    # Determine priority
    priority = SubmissionPriority.HIGH if normalized_status == DecisionStatus.BLOCKED else SubmissionPriority.MEDIUM
    
    # Create title and subtitle
    facility_name = form.facility_name or form.account_number
    title = f"Hospital CSF \u2013 {facility_name}"
    
    if normalized_status == DecisionStatus.BLOCKED:
        subtitle = f"Blocked: {decision.reason}"
    elif normalized_status == DecisionStatus.NEEDS_REVIEW:
        subtitle = f"Review required: {decision.reason}"
    else:
        subtitle = "Submitted for verification"
    
    # Create submission
    store = get_submission_store()
    submission = store.create_submission(
        csf_type="hospital",
        tenant=getattr(form, 'tenant', 'hospital-default'),
        title=title,
        subtitle=subtitle,
        trace_id=trace_id,
        payload={
            "form": form.model_dump(),
            "decision": decision.model_dump(),
        },
        decision_status=normalized_status.value,
        risk_level="High" if normalized_status == DecisionStatus.BLOCKED else "Medium",
        priority=priority,
    )
    
    logger.info(
        "Hospital CSF submitted for verification",
        extra={
            "submission_id": submission.submission_id,
            "trace_id": trace_id,
            "decision_status": normalized_status.value,
        },
    )
    
    return SubmissionResponse(
        submission_id=submission.submission_id,
        status="submitted",
        created_at=submission.created_at,
        decision_status=normalized_status,
        reason=decision.reason,
    )
