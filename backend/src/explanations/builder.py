from __future__ import annotations

from typing import Any, Mapping, Optional, Sequence

from src.rag.models import RagSource


def _status_phrase(status: str) -> str:
    """
    Map internal status to a short human-friendly phrase.
    """
    s = status.lower()
    if s == "ok_to_ship":
        return "appropriate to proceed with shipment"
    if s == "needs_review":
        return "requiring manual review before proceeding"
    if s == "blocked":
        return "not appropriate to proceed"
    # fallback for any future statuses
    return f"resulting in status '{status}'"


def _resolve_jurisdiction(
    decision: Any, jurisdiction: Optional[str]
) -> Optional[str]:
    """
    Prefer an explicit jurisdiction parameter; fall back to any hint in debug_info.
    """
    if jurisdiction:
        return jurisdiction

    dbg: Mapping[str, Any] = getattr(decision, "debug_info", None) or {}
    # example of where you might have stashed jurisdiction info earlier
    return dbg.get("jurisdiction") or dbg.get("jurisdiction_label")


def _describe_primary_source(source: RagSource) -> str:
    """
    Build a short descriptor for the top RAG source.
    Kept intentionally short and stable.
    """
    parts = []

    if source.citation:
        parts.append(source.citation)

    if source.label and source.label != source.citation:
        parts.append(source.label)

    if not parts and source.jurisdiction:
        parts.append(f"{source.jurisdiction} guidance")

    if not parts:
        return "the top matched regulatory source in the knowledge base"

    return ", ".join(parts)


def build_explanation(
    decision: Any,
    jurisdiction: Optional[str] = None,
    vertical_name: Optional[str] = None,
    rag_sources: Optional[Sequence[RagSource]] = None,
) -> str:
    """
    Build a deterministic, analyst-style explanation string.

    Inputs:
      - decision: canonical decision contract instance
      - jurisdiction: optional human-readable jurisdiction label
      - vertical_name: optional vertical label (e.g. 'NY Pharmacy vertical')
      - rag_sources: list of RagSource, assumed sorted by score (best first)

    Output:
      - explanation string to be stored in decision.reason
    """
    # Resolve jurisdiction (parameter > debug_info > None)
    jur = _resolve_jurisdiction(decision, jurisdiction)

    # Pick top RAG source if available
    primary_source: Optional[RagSource] = None
    sources = rag_sources if rag_sources is not None else getattr(decision, "rag_sources", None)
    if sources:
        primary_source = sources[0]

    # 1) Leading clause: jurisdiction + vertical
    # ------------------------------------------------
    if jur and vertical_name:
        lead = (
            "Based on the information provided, the current rules for "
            f"{jur}, and the context of the {vertical_name}, AutoComply AI "
        )
    elif jur:
        lead = (
            "Based on the information provided and the current rules for "
            f"{jur}, AutoComply AI "
        )
    elif vertical_name:
        lead = (
            "Based on the information provided and the modeled rules for the "
            f"{vertical_name}, AutoComply AI "
        )
    else:
        lead = "Based on the information provided and the modeled rules in AutoComply AI, the system "

    # 2) Status phrase
    # ------------------------------------------------
    status_value = str(getattr(decision, "status", "")).replace("DecisionStatus.", "")
    status_phrase = _status_phrase(status_value)

    # 3) Middle clause: describe what we concluded
    # ------------------------------------------------
    middle = f"considers this request {status_phrase}"

    # 3b) Preserve any engine-provided detail
    details_clause = ""
    details = (getattr(decision, "reason", None) or "").strip()
    if details:
        if details.endswith("."):
            details_clause = f" {details}"
        else:
            details_clause = f" {details}."

    # 4) RAG reference clause (if we have a source)
    # ------------------------------------------------
    rag_clause = ""
    if primary_source:
        source_desc = _describe_primary_source(primary_source)
        rag_clause = f" This assessment is informed by {source_desc}."

    # 5) Missing fields / follow-up hint for non-ok statuses
    # ------------------------------------------------
    followup = ""
    missing = getattr(decision, "missing_fields", None) or []
    if status_value in ("needs_review", "blocked"):
        if missing:
            # Keep deterministic: list fields in a stable way
            missing_list = ", ".join(sorted(str(m) for m in missing))
            followup = f" Additional information is required for the following fields: {missing_list}."
        else:
            followup = " A manual review is recommended to confirm whether any additional information or exceptions apply."

    # Combine parts into single explanation string
    explanation = lead + middle + "." + details_clause + rag_clause + followup

    return explanation
