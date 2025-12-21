from typing import List, Optional
from datetime import datetime
import uuid

from fastapi import APIRouter
from pydantic import BaseModel, Field

from src.api.models.decision import (
    DecisionOutcome,
    DecisionStatus,
    RegulatoryReference,
)
from src.autocomply.domain.csf_copilot import CsfCopilotResult, run_csf_copilot
from src.autocomply.domain.csf_facility import FacilityCsfForm, evaluate_facility_csf
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


def _facility_success_reason(reason: str) -> str:
    """Normalize success copy to be Facility-specific."""

    if not reason:
        return reason

    return reason.replace(
        "Hospital CSF is approved to proceed.",
        "Facility CSF is approved to proceed.",
    )


@router.post("/evaluate", response_model=FacilityCsfEvaluateResponse)
async def evaluate_facility_csf_endpoint(
    form: FacilityCsfForm,
) -> FacilityCsfEvaluateResponse:
    """Evaluate a Facility Controlled Substance Form and return a decision."""

    logger.info(
        "Facility CSF evaluation request received",
        extra={
            "engine_family": "csf",
            "decision_type": "csf_facility",
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
    )

    return FacilityCsfEvaluateResponse(
        decision=decision_outcome,
        status=decision_outcome.status,
        reason=decision_outcome.reason,
        missing_fields=decision.missing_fields,
        regulatory_references=[ref.id for ref in regulatory_references],
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


class SubmissionResponse(BaseModel):
    """Response for Facility CSF submission."""
    submission_id: str
    status: str
    created_at: str
    decision_status: Optional[DecisionStatus] = None
    reason: Optional[str] = None


@router.post("/submit", response_model=SubmissionResponse)
async def submit_facility_csf(
    form: FacilityCsfForm,
) -> SubmissionResponse:
    """
    Submit a Facility CSF for internal verification tracking.
    
    This endpoint:
    1. Evaluates the CSF using the decision engine
    2. Creates a submission record in the unified submissions store
    3. Generates trace_id for trace replay in Compliance Console
    4. Returns submission ID and status for user confirmation
    """
    # Run decision engine
    decision = evaluate_facility_csf(form)
    decision.reason = _facility_success_reason(decision.reason)
    
    # Generate trace ID for replay
    trace_id = generate_trace_id()
    
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
        subtitle = f"Submitted for verification"
    
    # Get store and create submission
    store = get_submission_store()
    submission = store.create_submission(
        csf_type="facility",
        tenant=getattr(form, 'tenant', 'facility-default'),
        title=title,
        subtitle=subtitle,
        trace_id=trace_id,
        payload={
            "form": form.model_dump(),
            "decision": decision.model_dump(),
        },
        decision_status=decision.status.value if hasattr(decision.status, 'value') else decision.status,
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
    
    status_map = {
        "ok_to_ship": DecisionStatus.OK_TO_SHIP,
        "blocked": DecisionStatus.BLOCKED,
        "manual_review": DecisionStatus.NEEDS_REVIEW,
    }
    normalized_status = status_map.get(decision.status.value if hasattr(decision.status, 'value') else decision.status if hasattr(decision.status, 'value') else decision.status, DecisionStatus.NEEDS_REVIEW)
    
    return SubmissionResponse(
        submission_id=submission.submission_id,
        status="submitted",
        created_at=submission.created_at,
        decision_status=normalized_status,
        reason=decision.reason,
    )


@router.get("/submissions/{submission_id}", response_model=dict)
async def get_facility_submission(submission_id: str) -> dict:
    """
    Retrieve a previously submitted Facility CSF by ID.
    
    Returns full submission details including form data, decision, and metadata.
    """
    submission = FACILITY_SUBMISSION_STORE.get(submission_id)
    
    if not submission:
        return {
            "error": "Submission not found",
            "submission_id": submission_id,
        }
    
    return submission


@compat_router.post("/evaluate", response_model=FacilityCsfEvaluateResponse)
async def evaluate_facility_csf_endpoint_v1(
    form: FacilityCsfForm,
) -> FacilityCsfEvaluateResponse:
    """Versioned compatibility endpoint for Facility CSF evaluation."""

    return await evaluate_facility_csf_endpoint(form)


@compat_router.post("/form-copilot", response_model=CsfCopilotResult)
async def facility_form_copilot_v1(
    form: FacilityCsfForm,
) -> CsfCopilotResult:
    """Versioned compatibility endpoint for Facility CSF Form Copilot."""

    return await facility_form_copilot(form)
