"""Placeholder rule executor for professional license checks."""

from .rules.controlled_substance_rules import CONTROLLED_SUBSTANCE_RULES


class LicenseValidator:
    """Very small shim that returns a canned response."""

    def evaluate(self, payload: dict) -> dict:
        """Return a deterministic placeholder decision."""

        license_id = payload.get("license_id", "unknown")
        jurisdiction = payload.get("jurisdiction", "unspecified")
        return {
            "license_id": license_id,
            "jurisdiction": jurisdiction,
            "rules_loaded": len(CONTROLLED_SUBSTANCE_RULES),
            "decision": "manual_review",
        }
