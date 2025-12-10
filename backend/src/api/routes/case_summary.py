from fastapi import APIRouter, HTTPException

from src.autocomply.insights.case_summary import (
    ComplianceCaseSummary,
    build_case_summary,
)

router = APIRouter(prefix="/cases", tags=["cases"])


@router.get("/summary/{trace_id}", response_model=ComplianceCaseSummary)
async def get_case_summary(trace_id: str) -> ComplianceCaseSummary:
    try:
        return build_case_summary(trace_id=trace_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
