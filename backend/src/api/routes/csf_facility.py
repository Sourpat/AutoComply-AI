from typing import List, Optional
from datetime import datetime
import uuid

from fastapi import APIRouter, Request
from pydantic import BaseModel, Field

from src.api.models.decision import (
    DecisionOutcome,
    DecisionStatus,
    RegulatoryReference,
)
from src.autocomply.domain.trace import ensure_trace_id, TRACE_HEADER_NAME
from src.autocomply.audit.decision_log import get_decision_log
from src.autocomply.domain.decision_risk import compute_risk_for_status
from src.autocomply.domain.csf_copilot import CsfCopilotResult, run_csf_copilot
from app.workflow.trace_repo import get_trace_repo
from src.autocomply.domain.csf_facility import (
    FacilityControlledSubstance,
    FacilityCsfForm,
    FacilityFacilityType,
    evaluate_facility_csf,
)
from src.autocomply.domain.submissions_store import (
    get_submission_store,
    SubmissionPriority,
)
from src.autocomply.domain.trace import generate_trace_id
from src.utils.logger import get_logger

# NOTE: All CSF evaluate endpoints now return a shared DecisionOutcome schema
# (see src/api/models/decision.py).
router = APIRouter(
    prefix="/csf/facility",
    tags=["csf_facility"],
)

# Compatibility router so callers that expect versioned API prefixes don't hit 404s.
# The handlers delegate to the same logic as the primary router to keep behavior
# identical.
compat_router = APIRouter(
    prefix="/api/v1/csf/facility",
    tags=["csf_facility"],
)

logger = get_logger(__name__)

# In-memory submission store (replace with database in production)
# TODO: Replace with proper database persistence
FACILITY_SUBMISSION_STORE: dict = {}

DEFAULT_FACILITY_COPILOT_QUESTION = (
    "Explain to a verification specialist what this Facility CSF decision "
    "means, what is missing, and what is required next."
)


class FacilityCsfEvaluateResponse(BaseModel):
    """Response wrapper for Facility CSF evaluations."""

    decision: DecisionOutcome
    status: DecisionStatus
    reason: str
    missing_fields: List[str] = Field(default_factory=list)
    regulatory_references: List[str] = Field(default_factory=list)
    trace_id: Optional[str] = None


def _facility_success_reason(reason: str) -> str:
    """Normalize all Hospital CSF references to Facility CSF in decision reasons."""

    if not reason:
        return reason

    # Replace all variations of Hospital CSF with Facility CSF
    return (
        reason.replace("Hospital CSF", "Facility CSF")
        .replace("Hospital has", "Facility has")
        .replace("This Hospital", "This Facility")
    )


@router.post("/evaluate", response_model=FacilityCsfEvaluateResponse)
async def evaluate_facility_csf_endpoint(
    request: Request,
    form: FacilityCsfForm,
) -> FacilityCsfEvaluateResponse:
    """Evaluate a Facility Controlled Substance Form and return a decision."""

    # Generate trace ID for decision logging and trace replay
    incoming_trace_id = request.headers.get(TRACE_HEADER_NAME)
    trace_id = ensure_trace_id(incoming_trace_id)

    logger.info(
        "Facility CSF evaluation request received",
        extra={
            "engine_family": "csf",
            "decision_type": "csf_facility",
            "trace_id": trace_id,
        },
    )

    decision = evaluate_facility_csf(form)
    decision.reason = _facility_success_reason(decision.reason)

    status_map = {
        "ok_to_ship": DecisionStatus.OK_TO_SHIP,
        "blocked": DecisionStatus.BLOCKED,
        "manual_review": DecisionStatus.NEEDS_REVIEW,
    }
    normalized_status = status_map.get(decision.status.value, DecisionStatus.NEEDS_REVIEW)

    regulatory_references = [
        RegulatoryReference(id=ref, label=ref) for ref in decision.regulatory_references or []
    ]

    decision_outcome = DecisionOutcome(
        status=normalized_status,
        reason=decision.reason,
        regulatory_references=regulatory_references,
        debug_info={"missing_fields": decision.missing_fields} if decision.missing_fields else None,
        trace_id=trace_id,
    )

    # Log decision to audit trail for trace replay
    decision_log = get_decision_log()
    decision_log.record(
        trace_id=trace_id,
        engine_family="csf",
        decision_type="csf_facility",
        decision=decision_outcome,
    )

    # Store complete trace for retrieval
    trace_repo = get_trace_repo()
    trace_payload = {
        "trace_id": trace_id,
        "engine_family": "csf",
        "decision_type": "csf_facility",
        "form": form.model_dump(),
        "decision": decision_outcome.model_dump(),
        "created_at": decision_outcome.created_at if hasattr(decision_outcome, "created_at") else None,
    }
    trace_repo.store_trace(
        trace_id=trace_id,
        trace_data=trace_payload,
        engine_family="csf",
        decision_type="csf_facility",
        status=normalized_status.value,
    )

    logger.info(
        "Facility CSF decision recorded",
        extra={
            "trace_id": trace_id,
            "decision_status": normalized_status.value,
            "controlled_substances_count": len(form.controlled_substances) if form.controlled_substances else 0,
        },
    )

    return FacilityCsfEvaluateResponse(
        decision=decision_outcome,
        status=decision_outcome.status,
        reason=decision_outcome.reason,
        missing_fields=decision.missing_fields,
        regulatory_references=[ref.id for ref in regulatory_references],
        trace_id=trace_id,
    )


@router.post("/form-copilot", response_model=CsfCopilotResult)
async def facility_form_copilot(form: FacilityCsfForm) -> CsfCopilotResult:
    """Facility CSF Form Copilot backed by regulatory RAG."""

    copilot_request = {
        "csf_type": "facility",
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
        "Facility CSF copilot request received",
        extra={
            "engine_family": "csf",
            "decision_type": "csf_facility",
            "decision_status": rag_result.status,
        },
    )

    return rag_result


class FacilityCsfSubmitRequest(BaseModel):
    """Request model for Facility CSF submission - accepts flat form fields with optional trace_id."""
    facility_name: Optional[str] = ""
    facility_type: Optional[FacilityFacilityType] = FacilityFacilityType.FACILITY
    account_number: Optional[str] = None
    pharmacy_license_number: Optional[str] = ""
    dea_number: Optional[str] = ""
    pharmacist_in_charge_name: Optional[str] = ""
    pharmacist_contact_phone: Optional[str] = None
    ship_to_state: Optional[str] = ""
    attestation_accepted: bool = False
    controlled_substances: List[FacilityControlledSubstance] = Field(default_factory=list)
    internal_notes: Optional[str] = None
    trace_id: Optional[str] = None


class SubmissionResponse(BaseModel):
    """Response for Facility CSF submission."""
    submission_id: str
    status: str
    created_at: str
    submitted_at: str  # Backward compatibility alias for created_at
    trace_id: str
    decision_status: Optional[DecisionStatus] = None
    reason: Optional[str] = None


@router.post("/submit", response_model=SubmissionResponse)
async def submit_facility_csf(
    request: FacilityCsfSubmitRequest,
) -> SubmissionResponse:
    """
    Submit a Facility CSF for internal verification tracking.
    
    This endpoint:
    1. Evaluates the CSF using the decision engine
    2. Creates a submission record in the unified submissions store
    3. Uses provided trace_id from evaluate (or generates new one)
    4. Returns submission ID and status for user confirmation
    """
    # Convert request to form (exclude trace_id)
    form = FacilityCsfForm(**request.model_dump(exclude={'trace_id'}))
    
    # Use trace_id from evaluate or generate new
    trace_id = request.trace_id or generate_trace_id()
    
    logger.info(
        "Facility CSF submit request received",
        extra={
            "trace_id": trace_id,
            "trace_id_from_evaluate": request.trace_id is not None,
        },
    )
    
    # Run decision engine
    decision = evaluate_facility_csf(form)
    decision.reason = _facility_success_reason(decision.reason)
    
    # Set trace_id on decision for payload storage
    decision.trace_id = trace_id
    
    # Determine priority based on decision status
    priority = SubmissionPriority.HIGH if decision.status == "blocked" else SubmissionPriority.MEDIUM
    
    # Create human-readable title and subtitle
    facility_name = getattr(form, 'facility_name', None) or form.account_number
    title = f"Facility CSF – {facility_name}"
    
    if decision.status == "blocked":
        subtitle = f"Blocked: {decision.reason}"
    elif decision.status == "manual_review":
        subtitle = f"Review required: {decision.reason}"
    else:
        subtitle = "Submitted for verification"
    
    # Create submission
    store = get_submission_store()
    submission = store.create_submission(
        csf_type="facility",
        tenant="facility-default",
        title=title,
        subtitle=subtitle,
        trace_id=trace_id,
        payload={"form": form.model_dump(), "decision": decision.model_dump()},
        decision_status=decision.status.value if hasattr(decision.status, "value") else decision.status,
        risk_level="High" if decision.status == "blocked" else "Medium",
        priority=priority,
    )

    logger.info(
        "Facility CSF submitted for verification",
        extra={
            "submission_id": submission.submission_id,
            "trace_id": trace_id,
            "decision_status": decision.status,
            "account_number": form.account_number,
        },
    )
    
    # Map status for trace recording and response
    status_map = {
        "ok_to_ship": DecisionStatus.OK_TO_SHIP,
        "blocked": DecisionStatus.BLOCKED,
        "manual_review": DecisionStatus.NEEDS_REVIEW,
        "needs_review": DecisionStatus.NEEDS_REVIEW,
    }
    normalized_status = status_map.get(decision.status.value if hasattr(decision.status, 'value') else decision.status, DecisionStatus.NEEDS_REVIEW)
    
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
        decision_type="csf_facility_submit",
        decision=decision_outcome,
    )
    
    return SubmissionResponse(
        submission_id=submission.submission_id,
        status="submitted",
        created_at=submission.created_at,
        submitted_at=submission.created_at,  # Backward compatibility alias
        trace_id=trace_id,
        decision_status=normalized_status,
        reason=decision.reason,
    )


@router.get("/submissions/{submission_id}", response_model=dict)
async def get_facility_submission(submission_id: str) -> dict:
    """
    Retrieve a previously submitted Facility CSF by ID.
    
    Returns full submission details including form data, decision, and metadata.
    """
    store = get_submission_store()
    submission = store.get_submission(submission_id)

    if not submission:
        return {
            "error": "Submission not found",
            "submission_id": submission_id,
        }

    payload = submission.payload or {}
    form_data = payload.get("form", {})

    return {
        "submission_id": submission.submission_id,
        "facility_name": form_data.get("facility_name"),
        "account_number": form_data.get("account_number"),
        "status": submission.decision_status or submission.status,
        "submitted_at": submission.created_at,
        "trace_id": submission.trace_id,
        "payload": payload,
    }


@compat_router.post("/evaluate", response_model=FacilityCsfEvaluateResponse)
async def evaluate_facility_csf_endpoint_v1(
    request: Request,
    form: FacilityCsfForm,
) -> FacilityCsfEvaluateResponse:
    """Versioned compatibility endpoint for Facility CSF evaluation."""

    return await evaluate_facility_csf_endpoint(request, form)


@compat_router.post("/form-copilot", response_model=CsfCopilotResult)
async def facility_form_copilot_v1(
    form: FacilityCsfForm,
) -> CsfCopilotResult:
    """Versioned compatibility endpoint for Facility CSF Form Copilot."""

    return await facility_form_copilot(form)
