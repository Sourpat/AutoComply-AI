"""REST endpoints for license validation flows."""

from fastapi import APIRouter

router = APIRouter(prefix="/licenses", tags=["licenses"])


@router.get("/{license_id}")
def get_license_status(license_id: str) -> dict[str, str]:
    """Stubbed endpoint that will eventually surface validation decisions."""
    return {"license_id": license_id, "status": "pending"}
