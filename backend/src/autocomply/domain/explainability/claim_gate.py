from __future__ import annotations

from typing import Iterable, List

from src.autocomply.domain.explainability.models import Citation, FiredRule, MissingField

_DISALLOWED_MARKERS = [
    "required by",
    "must comply with",
    "statute",
    "cfr",
    "per regulation",
]


def _allowed_tokens(
    missing_fields: Iterable[MissingField],
    fired_rules: Iterable[FiredRule],
    citations: Iterable[Citation],
) -> set[str]:
    tokens: set[str] = set()
    for field in missing_fields:
        if field.key:
            tokens.add(field.key.lower())
        if field.label:
            tokens.add(field.label.lower())
    for rule in fired_rules:
        if rule.id:
            tokens.add(rule.id.lower())
        if rule.name:
            tokens.add(rule.name.lower())
    for citation in citations:
        if citation.source_title:
            tokens.add(citation.source_title.lower())
    return tokens


def _safe_template(status: str, missing_fields: List[MissingField]) -> str:
    if status == "approved":
        return "Approved based on provided submission data and current policy checks."

    if status == "needs_review":
        review_labels = [field.label for field in missing_fields if field.category == "REVIEW"]
        top_labels = [label for label in review_labels if label][:2]
        if top_labels:
            return f"Needs review due to incomplete or unclear information: {', '.join(top_labels)}."
        return "Needs review due to incomplete or unclear information."

    block_labels = [field.label for field in missing_fields if field.category == "BLOCK"]
    top_labels = [label for label in block_labels if label][:2]
    if top_labels:
        return (
            "Blocked due to missing required information: "
            f"{', '.join(top_labels)}. Provide the missing items and re-run."
        )
    return "Blocked due to missing required information. Provide the missing items and re-run."


def gate_summary(
    summary: str,
    missing_fields: List[MissingField],
    fired_rules: List[FiredRule],
    citations: List[Citation],
    status: str,
) -> str:
    if not summary or not summary.strip():
        return _safe_template(status, missing_fields)

    lowered = summary.lower()
    allowed = _allowed_tokens(missing_fields, fired_rules, citations)

    if not citations and any(marker in lowered for marker in _DISALLOWED_MARKERS):
        return _safe_template(status, missing_fields)

    if "tddd" in lowered and not any("tddd" in token for token in allowed):
        return _safe_template(status, missing_fields)

    return summary
