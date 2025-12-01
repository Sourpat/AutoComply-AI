from fastapi import APIRouter

from src.api.models.compliance_models import EmsFormCopilotResponse
from src.autocomply.domain.csf_copilot import run_csf_copilot
from src.autocomply.domain.csf_ems import (
    EmsCsfDecision,
    EmsCsfForm,
    evaluate_ems_csf,
)
from src.utils.logger import get_logger

router = APIRouter(prefix="/csf/ems", tags=["csf_ems"])

logger = get_logger(__name__)


@router.post("/evaluate", response_model=EmsCsfDecision)
async def evaluate_ems_csf_endpoint(form: EmsCsfForm) -> EmsCsfDecision:
    """Evaluate an EMS Controlled Substance Form and return a decision."""

    logger.info(
        "EMS CSF evaluation request received",
        extra={"engine_family": "csf", "decision_type": "csf_ems"},
    )

    return evaluate_ems_csf(form)


@router.post("/form-copilot", response_model=EmsFormCopilotResponse)
async def ems_form_copilot(form: EmsCsfForm) -> EmsFormCopilotResponse:
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

    return EmsFormCopilotResponse(
        status=rag_result.status,
        reason=rag_result.reason,
        missing_fields=rag_result.missing_fields,
        regulatory_references=rag_result.regulatory_references,
        rag_explanation=rag_result.rag_explanation,
        artifacts_used=rag_result.artifacts_used,
        rag_sources=rag_result.rag_sources,
    )

