"""Helpers to validate inbound payloads before invoking the decision engine."""

from pydantic import ValidationError

from ..models.compliance_models import LicenseCheckRequest


def validate_license_request(payload: dict) -> LicenseCheckRequest:
    """Parse and validate a request payload, raising a helpful error on failure."""

    try:
        return LicenseCheckRequest(**payload)
    except ValidationError as exc:  # pragma: no cover - placeholder behavior
        raise ValueError("Invalid payload") from exc
