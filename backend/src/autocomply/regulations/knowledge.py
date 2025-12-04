from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, Iterable, List, Optional

from src.api.models.decision import RegulatoryReference


@dataclass
class RegulatoryEvidenceItem:
    """
    A single piece of regulatory evidence used to support a decision.

    This is intentionally separate from the public RegulatoryReference model so we can
    attach extra metadata (snippet, weight, etc.) that does not need to leak to callers.
    """

    reference: RegulatoryReference
    snippet: Optional[str] = None
    raw_source: Optional[Dict[str, Any]] = None


class RegulatoryKnowledge:
    """
    Central registry for regulatory references.

    V1: entirely in-memory + static.
    V2+: can be backed by a vector store or external knowledge base.
    """

    def __init__(self, registry: Dict[str, RegulatoryReference]) -> None:
        self._registry = registry

    def _resolve_references(self, ids: Iterable[str]) -> List[RegulatoryEvidenceItem]:
        items: List[RegulatoryEvidenceItem] = []
        for ref_id in ids:
            ref = self._registry.get(ref_id)
            if ref is None:
                continue
            # For now we do not attach real snippets; that will come with RAG integration.
            items.append(RegulatoryEvidenceItem(reference=ref, snippet=None))
        return items

    def get_regulatory_evidence(
        self,
        *,
        decision_type: Optional[str] = None,
        jurisdiction: Optional[str] = None,
        doc_ids: Optional[Iterable[str]] = None,
        context: Optional[Dict[str, object]] = None,
    ) -> List[RegulatoryEvidenceItem]:
        """
        Return the regulatory evidence items used to support a decision.

        - If doc_ids are provided, they are used as primary keys into the registry.
        - Otherwise, we fall back to a coarse mapping based on decision_type / jurisdiction.
        """
        # Prefer explicit doc_ids if provided.
        if doc_ids:
            return self._resolve_references(doc_ids)

        # Coarse fallback mapping (can be expanded later).
        fallback_ids: List[str] = []

        if decision_type == "license_ohio_tddd":
            fallback_ids.append("ohio-tddd-core")
        elif decision_type == "license_ny_pharmacy":
            fallback_ids.append("ny-pharmacy-core")
        elif decision_type == "csf_hospital":
            fallback_ids.append("csf_hospital_form")
        elif decision_type == "csf_facility":
            fallback_ids.append("csf_facility_form")
        elif decision_type == "csf_practitioner":
            fallback_ids.append("csf_practitioner_form")

        # In case nothing matched, just return an empty list.
        if not fallback_ids:
            return []

        return self._resolve_references(fallback_ids)


# --- Static registry ----------------------------------------------------------

_STATIC_REGISTRY: Dict[str, RegulatoryReference] = {
    "ohio-tddd-core": RegulatoryReference(
        id="ohio-tddd-core",
        jurisdiction="US-OH",
        source="Ohio TDDD Guidance (stub)",
        citation="OH ST § 4729.54",
        label="Ohio TDDD license required and must be active",
    ),
    "ny-pharmacy-core": RegulatoryReference(
        id="ny-pharmacy-core",
        jurisdiction="US-NY",
        source="NY Pharmacy Board (stub)",
        citation=None,
        label="NY pharmacy license required and must be active",
    ),
    "csf_hospital_form": RegulatoryReference(
        id="csf_hospital_form",
        jurisdiction="US-OH",
        source="Hospital CSF (stub)",
        citation=None,
        label="Hospital CSF information required for controlled substances evaluation",
    ),
    "csf_facility_form": RegulatoryReference(
        id="csf_facility_form",
        jurisdiction="US-OH",
        source="Facility CSF (stub)",
        citation=None,
        label="Facility CSF information required for controlled substances evaluation",
    ),
    "csf_practitioner_form": RegulatoryReference(
        id="csf_practitioner_form",
        jurisdiction="US-OH",
        source="Practitioner CSF (stub)",
        citation=None,
        label="Practitioner CSF information required for controlled substances evaluation",
    ),
    # Add more doc IDs here as we expand CSF & other states.
}


_KNOWLEDGE_SINGLETON = RegulatoryKnowledge(registry=_STATIC_REGISTRY)


def get_regulatory_knowledge() -> RegulatoryKnowledge:
    """
    Entry-point used by the rest of the app.

    Having a function indirection here makes it trivial to:
        - swap implementations in tests
        - inject a vector-store-backed version later
    """
    return _KNOWLEDGE_SINGLETON


def build_csf_evidence_from_sources(
    decision_type: str,
    jurisdiction: Optional[str],
    doc_ids: Optional[Iterable[str]],
    rag_sources: Optional[Iterable[Dict[str, Any]]],
) -> List[RegulatoryEvidenceItem]:
    """
    Convenience helper for CSF copilot endpoints.

    - Starts from the stubbed RegulatoryKnowledge (e.g. csf_hospital_form).
    - Augments it with lightweight evidence derived from rag_sources (if present),
      preserving their ids/titles/snippets as RegulatoryEvidenceItem entries.
    """

    knowledge = get_regulatory_knowledge()

    base_items = knowledge.get_regulatory_evidence(
        decision_type=decision_type,
        jurisdiction=jurisdiction,
        doc_ids=doc_ids,
        context=None,
    )

    extra_items: List[RegulatoryEvidenceItem] = []
    for src in rag_sources or []:
        src_id = src.get("id") or "csf_source"
        ref = RegulatoryReference(
            id=str(src_id),
            jurisdiction=jurisdiction,
            source=src.get("title") or "CSF Copilot Source",
            citation=None,
            label=str(src_id),
        )
        extra_items.append(
            RegulatoryEvidenceItem(
                reference=ref,
                snippet=src.get("snippet"),
                raw_source=src,
            )
        )

    return [*base_items, *extra_items]
