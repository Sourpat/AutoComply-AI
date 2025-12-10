from __future__ import annotations

import re
from typing import Dict, Iterable, List

from src.api.models.compliance_models import RegulatorySource
from src.api.models.decision import RegulatoryReference


class RegulatoryKnowledge:
    """
    Central registry for regulatory snippets used by CSF, license, and RAG endpoints.

    Initial implementation is in-memory and static, but the interface is designed so it
    can later be backed by a vector store or external RAG service.
    """

    def __init__(self) -> None:
        # Keyed primarily by document id, which matches existing regulatory_references IDs.
        self._sources_by_id: Dict[str, RegulatorySource] = {}

        self._seed_static_sources()

    def _seed_static_sources(self) -> None:
        # NOTE: Use the same IDs already used in tests and domain code, e.g. "csf_hospital_form".
        self._add(
            RegulatorySource(
                id="csf_hospital_form",
                title="Hospital CSF – core requirements",
                snippet="Core rules and attestations for hospital CSF evaluations.",
                jurisdiction="OH",
                citation=None,
            )
        )
        self._add(
            RegulatorySource(
                id="csf_facility_form",
                title="Facility CSF – core requirements",
                snippet="Guidance and required fields for facility CSF evaluations.",
                jurisdiction="OH",
                citation=None,
            )
        )
        self._add(
            RegulatorySource(
                id="csf_practitioner_form",
                title="Practitioner CSF – core requirements",
                snippet="Practitioner-specific CSF requirements and attestations.",
                jurisdiction="US",
                citation=None,
            )
        )
        self._add(
            RegulatorySource(
                id="csf_ems_form",
                title="EMS CSF",
                snippet="EMS-specific CSF requirements and attestations.",
                jurisdiction="US",
                citation=None,
            )
        )
        self._add(
            RegulatorySource(
                id="csf_researcher_form",
                title="Researcher CSF",
                snippet="Researcher CSF requirements and attestations.",
                jurisdiction="US",
                citation=None,
            )
        )
        self._add(
            RegulatorySource(
                id="ohio-tddd-core",
                title="Ohio TDDD License Rules",
                snippet="Ohio TDDD licensing requirements, including expiry and ship-to restrictions.",
                jurisdiction="US-OH",
                citation=None,
            )
        )
        self._add(
            RegulatorySource(
                id="ohio_tddd_rules",
                title="Ohio TDDD License Rules",
                snippet="Ohio TDDD licensing requirements, including expiry and ship-to restrictions.",
                jurisdiction="US-OH",
                citation=None,
            )
        )
        self._add(
            RegulatorySource(
                id="ny-pharmacy-core",
                title="NY pharmacy license required and must be active",
                snippet="NY pharmacy licensing standards, including state-specific dispensing rules.",
                jurisdiction="NY",
                citation=None,
            )
        )
        self._add(
            RegulatorySource(
                id="ny_pharmacy_core",
                title="NY pharmacy license required and must be active",
                snippet="NY pharmacy licensing standards, including state-specific dispensing rules.",
                jurisdiction="NY",
                citation=None,
            )
        )
        self._add(
            RegulatorySource(
                id="ny_pharmacy_rules",
                title="NY pharmacy license required and must be active",
                snippet="NY pharmacy licensing standards, including state-specific dispensing rules.",
                jurisdiction="NY",
                citation=None,
            )
        )

    def _add(self, source: RegulatorySource) -> None:
        self._sources_by_id[source.id] = source

    def get_sources_for_doc_ids(self, doc_ids: Iterable[str]) -> List[RegulatorySource]:
        ids = list(doc_ids)
        return [self._sources_by_id[i] for i in ids if i in self._sources_by_id]

    def search_sources(
        self,
        query: str,
        limit: int = 5,
    ) -> list[RegulatorySource]:
        """
        Very simple lexical search over title + snippet.

        This is intentionally minimal but provides a clear hook
        that can later be backed by a vector store / embeddings.
        """
        q = query.strip().lower()
        if not q:
            return []

        terms = [t for t in re.split(r"\s+", q) if t]
        if not terms:
            return []

        def score(source: RegulatorySource) -> int:
            haystack = f"{getattr(source, 'title', '')} {getattr(source, 'snippet', '')}".lower()
            s = 0
            for t in terms:
                if t in haystack:
                    s += 1
            return s

        scored = [
            (score(src), src)
            for src in self._sources_by_id.values()
        ]

        # Keep only positive-score hits and sort descending
        scored = [pair for pair in scored if pair[0] > 0]
        scored.sort(key=lambda pair: pair[0], reverse=True)

        return [src for _, src in scored[:limit]]

    def get_context_for_engine(
        self, *, engine_family: str, decision_type: str
    ) -> List[RegulatorySource]:
        """
        Convenience method used by RAG endpoints. Maps engine/decision types
        to one or more document ids, then returns the associated sources.
        """
        key = f"{engine_family}:{decision_type}"

        # Keep this mapping small and explicit for now.
        mapping: Dict[str, List[str]] = {
            "csf:csf_hospital": ["csf_hospital_form"],
            "csf:csf_facility": ["csf_facility_form"],
            "csf:csf_practitioner": ["csf_practitioner_form"],
            "csf:csf_ems": ["csf_ems_form"],
            "csf:csf_researcher": ["csf_researcher_form"],
            "license:license_ohio_tddd": ["ohio_tddd_rules", "ohio-tddd-core"],
            "license:license_ny_pharmacy": [
                "ny_pharmacy_core",
                "ny-pharmacy-core",
            ],
        }

        doc_ids = mapping.get(key, [])
        return self.get_sources_for_doc_ids(doc_ids)


# Singleton-style accessor to avoid repeated construction.
_GLOBAL_REGULATORY_KNOWLEDGE: RegulatoryKnowledge | None = None


def get_regulatory_knowledge() -> RegulatoryKnowledge:
    global _GLOBAL_REGULATORY_KNOWLEDGE
    if _GLOBAL_REGULATORY_KNOWLEDGE is None:
        _GLOBAL_REGULATORY_KNOWLEDGE = RegulatoryKnowledge()
    return _GLOBAL_REGULATORY_KNOWLEDGE


def sources_to_regulatory_references(
    sources: Iterable[RegulatorySource],
) -> List[RegulatoryReference]:
    """Helper to mirror legacy RegulatoryReference objects from sources."""

    references: List[RegulatoryReference] = []
    for src in sources:
        references.append(
            RegulatoryReference(
                id=src.id or "",
                jurisdiction=src.jurisdiction,
                source=src.title,
                citation=getattr(src, "citation", None),
                label=src.title or (src.id or ""),
            )
        )
    return references
