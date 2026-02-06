from __future__ import annotations

from typing import Dict, List, Tuple

from src.autocomply.domain.explainability.models import FieldCategory, FiredRule, MissingField, NextStep
from src.autocomply.domain.submissions.canonical import CanonicalSubmission


def _missing_field(
    key: str,
    label: str,
    category: FieldCategory,
    path: str | None,
    reason: str | None,
) -> MissingField:
    return MissingField(
        key=key,
        label=label,
        category=category,
        path=path,
        reason=reason,
    )


def _rule(
    rule_id: str,
    name: str,
    severity: FieldCategory,
    rationale: str,
    inputs: Dict[str, str],
    conditions: Dict[str, str] | None = None,
) -> FiredRule:
    return FiredRule(
        id=rule_id,
        name=name,
        severity=severity,
        rationale=rationale,
        inputs=inputs,
        conditions=conditions,
    )


def evaluate_submission(
    canonical: CanonicalSubmission,
) -> Tuple[str, str, List[MissingField], List[FiredRule], List[NextStep]]:
    missing_fields: List[MissingField] = []
    fired_rules: List[FiredRule] = []
    next_steps: List[NextStep] = []

    identifiers = canonical.identifiers
    expirations = canonical.expirations
    schedules = canonical.schedules
    attestations = canonical.attestations

    if canonical.kind == "csf_practitioner":
        if not identifiers.get("dea_number"):
            missing_fields.append(_missing_field("dea_number", "DEA Number", "BLOCK", "identifiers.dea_number", None))
            fired_rules.append(
                _rule(
                    "CSF_DEA_REQUIRED",
                    "DEA registration required",
                    "BLOCK",
                    "DEA number is required for controlled substance handling.",
                    {"dea_number": identifiers.get("dea_number") or ""},
                )
            )
        if not expirations.get("dea_exp"):
            missing_fields.append(_missing_field("dea_exp", "DEA Expiration", "BLOCK", "expirations.dea_exp", None))
        if not identifiers.get("state_license"):
            missing_fields.append(_missing_field("state_license", "State License Number", "BLOCK", "identifiers.state_license", None))
        if not expirations.get("state_exp"):
            missing_fields.append(_missing_field("state_exp", "State License Expiration", "BLOCK", "expirations.state_exp", None))
        if not canonical.jurisdiction:
            missing_fields.append(_missing_field("jurisdiction", "Jurisdiction", "BLOCK", "jurisdiction", None))
        if not schedules:
            missing_fields.append(_missing_field("requested_schedules", "Requested Schedules", "REVIEW", "schedules", "Requested schedules are recommended."))

    if canonical.kind == "csf_hospital_ohio":
        if not identifiers.get("tddd_cert"):
            missing_fields.append(_missing_field("tddd_cert", "TDDD Certificate Number", "BLOCK", "identifiers.tddd_cert", None))
            fired_rules.append(
                _rule(
                    "OH_TDDD_REQUIRED",
                    "Ohio TDDD certificate required",
                    "BLOCK",
                    "Ohio hospitals must maintain a TDDD certificate for Schedule II substances.",
                    {"tddd_cert": identifiers.get("tddd_cert") or ""},
                    {"jurisdiction": canonical.jurisdiction or "OH"},
                )
            )
        if not expirations.get("tddd_exp"):
            missing_fields.append(_missing_field("tddd_exp", "TDDD Expiration", "REVIEW", "expirations.tddd_exp", None))
        if not schedules:
            missing_fields.append(_missing_field("authorized_schedules", "Authorized Schedules", "BLOCK", "schedules", None))
        if not attestations.get("attestation_complete"):
            missing_fields.append(_missing_field("attestation_complete", "Attestation Complete", "REVIEW", "attestations.attestation_complete", None))

    block_missing = [field for field in missing_fields if field.category == "BLOCK"]
    review_missing = [field for field in missing_fields if field.category == "REVIEW"]

    if block_missing:
        status = "blocked"
        risk = "high"
    elif review_missing:
        status = "needs_review"
        risk = "medium"
    else:
        status = "approved"
        risk = "low"

    for field in missing_fields:
        next_steps.append(
            NextStep(
                action=f"Provide {field.label}",
                blocking=field.category == "BLOCK",
                rationale=field.reason,
            )
        )

    return status, risk, missing_fields, fired_rules, next_steps
