from __future__ import annotations

from datetime import date, timedelta
from typing import Any, Dict


def make_ohio_hospital_csf_payload_base() -> Dict[str, Any]:
    """
    Base CSF payload for an Ohio hospital Schedule II scenario.

    Other scenarios (expired license, wrong state, etc.) can tweak fields on top.
    """
    return {
        "facility_name": "Scenario Hospital",
        "facility_type": "hospital",
        "account_number": "ACC-TEST",
        "pharmacy_license_number": "LIC-TEST",
        "dea_number": "DEA-TEST",
        "pharmacist_in_charge_name": "Dr. Scenario",
        "pharmacist_contact_phone": "555-0000",
        "ship_to_state": "OH",
        "attestation_accepted": True,
        "internal_notes": "Scenario: Ohio hospital Schedule II baseline payload.",
        "controlled_substances": [
            {
                "id": "cs-oxy-10mg-tab",
                "name": "Oxycodone 10 mg tablet",
                "ndc": "0000-0000-00",
                "strength": "10 mg",
                "dosage_form": "tablet",
                "dea_schedule": "II",
            }
        ],
    }


def make_ohio_hospital_csf_payload_expired_license() -> Dict[str, Any]:
    """
    Variant of the base CSF payload for the expired license scenario.
    """
    payload = make_ohio_hospital_csf_payload_base()
    return payload


def make_ohio_hospital_csf_payload_wrong_state() -> Dict[str, Any]:
    """
    Variant of the base CSF payload where ship_to_state is not Ohio.
    This should trigger 'needs_review' on the license side.
    """
    payload = make_ohio_hospital_csf_payload_base()
    payload["ship_to_state"] = "PA"
    return payload


def make_ohio_tddd_payload_from_csf(csf_payload: Dict[str, Any]) -> Dict[str, Any]:
    """
    Existing helper (if not already in utils) – here for clarity.
    Uses CSF facility data to build Ohio TDDD license payload.
    """
    return {
        "license_number": csf_payload.get("pharmacy_license_number") or "TDDD-TEST",
        "facility_name": csf_payload.get("facility_name", "Scenario Hospital"),
        "account_number": csf_payload.get("account_number", "ACC-TEST"),
        "license_type": "ohio_tddd",
        "ship_to_state": csf_payload.get("ship_to_state") or "OH",
        "attestation_accepted": csf_payload.get("attestation_accepted", True),
        # Default: active far-future expiry
        "expiration_date": (date.today() + timedelta(days=365 * 5)).isoformat(),
    }


def make_ohio_tddd_payload_expired_from_csf(csf_payload: Dict[str, Any]) -> Dict[str, Any]:
    """
    Same as make_ohio_tddd_payload_from_csf, but with an EXPIRED expiration_date.
    """
    payload = make_ohio_tddd_payload_from_csf(csf_payload)
    payload["expiration_date"] = (date.today() - timedelta(days=30)).isoformat()
    return payload


def make_ohio_tddd_payload_wrong_state_from_csf(
    csf_payload: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Ohio TDDD payload derived from CSF, but with a non-Ohio ship_to_state.
    """
    payload = make_ohio_tddd_payload_from_csf(csf_payload)
    payload["ship_to_state"] = csf_payload.get("ship_to_state") or "PA"
    payload["expiration_date"] = (date.today() + timedelta(days=365 * 5)).isoformat()
    return payload
