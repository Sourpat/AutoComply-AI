from fastapi import APIRouter

from src.autocomply.domain.csf_hospital import (
    HospitalCsfDecision,
    HospitalCsfForm,
    evaluate_hospital_csf,
)

router = APIRouter(
    prefix="/csf/hospital",
    tags=["csf_hospital"],
)


@router.post("/evaluate", response_model=HospitalCsfDecision)
async def evaluate_hospital_csf_endpoint(
    form: HospitalCsfForm,
) -> HospitalCsfDecision:
    """
    Evaluate a Hospital Pharmacy Controlled Substance Form and return a decision.
    """
    decision = evaluate_hospital_csf(form)
    return decision
