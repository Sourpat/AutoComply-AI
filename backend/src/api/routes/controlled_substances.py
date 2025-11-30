from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter, Query
from pydantic import BaseModel, Field

from autocomply.domain.controlled_substances_catalog import (
    get_history_for_account,
    search_controlled_substances,
)
from autocomply.domain.rag_regulatory_explain import (
    RegulatoryRagAnswer,
    explain_csf_facility_decision,
)
from src.api.models.compliance_models import (
    FacilityFormCopilotRequest,
    FacilityFormCopilotResponse,
)
from src.utils.logger import get_logger

router = APIRouter(
    prefix="/controlled-substances",
    tags=["controlled_substances"],
)

facility_router = APIRouter(
    prefix="/csf/facility",
    tags=["csf_facility"],
)

logger = get_logger(__name__)


class ControlledSubstance(BaseModel):
    id: str
    name: str
    strength: Optional[str] = None
    unit: Optional[str] = None
    schedule: Optional[str] = None
    dea_code: Optional[str] = None


class ControlledSubstanceHistoryItem(ControlledSubstance):
    account_number: Optional[str] = None
    last_ordered_at: Optional[str] = Field(
        default=None,
        description="ISO date string (YYYY-MM-DD) of last order, if known.",
    )


@router.get("/search", response_model=List[ControlledSubstance])
async def search_endpoint(
    q: str = Query(..., min_length=2, description="Free-text search query"),
) -> List[ControlledSubstance]:
    """
    Live search for controlled substances by name or DEA code.
    """
    results = search_controlled_substances(q)
    return [
        ControlledSubstance(**{
            "id": item.id,
            "name": item.name,
            "strength": item.strength,
            "unit": item.unit,
            "schedule": item.schedule,
            "dea_code": item.dea_code,
        })
        for item in results
    ]


@router.get("/history", response_model=List[ControlledSubstanceHistoryItem])
async def history_endpoint(
    account_number: str = Query(
        ...,
        min_length=1,
        description="Account number to fetch recent controlled substance items for.",
    ),
) -> List[ControlledSubstanceHistoryItem]:
    """
    Returns recent controlled substances ordered for a given account number.
    """
    items = get_history_for_account(account_number)
    return [
        ControlledSubstanceHistoryItem(**{
            "id": item.id,
            "name": item.name,
            "strength": item.strength,
            "unit": item.unit,
            "schedule": item.schedule,
            "dea_code": item.dea_code,
            "account_number": item.account_number,
            "last_ordered_at": (
                item.last_ordered_at.isoformat()
                if item.last_ordered_at is not None
                else None
            ),
        })
        for item in items
    ]


@facility_router.post("/form-copilot", response_model=FacilityFormCopilotResponse)
async def facility_form_copilot(
    payload: FacilityFormCopilotRequest,
) -> FacilityFormCopilotResponse:
    """Facility CSF Form Copilot backed by regulatory RAG."""

    logger.info(
        "Facility CSF copilot request received",
        extra={
            "engine_family": payload.engine_family,
            "decision_type": payload.decision_type,
            "decision_status": payload.decision.status,
        },
    )

    question = payload.ask or (
        "Explain to a verification specialist what this Facility CSF decision "
        "means, what is missing, and what is required next."
    )
    references = (
        payload.decision.regulatory_references or ["csf_facility_form"]
    )

    explanation = payload.decision.reason
    rag_sources = []
    artifacts_used = []

    try:
        rag_answer: RegulatoryRagAnswer = explain_csf_facility_decision(
            decision=payload.decision.model_dump(),
            question=question,
            regulatory_references=references,
        )
        artifacts_used = rag_answer.artifacts_used
        rag_sources = rag_answer.sources
        explanation = rag_answer.answer or explanation

        if rag_answer.debug.get("mode") == "stub":
            explanation = (
                "RAG pipeline is not yet enabled for Facility CSF (using stub mode). "
                f"Decision summary: {payload.decision.reason}"
            )
    except Exception:
        logger.exception(
            "Failed to generate facility CSF copilot explanation",
            extra={
                "engine_family": payload.engine_family,
                "decision_type": payload.decision_type,
            },
        )
        explanation = (
            "RAG pipeline is not yet enabled for Facility CSF (using stub mode). "
            f"Decision summary: {payload.decision.reason}"
        )

    logger.info(
        "Facility CSF copilot response ready",
        extra={
            "engine_family": payload.engine_family,
            "decision_type": payload.decision_type,
            "decision_status": payload.decision.status,
        },
    )

    return FacilityFormCopilotResponse(
        engine_family=payload.engine_family,
        decision_type=payload.decision_type,
        decision=payload.decision,
        explanation=explanation,
        regulatory_references=references,
        artifacts_used=artifacts_used,
        rag_sources=rag_sources,
    )
