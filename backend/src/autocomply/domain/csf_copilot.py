from typing import Any, Dict, List, Optional, Union

from pydantic import BaseModel, Field

from src.autocomply.domain.csf_facility import (
    FacilityCsfForm,
    FacilityFacilityType,
    evaluate_facility_csf,
)
from src.autocomply.domain.csf_ems import EmsCsfForm, evaluate_ems_csf
from src.autocomply.domain.csf_hospital import (
    HospitalCsfForm,
    HospitalFacilityType,
    evaluate_hospital_csf,
)
from src.autocomply.domain.csf_researcher import (
    ResearcherCsfForm,
    evaluate_researcher_csf,
)
from src.autocomply.domain.csf_practitioner import (
    CsDecisionStatus,
    PractitionerCsfForm,
    PractitionerFacilityType,
    evaluate_practitioner_csf,
)
from src.autocomply.domain.rag_regulatory_explain import (
    RegulatoryRagAnswer,
    explain_csf_facility_decision,
    explain_csf_hospital_decision,
    explain_csf_practitioner_decision,
)
from src.rag.csf_copilot_prompt import build_csf_copilot_prompt
from src.api.models.compliance_models import RegulatorySource
from src.utils.logger import get_logger

logger = get_logger(__name__)


class CsfCopilotRequest(BaseModel):
    """Normalized request payload for CSF Copilot."""

    csf_type: str = Field(
        default="hospital",
        description="CSF flavor to explain (hospital or facility).",
    )
    name: Optional[str] = Field(default=None, description="Facility or hospital name")
    facility_type: Optional[str] = None
    account_number: Optional[str] = None
    pharmacy_license_number: Optional[str] = None
    practitioner_name: Optional[str] = None
    state_license_number: Optional[str] = None
    dea_number: Optional[str] = None
    pharmacist_in_charge_name: Optional[str] = None
    pharmacist_contact_phone: Optional[str] = None
    ship_to_state: Optional[str] = None
    attestation_accepted: bool = False
    internal_notes: Optional[str] = None
    controlled_substances: List[Any] = Field(default_factory=list)


class CsfCopilotResult(BaseModel):
    status: CsDecisionStatus
    reason: str
    missing_fields: List[str] = Field(default_factory=list)
    regulatory_references: List[str] = Field(default_factory=list)
    rag_explanation: str
    artifacts_used: List[str] = Field(default_factory=list)
    rag_sources: List[RegulatorySource] = Field(default_factory=list)


def _facility_success_reason(reason: str) -> str:
    """Normalize success copy to be Facility-specific."""

    if not reason:
        return reason

    return reason.replace(
        "Hospital CSF is approved to proceed.",
        "Facility CSF is approved to proceed.",
    )


async def run_csf_copilot(
    copilot_request: Union[CsfCopilotRequest, Dict[str, Any]]
) -> CsfCopilotResult:
    """Execute the CSF copilot RAG flow for hospital or facility forms."""

    request_model = (
        copilot_request
        if isinstance(copilot_request, CsfCopilotRequest)
        else CsfCopilotRequest.model_validate(copilot_request)
    )

    csf_type = (request_model.csf_type or "hospital").lower()
    if csf_type == "facility":
        doc_id = "csf_facility_form"
    elif csf_type == "ems":
        doc_id = "csf_ems_form"
    elif csf_type == "researcher":
        doc_id = "csf_researcher_form"
    elif csf_type == "practitioner":
        doc_id = "csf_practitioner_form"
    else:
        doc_id = "csf_hospital_form"
    prompt = build_csf_copilot_prompt(
        csf_type=csf_type, payload=request_model.model_dump()
    )

    rag_explanation = ""
    rag_sources: List[RegulatorySource] = []
    artifacts_used: List[str] = []

    if csf_type == "facility":
        facility_form = FacilityCsfForm(
            facility_name=request_model.name or "",
            facility_type=(
                FacilityFacilityType(request_model.facility_type)
                if request_model.facility_type
                else FacilityFacilityType.FACILITY
            ),
            account_number=request_model.account_number,
            pharmacy_license_number=request_model.pharmacy_license_number or "",
            dea_number=request_model.dea_number or "",
            pharmacist_in_charge_name=request_model.pharmacist_in_charge_name or "",
            pharmacist_contact_phone=request_model.pharmacist_contact_phone,
            ship_to_state=request_model.ship_to_state or "",
            attestation_accepted=request_model.attestation_accepted,
            controlled_substances=request_model.controlled_substances,
            internal_notes=request_model.internal_notes,
        )

        decision = evaluate_facility_csf(facility_form)
        decision.reason = _facility_success_reason(decision.reason)
        references = decision.regulatory_references or ["csf_facility_form"]
        references = [
            "csf_facility_form" if ref == "csf_hospital_form" else ref
            for ref in references
        ]
        rag_explanation = decision.reason

        logger.info(
            "Facility CSF copilot request received",
            extra={
                "engine_family": "csf",
                "decision_type": "csf_facility",
                "doc_id": doc_id,
                "decision_status": decision.status,
            },
        )

        try:
            rag_answer: RegulatoryRagAnswer = explain_csf_facility_decision(
                decision=decision.model_dump(),
                question=prompt,
                regulatory_references=references,
            )
            rag_explanation = _facility_success_reason(
                rag_answer.answer or rag_explanation
            )
            rag_sources = rag_answer.sources
            artifacts_used = rag_answer.artifacts_used

            if rag_answer.debug.get("mode") == "stub":
                rag_explanation = (
                    "RAG pipeline is not yet enabled for Facility CSF (using stub mode). "
                    f"Decision summary: {decision.reason}"
                )
        except Exception:
            logger.exception(
                "Failed to generate facility CSF copilot explanation",
                extra={
                    "engine_family": "csf",
                    "decision_type": "csf_facility",
                    "doc_id": doc_id,
                },
            )
            rag_explanation = (
                "RAG pipeline is not yet enabled for Facility CSF (using stub mode). "
                f"Decision summary: {_facility_success_reason(decision.reason)}"
            )

        return CsfCopilotResult(
            status=decision.status,
            reason=decision.reason,
            missing_fields=decision.missing_fields,
            regulatory_references=references,
            rag_explanation=rag_explanation,
            artifacts_used=artifacts_used,
            rag_sources=rag_sources,
        )

    if csf_type == "ems":
        ems_form = EmsCsfForm(
            facility_name=request_model.name or "",
            facility_type=request_model.facility_type,
            account_number=request_model.account_number,
            pharmacy_license_number=request_model.pharmacy_license_number or "",
            dea_number=request_model.dea_number or "",
            pharmacist_in_charge_name=request_model.pharmacist_in_charge_name or "",
            pharmacist_contact_phone=request_model.pharmacist_contact_phone,
            ship_to_state=request_model.ship_to_state or "",
            attestation_accepted=request_model.attestation_accepted,
            controlled_substances=request_model.controlled_substances,
            internal_notes=request_model.internal_notes,
        )

        decision = evaluate_ems_csf(ems_form)
        references = decision.regulatory_references or ["csf_ems_form"]
        rag_explanation = decision.reason

        logger.info(
            "EMS CSF copilot request received",
            extra={
                "engine_family": "csf",
                "decision_type": "csf_ems",
                "doc_id": doc_id,
                "decision_status": decision.status,
            },
        )

        try:
            rag_answer: RegulatoryRagAnswer = explain_csf_facility_decision(
                decision=decision.model_dump(),
                question=prompt,
                regulatory_references=references,
            )
            rag_explanation = rag_answer.answer or rag_explanation
            rag_sources = rag_answer.sources
            artifacts_used = rag_answer.artifacts_used

            if rag_answer.debug.get("mode") == "stub":
                rag_explanation = (
                    "RAG pipeline is not yet enabled for EMS CSF (using stub mode). "
                    f"Decision summary: {decision.reason}"
                )
        except Exception:
            logger.exception(
                "Failed to generate EMS CSF copilot explanation",
                extra={
                    "engine_family": "csf",
                    "decision_type": "csf_ems",
                    "doc_id": doc_id,
                },
            )
            rag_explanation = (
                "RAG pipeline is not yet enabled for EMS CSF (using stub mode). "
                f"Decision summary: {decision.reason}"
            )

        return CsfCopilotResult(
            status=decision.status,
            reason=decision.reason,
            missing_fields=decision.missing_fields,
            regulatory_references=references,
            rag_explanation=rag_explanation,
            artifacts_used=artifacts_used,
            rag_sources=rag_sources,
        )

    if csf_type == "researcher":
        researcher_form = ResearcherCsfForm(
            facility_name=request_model.name or "",
            facility_type=request_model.facility_type,
            account_number=request_model.account_number,
            pharmacy_license_number=request_model.pharmacy_license_number or "",
            dea_number=request_model.dea_number or "",
            pharmacist_in_charge_name=request_model.pharmacist_in_charge_name or "",
            pharmacist_contact_phone=request_model.pharmacist_contact_phone,
            ship_to_state=request_model.ship_to_state or "",
            attestation_accepted=request_model.attestation_accepted,
            controlled_substances=request_model.controlled_substances,
            internal_notes=request_model.internal_notes,
        )

        decision = evaluate_researcher_csf(researcher_form)
        references = decision.regulatory_references or ["csf_researcher_form"]
        rag_explanation = decision.reason

        logger.info(
            "Researcher CSF copilot request received",
            extra={
                "engine_family": "csf",
                "decision_type": "csf_researcher",
                "doc_id": doc_id,
                "decision_status": decision.status,
            },
        )

        try:
            rag_answer = explain_csf_facility_decision(
                decision=decision.model_dump(),
                question=prompt,
                regulatory_references=references,
            )
            rag_explanation = rag_answer.answer or rag_explanation
            rag_sources = rag_answer.sources
            artifacts_used = rag_answer.artifacts_used

            if rag_answer.debug.get("mode") == "stub":
                rag_explanation = (
                    "RAG pipeline is not yet enabled for Researcher CSF (using stub mode). "
                    f"Decision summary: {decision.reason}"
                )
        except Exception:
            logger.exception(
                "Failed to generate Researcher CSF copilot explanation",
                extra={
                    "engine_family": "csf",
                    "decision_type": "csf_researcher",
                    "doc_id": doc_id,
                },
            )
            rag_explanation = (
                "RAG pipeline is not yet enabled for Researcher CSF (using stub mode). "
                f"Decision summary: {decision.reason}"
            )

        return CsfCopilotResult(
            status=decision.status,
            reason=decision.reason,
            missing_fields=decision.missing_fields,
            regulatory_references=references,
            rag_explanation=rag_explanation,
            artifacts_used=artifacts_used,
            rag_sources=rag_sources,
        )

    if csf_type == "practitioner":
        practitioner_form = PractitionerCsfForm(
            facility_name=request_model.name or "",
            facility_type=(
                PractitionerFacilityType(request_model.facility_type)
                if request_model.facility_type
                else PractitionerFacilityType.OTHER
            ),
            account_number=request_model.account_number,
            practitioner_name=request_model.practitioner_name or "",
            state_license_number=request_model.state_license_number or "",
            dea_number=request_model.dea_number or "",
            ship_to_state=request_model.ship_to_state or "",
            attestation_accepted=request_model.attestation_accepted,
            controlled_substances=request_model.controlled_substances,
            internal_notes=request_model.internal_notes,
        )

        decision = evaluate_practitioner_csf(practitioner_form)
        references = decision.regulatory_references or ["csf_practitioner_form"]
        rag_explanation = decision.reason

        logger.info(
            "Practitioner CSF copilot request received",
            extra={
                "engine_family": "csf",
                "decision_type": "csf_practitioner",
                "doc_id": doc_id,
                "decision_status": decision.status,
            },
        )

        try:
            rag_answer = explain_csf_practitioner_decision(
                decision=decision.model_dump(),
                question=prompt,
                regulatory_references=references,
            )
            rag_explanation = rag_answer.answer or rag_explanation
            rag_sources = rag_answer.sources
            artifacts_used = rag_answer.artifacts_used

            if rag_answer.debug.get("mode") == "stub":
                rag_explanation = (
                    "RAG pipeline is not yet enabled for Practitioner CSF (using stub mode). "
                    f"Decision summary: {decision.reason}"
                )
        except Exception:
            logger.exception(
                "Failed to generate practitioner CSF copilot explanation",
                extra={
                    "engine_family": "csf",
                    "decision_type": "csf_practitioner",
                    "doc_id": doc_id,
                },
            )
            rag_explanation = (
                "RAG pipeline is not yet enabled for Practitioner CSF (using stub mode). "
                f"Decision summary: {decision.reason}"
            )

        return CsfCopilotResult(
            status=decision.status,
            reason=decision.reason,
            missing_fields=decision.missing_fields,
            regulatory_references=references,
            rag_explanation=rag_explanation,
            artifacts_used=artifacts_used,
            rag_sources=rag_sources,
        )

    hospital_form = HospitalCsfForm(
        facility_name=request_model.name or "",
        facility_type=(
            HospitalFacilityType(request_model.facility_type)
            if request_model.facility_type
            else HospitalFacilityType.HOSPITAL
        ),
        account_number=request_model.account_number,
        pharmacy_license_number=request_model.pharmacy_license_number or "",
        dea_number=request_model.dea_number or "",
        pharmacist_in_charge_name=request_model.pharmacist_in_charge_name or "",
        pharmacist_contact_phone=request_model.pharmacist_contact_phone,
        ship_to_state=request_model.ship_to_state or "",
        attestation_accepted=request_model.attestation_accepted,
        controlled_substances=request_model.controlled_substances,
        internal_notes=request_model.internal_notes,
    )

    decision = evaluate_hospital_csf(hospital_form)
    references = decision.regulatory_references or ["csf_hospital_form"]
    rag_explanation = decision.reason

    logger.info(
        "Hospital CSF copilot request received",
        extra={
            "engine_family": "csf",
            "decision_type": "csf_hospital",
            "doc_id": doc_id,
            "decision_status": decision.status,
        },
    )

    try:
        rag_answer = explain_csf_hospital_decision(
            decision=decision.model_dump(),
            question=prompt,
            regulatory_references=references,
        )
        rag_explanation = rag_answer.answer or rag_explanation
        rag_sources = rag_answer.sources
        artifacts_used = rag_answer.artifacts_used

        if rag_answer.debug.get("mode") == "stub":
            rag_explanation = (
                "RAG pipeline is not yet enabled for Hospital CSF (using stub mode). "
                f"Decision summary: {decision.reason}"
            )
    except Exception:
        logger.exception(
            "Failed to generate hospital CSF copilot explanation",
            extra={
                "engine_family": "csf",
                "decision_type": "csf_hospital",
                "doc_id": doc_id,
            },
        )
        rag_explanation = (
            "RAG pipeline is not yet enabled for Hospital CSF (using stub mode). "
            f"Decision summary: {decision.reason}"
        )

    return CsfCopilotResult(
        status=decision.status,
        reason=decision.reason,
        missing_fields=decision.missing_fields,
        regulatory_references=references,
        rag_explanation=rag_explanation,
        artifacts_used=artifacts_used,
        rag_sources=rag_sources,
    )
