from typing import List, Optional
from datetime import datetime
import uuid

from fastapi import APIRouter, Request
from pydantic import BaseModel, Field

from src.api.models.compliance_models import RegulatorySource
from src.api.models.decision import DecisionOutcome, DecisionStatus, RegulatoryReference
import src.autocomply.domain.csf_copilot as csf_copilot
from src.autocomply.domain.controlled_substances import ControlledSubstanceItem
from src.autocomply.domain.csf_practitioner import (
    CsDecisionStatus,
    PractitionerCsfDecision,
    PractitionerCsfForm,
    PractitionerFacilityType,
    describe_practitioner_csf_decision,
    evaluate_practitioner_csf,
)
from src.autocomply.domain.decision_risk import compute_risk_for_status
from src.autocomply.domain.rag_regulatory_explain import RegulatoryRagAnswer
from src.autocomply.domain.submissions_store import (
    get_submission_store,
    SubmissionPriority,
)
from src.autocomply.domain.trace import TRACE_HEADER_NAME, ensure_trace_id, generate_trace_id
from src.autocomply.audit.decision_log import get_decision_log
from src.utils.logger import get_logger


router = APIRouter(
    prefix="/csf/practitioner",
    tags=["csf_practitioner"],
)

logger = get_logger(__name__)

# In-memory submission store (replace with database in production)
# TODO: Replace with proper database persistence
SUBMISSION_STORE: dict = {}


default_copilot_question = (
    "Explain to a verification specialist what this Practitioner CSF decision "
    "means, what is missing, and what is required next."
)


DEFAULT_COPILOT_QUESTION = default_copilot_question


class PractitionerCopilotRequest(PractitionerCsfForm):
    question: Optional[str] = Field(
        default=None,
        description="Optional custom question for the copilot explanation.",
    )


class PractitionerCopilotResponse(BaseModel):
    """
    API response model for the Practitioner CSF form copilot.

    Tests expect the following top-level keys to be present:
    - status
    - reason
    - missing_fields
    - regulatory_references
    - rag_explanation
    - artifacts_used
    - rag_sources
    """

    status: CsDecisionStatus
    reason: str
    missing_fields: List[str] = Field(default_factory=list)
    regulatory_references: List[RegulatoryReference] = Field(default_factory=list)
    rag_explanation: str
    artifacts_used: List[str] = Field(default_factory=list)
    rag_sources: List[RegulatorySource] = Field(default_factory=list)


@router.post("/evaluate", response_model=PractitionerCsfDecision)
async def evaluate_practitioner_csf_endpoint(
    form: PractitionerCsfForm,
    request: Request,
) -> PractitionerCsfDecision:
    """
    Evaluate a Practitioner Controlled Substance Form and return a decision.
    """
    # Generate or extract trace ID
    incoming_trace_id = request.headers.get(TRACE_HEADER_NAME)
    trace_id = ensure_trace_id(incoming_trace_id)
    
    decision = evaluate_practitioner_csf(form)

    # Log to decision audit
    status_map = {
        CsDecisionStatus.OK_TO_SHIP: DecisionStatus.OK_TO_SHIP,
        CsDecisionStatus.BLOCKED: DecisionStatus.BLOCKED,
        CsDecisionStatus.NEEDS_REVIEW: DecisionStatus.NEEDS_REVIEW,
    }
    normalized_status = status_map.get(decision.status, DecisionStatus.NEEDS_REVIEW)
    
    regulatory_references = [
        RegulatoryReference(id=ref, label=ref) for ref in decision.regulatory_references or []
    ]
    
    # Compute risk level and score based on decision status
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
        trace_id=trace_id,
        engine_family="csf",
        decision_type="csf_practitioner",
        decision=decision_outcome,
    )

    logger.info(
        "Practitioner CSF decision evaluated",
        extra={
            "decision_status": decision.status,
            "missing_fields": decision.missing_fields,
            "trace_id": trace_id,
        },
    )

    # Add trace_id to response
    decision.trace_id = trace_id
    return decision


@router.post("/form-copilot", response_model=PractitionerCopilotResponse)
async def practitioner_form_copilot(
    form: PractitionerCopilotRequest,
) -> PractitionerCopilotResponse:
    """
    Practitioner Form Copilot endpoint backed by regulatory RAG.
    """

    # Always run the core decision engine first
    decision = evaluate_practitioner_csf(form)

    # Default reason if RAG is not used
    base_reason = (
        "Based on the information provided and the modeled rules for the "
        "Practitioner CSF vertical, AutoComply AI considers this request "
        "approved to proceed with shipment."
    )
    reason = base_reason

    # Default RAG stub text (matches tests' expected fallback phrase)
    rag_explanation = (
        "Regulatory RAG explanation is currently unavailable. In a full environment, "
        "this endpoint would pull in Practitioner CSF guidance and provide a "
        "specialist-friendly summary for the question: "
        f"{form.question or DEFAULT_COPILOT_QUESTION}"
    )

    stub_source = RegulatorySource(
        id="csf_practitioner_form",
        title="Practitioner CSF form",
        snippet=describe_practitioner_csf_decision(form, decision),
    )
    rag_sources: List[RegulatorySource] = [stub_source]
    artifacts_used: List[str] = ["csf_practitioner_form"]
    regulatory_references: List[RegulatoryReference] = [
        RegulatoryReference(id="csf_practitioner_form", label="Practitioner CSF form")
    ]

    try:
        rag_answer: RegulatoryRagAnswer = csf_copilot.explain_csf_practitioner_decision(
            decision={**decision.model_dump(), "form": form.model_dump()},
            question=form.question or DEFAULT_COPILOT_QUESTION,
            regulatory_references=decision.regulatory_references,
        )

        if rag_answer.answer:
            # Keep `reason` as the stable summary; put RAG text into rag_explanation
            rag_explanation = rag_answer.answer

        if rag_answer.regulatory_references:
            regulatory_references = [
                RegulatoryReference(
                    id=getattr(ref, "id", ref),
                    label=getattr(ref, "label", getattr(ref, "id", str(ref))),
                )
                for ref in rag_answer.regulatory_references
            ]

        if rag_answer.artifacts_used:
            artifacts_used = rag_answer.artifacts_used

        if rag_answer.sources:
            rag_sources = [
                RegulatorySource.model_validate(
                    src.model_dump() if hasattr(src, "model_dump") else src
                )
                for src in rag_answer.sources
            ]
    except Exception:
        logger.exception(
            "Failed to generate practitioner CSF copilot explanation",
            extra={
                "engine_family": "csf",
                "decision_type": "csf_practitioner",
                "account_number": getattr(form, "account_number", None),
            },
        )
        # Failure path: leave `reason` as the stable narrative and keep the
        # fallback `rag_explanation` defined above so tests can assert on it.

    return PractitionerCopilotResponse(
        status=decision.status,
        reason=reason,
        missing_fields=list(decision.missing_fields or []),
        regulatory_references=regulatory_references,
        rag_explanation=rag_explanation,
        artifacts_used=artifacts_used,
        rag_sources=rag_sources,
    )


class SubmissionResponse(BaseModel):
    """Response for CSF submission."""
    submission_id: str
    status: str
    created_at: str
    trace_id: str
    decision_status: Optional[CsDecisionStatus] = None
    reason: Optional[str] = None


class PractitionerCsfSubmitRequest(BaseModel):
    """Request model for Practitioner CSF submit with optional trace_id."""
    form: PractitionerCsfForm
    trace_id: Optional[str] = None


@router.post("/submit", response_model=SubmissionResponse)
async def submit_practitioner_csf(
    request: PractitionerCsfSubmitRequest,
) -> SubmissionResponse:
    """
    Submit a Practitioner CSF for internal verification tracking.
    
    This endpoint:
    1. Evaluates the CSF using the decision engine
    2. Creates a submission record in the unified submissions store
    3. Uses provided trace_id from evaluate (or generates new one)
    4. Returns submission ID and status for user confirmation
    """
    form = request.form
    
    # Run decision engine
    decision = evaluate_practitioner_csf(form)
    
    # Use provided trace_id from evaluate, or generate new one
    trace_id = request.trace_id or generate_trace_id()
    
    # Map status for trace recording
    status_map = {
        CsDecisionStatus.OK_TO_SHIP: DecisionStatus.OK_TO_SHIP,
        CsDecisionStatus.BLOCKED: DecisionStatus.BLOCKED,
        CsDecisionStatus.NEEDS_REVIEW: DecisionStatus.NEEDS_REVIEW,
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
        decision_type="csf_practitioner_submit",
        decision=decision_outcome,
    )
    
    # Determine priority based on decision status
    priority = SubmissionPriority.HIGH if decision.status == CsDecisionStatus.BLOCKED else SubmissionPriority.MEDIUM
    
    # Create human-readable title and subtitle
    practitioner_name = getattr(form, 'prescriber_name', None) or form.account_number
    title = f"Practitioner CSF – {practitioner_name}"
    
    if decision.status == CsDecisionStatus.BLOCKED:
        subtitle = f"Blocked: {decision.reason}"
    elif decision.status == CsDecisionStatus.NEEDS_REVIEW:
        subtitle = f"Review required: {decision.reason}"
    else:
        subtitle = "Submitted for verification"
    
    # Get store and create submission
    store = get_submission_store()
    submission = store.create_submission(
        csf_type="practitioner",
        tenant="practitioner-default",
        title=title,
        subtitle=subtitle,
        trace_id=trace_id,
        payload={
            "form": form.model_dump(),
            "decision": decision.model_dump(),
        },
        decision_status=decision.status.value if hasattr(decision.status, 'value') else str(decision.status),
        risk_level=risk_level,
        priority=priority,
    )
    
    logger.info(
        "Practitioner CSF submitted for verification",
        extra={
            "submission_id": submission.submission_id,
            "trace_id": trace_id,
            "decision_status": decision.status,
            "account_number": form.account_number,
        },
    )
    
    return SubmissionResponse(
        submission_id=submission.submission_id,
        status="submitted",
        created_at=submission.created_at,
        trace_id=trace_id,
        decision_status=decision.status,
        reason=decision.reason,
    )


@router.get("/submissions/{submission_id}", response_model=dict)
async def get_practitioner_submission(submission_id: str) -> dict:
    """
    Retrieve a previously submitted Practitioner CSF by ID.
    
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
        "practitioner_name": form_data.get("prescriber_name"),
        "account_number": form_data.get("account_number"),
        "status": submission.decision_status or submission.status,
        "submitted_at": submission.created_at,
        "trace_id": submission.trace_id,
        "payload": payload,
    }
