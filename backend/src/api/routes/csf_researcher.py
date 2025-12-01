from fastapi import APIRouter

from src.api.models.compliance_models import ResearcherFormCopilotResponse
from src.autocomply.domain.csf_copilot import run_csf_copilot
from src.autocomply.domain.csf_researcher import (
    ResearcherCsfDecision,
    ResearcherCsfForm,
    evaluate_researcher_csf,
)
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


@router.post("/form-copilot", response_model=ResearcherFormCopilotResponse)
async def researcher_form_copilot(
    form: ResearcherCsfForm,
) -> ResearcherFormCopilotResponse:
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

    return ResearcherFormCopilotResponse(
        status=rag_result.status,
        reason=rag_result.reason,
        missing_fields=rag_result.missing_fields,
        regulatory_references=rag_result.regulatory_references,
        rag_explanation=rag_result.rag_explanation,
        artifacts_used=rag_result.artifacts_used,
        rag_sources=rag_result.rag_sources,
    )
