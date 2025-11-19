"""Stubbed compliance decision engine orchestrator."""

from .license_validator import LicenseValidator


def run_license_validation(check_request: dict) -> dict:
    """Route the request through the placeholder validator."""

    validator = LicenseValidator()
    return validator.evaluate(check_request)
