from typing import List

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, ConfigDict, Field

from src.api.models.decision import (
    DecisionOutcome,
    DecisionStatus,
    RegulatoryReference,
)
from src.autocomply.audit.decision_log import get_decision_log
from src.autocomply.domain.csf_copilot import CsfCopilotResult, run_csf_copilot
from src.autocomply.domain.controlled_substances import ControlledSubstanceItem
from src.autocomply.domain.csf_hospital import (
    HospitalCsfForm,
    HospitalFacilityType,
    evaluate_hospital_csf,
)
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
    trace_id: str
    status: str
    created_at: str
    decision_status: DecisionStatus | None = None
    reason: str | None = None


class HospitalSubmitRequest(BaseModel):
    """Accept both minimal and full Hospital CSF submit payloads."""

    model_config = ConfigDict(extra="allow")

    account_number: str | None = None
    facility_name: str | None = None
    pharmacy_license_number: str | None = None
    dea_number: str | None = None
    ship_to_state: str | None = None
    attestation_accepted: bool | None = None
    facility_type: HospitalFacilityType | None = None
    pharmacist_in_charge_name: str | None = None
    pharmacist_contact_phone: str | None = None
    controlled_substances: list[ControlledSubstanceItem] = Field(default_factory=list)
    tenant: str | None = None


@router.post("/submit", response_model=SubmissionResponse)
async def submit_hospital_csf(form: HospitalSubmitRequest) -> SubmissionResponse:
    """
    Submit a Hospital CSF for internal verification tracking.

    Creates a submission record in the unified submissions store
    with trace_id for replay in Compliance Console.
    """
    trace_id = generate_trace_id()
    tenant = getattr(form, "tenant", None) or "hospital-default"
    form_payload = form.model_dump()

    try:
        normalized_form = HospitalCsfForm.model_validate(
            {
                "facility_name": form.facility_name or "Hospital",
                "facility_type": form.facility_type or HospitalFacilityType.HOSPITAL,
                "account_number": form.account_number,
                "pharmacy_license_number": form.pharmacy_license_number or "",
                "dea_number": form.dea_number or "",
                "pharmacist_in_charge_name": form.pharmacist_in_charge_name or "",
                "pharmacist_contact_phone": form.pharmacist_contact_phone,
                "ship_to_state": form.ship_to_state or "",
                "attestation_accepted": bool(form.attestation_accepted),
                "controlled_substances": form.controlled_substances or [],
                "internal_notes": form_payload.get("internal_notes"),
            }
        )
        decision = evaluate_hospital_csf(normalized_form)
    except Exception:
        decision = None

    status_map = {
        "ok_to_ship": DecisionStatus.OK_TO_SHIP,
        "blocked": DecisionStatus.BLOCKED,
        "manual_review": DecisionStatus.NEEDS_REVIEW,
        "needs_review": DecisionStatus.NEEDS_REVIEW,
    }
    normalized_status = (
        status_map.get(decision.status.value, DecisionStatus.NEEDS_REVIEW)
        if decision
        else DecisionStatus.NEEDS_REVIEW
    )

    priority = SubmissionPriority.HIGH if normalized_status == DecisionStatus.BLOCKED else SubmissionPriority.MEDIUM

    facility_name = form.facility_name or form.account_number
    title = f"Hospital CSF – {facility_name or 'Submission'}"

    if normalized_status == DecisionStatus.BLOCKED:
        subtitle = f"Blocked: {decision.reason if decision else ''}"
    elif normalized_status == DecisionStatus.NEEDS_REVIEW:
        subtitle = f"Review required: {decision.reason if decision else ''}"
    else:
        subtitle = "Submitted for verification"

    store = get_submission_store()
    submission = store.create_submission(
        csf_type="hospital",
        tenant=tenant,
        title=title,
        subtitle=subtitle,
        trace_id=trace_id,
        payload={
            "form": form_payload,
            "decision": decision.model_dump() if decision else {},
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
        trace_id=submission.trace_id,
        status="submitted",
        created_at=submission.created_at,
        decision_status=normalized_status,
        reason=decision.reason if decision else None,
    )
