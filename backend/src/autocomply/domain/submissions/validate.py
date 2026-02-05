from __future__ import annotations

from typing import List

from src.autocomply.domain.explainability.models import MissingField
from src.autocomply.domain.submissions.canonical import CanonicalSubmission


def _missing_field(key: str, label: str, category: str, path: str | None, reason: str | None) -> MissingField:
    return MissingField(
        key=key,
        label=label,
        category=category,  # type: ignore[arg-type]
        path=path,
        reason=reason,
    )


def validate_canonical(canonical: CanonicalSubmission) -> List[MissingField]:
    missing: List[MissingField] = []

    if not canonical.submission_id:
        missing.append(
            _missing_field(
                "submission_id",
                "Submission ID",
                "REVIEW",
                "submission_id",
                "Submission id is missing from the payload.",
            )
        )

    if not canonical.entity_type:
        missing.append(
            _missing_field(
                "entity_type",
                "Entity Type",
                "REVIEW",
                "entity_type",
                "Entity type is required for canonical evaluation.",
            )
        )

    if canonical.kind in {"csf_practitioner", "csf_hospital_ohio"} and not canonical.jurisdiction:
        missing.append(
            _missing_field(
                "jurisdiction",
                "Jurisdiction",
                "REVIEW",
                "jurisdiction",
                "Jurisdiction is required for canonical evaluation.",
            )
        )

    if canonical.kind == "csf_practitioner":
        if not canonical.identifiers.get("dea_number"):
            missing.append(
                _missing_field(
                    "dea_number",
                    "DEA Number",
                    "BLOCK",
                    "identifiers.dea_number",
                    None,
                )
            )

    if canonical.kind == "csf_hospital_ohio":
        if not canonical.identifiers.get("tddd_cert"):
            missing.append(
                _missing_field(
                    "tddd_cert",
                    "TDDD Certificate Number",
                    "BLOCK",
                    "identifiers.tddd_cert",
                    None,
                )
            )

    return missing
