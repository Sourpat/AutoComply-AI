from fastapi import APIRouter
from pydantic import BaseModel

from src.autocomply.domain.csf_copilot import CsfCopilotResult, run_csf_copilot
from src.autocomply.domain.csf_researcher import (
    ResearcherCsfDecision,
    ResearcherCsfForm,
    evaluate_researcher_csf,
)
from src.autocomply.domain.submissions_store import (
    get_submission_store,
    SubmissionPriority,
)
from src.autocomply.domain.trace import generate_trace_id
from src.utils.logger import get_logger

router = APIRouter(prefix="/csf/researcher", tags=["csf_researcher"])

logger = get_logger(__name__)


@router.post("/evaluate", response_model=ResearcherCsfDecision)
async def evaluate_researcher_csf_endpoint(
    form: ResearcherCsfForm,
) -> ResearcherCsfDecision:
    """Evaluate a Researcher Controlled Substance Form and return a decision."""

    logger.info(
        "Researcher CSF evaluation request received",
        extra={"engine_family": "csf", "decision_type": "csf_researcher"},
    )

    return evaluate_researcher_csf(form)


@router.post("/form-copilot", response_model=CsfCopilotResult)
async def researcher_form_copilot(
    form: ResearcherCsfForm,
) -> CsfCopilotResult:
    """Run RAG-based explanation for a Researcher Controlled Substance Form."""

    copilot_request = {
        "csf_type": "researcher",
        "name": form.facility_name,
        "facility_type": getattr(form, "facility_type", "researcher"),
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
        "Researcher CSF copilot request received",
        extra={
            "engine_family": "csf",
            "decision_type": "csf_researcher",
            "decision_status": rag_result.status,
        },
    )

    return rag_result


class SubmissionResponse(BaseModel):
    """Response for Researcher CSF submission."""
    submission_id: str
    status: str
    created_at: str
    decision_status: str | None = None
    reason: str | None = None


@router.post("/submit", response_model=SubmissionResponse)
async def submit_researcher_csf(form: ResearcherCsfForm) -> SubmissionResponse:
    """
    Submit a Researcher CSF for internal verification tracking.
    
    Creates a submission record in the unified submissions store
    with trace_id for replay in Compliance Console.
    """
    # Run decision engine
    decision = evaluate_researcher_csf(form)
    
    # Generate trace ID for replay
    trace_id = generate_trace_id()
    
    # Determine priority
    priority = SubmissionPriority.HIGH if decision.status == "blocked" else SubmissionPriority.MEDIUM
    
    # Create title and subtitle
    facility_name = form.facility_name or form.account_number
    title = f"Researcher CSF – {facility_name}"
    
    if decision.status == "blocked":
        subtitle = f"Blocked: {decision.reason}"
    elif decision.status == "manual_review":
        subtitle = f"Review required: {decision.reason}"
    else:
        subtitle = "Submitted for verification"
    
    # Create submission
    store = get_submission_store()
    submission = store.create_submission(
        csf_type="researcher",
        tenant=getattr(form, 'tenant', 'researcher-default'),
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
        "Researcher CSF submitted for verification",
        extra={
            "submission_id": submission.submission_id,
            "trace_id": trace_id,
            "decision_status": decision.status,
        },
    )
    
    return SubmissionResponse(
        submission_id=submission.submission_id,
        status="submitted",
        created_at=submission.created_at,
        decision_status=decision.status,
        reason=decision.reason,
    )
