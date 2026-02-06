from fastapi import APIRouter, HTTPException, Query

from src.autocomply.domain.verifier_store import list_cases, get_case

router = APIRouter(prefix="/api/verifier", tags=["verifier"])


@router.get("/cases")
def list_verifier_cases(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    status: str | None = Query(None),
    jurisdiction: str | None = Query(None),
) -> dict:
    items, count = list_cases(limit=limit, offset=offset, status=status, jurisdiction=jurisdiction)
    return {
        "items": items,
        "limit": limit,
        "offset": offset,
        "count": count,
    }


@router.get("/cases/{case_id}")
def get_verifier_case(case_id: str) -> dict:
    payload = get_case(case_id)
    if not payload:
        raise HTTPException(status_code=404, detail="Case not found")
    return payload
