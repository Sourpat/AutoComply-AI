from __future__ import annotations

from typing import Any, Dict, Optional

from .canonical import CanonicalSubmission


def _first_value(payload: Dict[str, Any], keys: list[str]) -> Optional[str]:
    for key in keys:
        value = payload.get(key)
        if value is None:
            continue
        if isinstance(value, str) and value.strip():
            return value.strip()
        if isinstance(value, (int, float)):
            return str(value)
    return None


def _first_list(payload: Dict[str, Any], keys: list[str]) -> list[str]:
    for key in keys:
        value = payload.get(key)
        if isinstance(value, list) and value:
            return [str(item) for item in value if item is not None]
        if isinstance(value, str) and value.strip():
            return [value.strip()]
    return []


def normalize_csf_practitioner(payload: Dict[str, Any]) -> CanonicalSubmission:
    form = payload.get("form") if isinstance(payload.get("form"), dict) else payload
    form = form or {}

    return CanonicalSubmission(
        submission_id=str(payload.get("submission_id") or payload.get("id") or ""),
        kind="csf_practitioner",
        jurisdiction=_first_value(form, ["state", "state_code", "jurisdiction", "jurisdiction_code"]),
        entity_type="practitioner",
        identifiers={
            "dea_number": _first_value(form, ["dea_number", "deaNumber", "dea_registration"]),
            "npi": _first_value(form, ["npi", "npi_number"]),
            "state_license": _first_value(form, ["state_license_number", "stateLicenseNumber"]),
        },
        expirations={
            "dea_exp": _first_value(form, ["dea_expiration", "dea_expiry", "deaExpiration"]),
            "state_exp": _first_value(form, ["state_license_expiration", "state_expiration", "stateLicenseExpiration"]),
        },
        schedules=_first_list(form, ["requested_schedules", "requested_schedule", "authorized_schedules", "authorizedSchedules"]),
        attestations={
            "attestation_complete": _first_value(form, ["attestation_complete", "attestationComplete"]),
            "telemedicine_flag": _first_value(form, ["telemedicine_flag", "telemedicineFlag", "is_telemedicine"]),
        },
        documents=form.get("documents") if isinstance(form.get("documents"), list) else [],
        raw=payload,
    )


def normalize_csf_hospital_ohio(payload: Dict[str, Any]) -> CanonicalSubmission:
    form = payload.get("form") if isinstance(payload.get("form"), dict) else payload
    form = form or {}

    return CanonicalSubmission(
        submission_id=str(payload.get("submission_id") or payload.get("id") or ""),
        kind="csf_hospital_ohio",
        jurisdiction=_first_value(form, ["state", "state_code", "jurisdiction", "jurisdiction_code"]) or "OH",
        entity_type=_first_value(form, ["facility_type", "entity_type"]) or "hospital",
        identifiers={
            "tddd_cert": _first_value(form, ["tddd_certificate_number", "tddd_certificate", "tdddCertificateNumber"]),
            "dea_number": _first_value(form, ["facility_dea_number", "dea_number", "deaNumber"]),
        },
        expirations={
            "tddd_exp": _first_value(form, ["tddd_expiration", "tddd_expiry", "tdddExpiration"]),
        },
        schedules=_first_list(form, ["authorized_schedules", "authorizedSchedules", "requested_schedules", "requested_schedule"]),
        attestations={
            "attestation_complete": _first_value(form, ["attestation_complete", "attestationComplete"]),
        },
        documents=form.get("documents") if isinstance(form.get("documents"), list) else [],
        raw=payload,
    )
