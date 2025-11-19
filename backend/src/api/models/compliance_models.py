"""Pydantic data models shared across the API layer."""

from pydantic import BaseModel, Field


class LicenseCheckRequest(BaseModel):
    """Minimal payload describing the license to validate."""

    license_id: str = Field(..., description="Unique identifier supplied by the client")
    jurisdiction: str = Field(..., description="Issuing state or region")


class LicenseCheckResponse(BaseModel):
    """Placeholder response structure returned by the API."""

    license_id: str
    status: str
    details: dict[str, str] | None = None
