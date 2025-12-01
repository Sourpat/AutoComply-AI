from typing import List

from fastapi import APIRouter

from src.autocomply.domain.csf_practitioner import (
    CsDecisionStatus,
    PractitionerCsfDecision,
    PractitionerCsfForm,
    describe_practitioner_csf_decision,
    evaluate_practitioner_csf,
)
from src.autocomply.domain.csf_copilot import run_csf_copilot
from src.api.models.compliance_models import PractitionerFormCopilotResponse
from src.utils.logger import get_logger

router = APIRouter(
    prefix="/csf/practitioner",
    tags=["csf_practitioner"],
)

logger = get_logger(__name__)


@router.post("/evaluate", response_model=PractitionerCsfDecision)
async def evaluate_practitioner_csf_endpoint(
    form: PractitionerCsfForm,
) -> PractitionerCsfDecision:
    """
    Evaluate a Practitioner Controlled Substance Form and return a decision.
    """
    decision = evaluate_practitioner_csf(form)
    explanation = describe_practitioner_csf_decision(form, decision)
    logger.info(
        "Practitioner CSF decision explanation",
        extra={
            "decision_status": decision.status,
            "missing_fields": decision.missing_fields,
            "explanation": explanation,
        },
    )
    return decision


@router.post("/form-copilot", response_model=PractitionerFormCopilotResponse)
async def practitioner_form_copilot(
    form: PractitionerCsfForm,
) -> PractitionerFormCopilotResponse:
    """Practitioner Form Copilot endpoint backed by regulatory RAG."""

    copilot_request = {
        "csf_type": "practitioner",
        "name": form.practitioner_name or form.facility_name,
        "facility_type": form.facility_type,
        "account_number": form.account_number,
        "pharmacy_license_number": form.state_license_number,
        "practitioner_name": form.practitioner_name,
        "state_license_number": form.state_license_number,
        "dea_number": form.dea_number,
        "pharmacist_in_charge_name": form.practitioner_name,
        "pharmacist_contact_phone": None,
        "ship_to_state": form.ship_to_state,
        "attestation_accepted": form.attestation_accepted,
        "internal_notes": form.internal_notes,
        "controlled_substances": form.controlled_substances,
    }

    rag_result = await run_csf_copilot(copilot_request)

    logger.info(
        "Practitioner CSF copilot request received",
        extra={
            "engine_family": "csf",
            "decision_type": "csf_practitioner",
            "decision_status": rag_result.status,
        },
    )

    return PractitionerFormCopilotResponse(
        status=rag_result.status,
        reason=rag_result.reason,
        missing_fields=rag_result.missing_fields,
        regulatory_references=rag_result.regulatory_references,
        rag_explanation=rag_result.rag_explanation,
        artifacts_used=rag_result.artifacts_used,
        rag_sources=rag_result.rag_sources,
    )
