from fastapi import APIRouter, HTTPException

router = APIRouter(prefix="/api/verifier", tags=["verifier"])


@router.get("/cases")
def list_verifier_cases() -> dict:
    raise HTTPException(status_code=501, detail="Not Implemented")


@router.get("/cases/{case_id}")
def get_verifier_case(case_id: str) -> dict:
    raise HTTPException(status_code=501, detail="Not Implemented")
