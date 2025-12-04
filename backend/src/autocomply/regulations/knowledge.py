from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, Iterable, List, Optional

from src.api.models.decision import RegulatoryReference


@dataclass
class RegulatoryEvidenceItem:
    """
    A single piece of regulatory 'evidence' the decision engine can rely on.

    This is intentionally RAG-friendly:
    - `reference` is the canonical reference object used across CSF, licenses, and orders.
    - `snippet` / `source_title` / `raw_source` can be backed by vector store hits later.
    """

    reference: RegulatoryReference
    snippet: Optional[str] = None
    source_title: Optional[str] = None
    raw_source: Optional[Dict[str, Any]] = None


class RegulatoryKnowledge:
    """
    Central entrypoint for fetching regulatory evidence.

    This is a stub implementation that returns hard-coded references for now,
    but its interface is designed so we can plug in:
    - a vector store,
    - a RAG pipeline,
    - or other knowledge sources later.
    """

    def get_regulatory_evidence(
        self,
        decision_type: str,
        jurisdiction: Optional[str] = None,
        doc_ids: Optional[List[str]] = None,
        context: Optional[Dict[str, Any]] = None,
    ) -> List[RegulatoryEvidenceItem]:
        """
        Fetch regulatory evidence for the given decision type.

        Parameters:
            decision_type: A string like "license_ohio_tddd", "csf_hospital", etc.
            jurisdiction: An optional jurisdiction code like "US-OH".
            doc_ids: Optional list of document IDs or artifact IDs (e.g. ["csf_hospital_form"]).
            context: Optional extra context (payload snippets, drug schedule, etc.)

        Returns:
            A list of RegulatoryEvidenceItem objects.
        """
        # Simple stub routing for now; this will be replaced by real RAG.
        if decision_type == "license_ohio_tddd":
            return self._ohio_tddd_evidence(jurisdiction=jurisdiction, doc_ids=doc_ids, context=context)

        if decision_type == "csf_hospital":
            return self._csf_hospital_evidence(
                jurisdiction=jurisdiction, doc_ids=doc_ids, context=context
            )

        if decision_type == "csf_facility":
            return self._csf_facility_evidence(
                jurisdiction=jurisdiction, doc_ids=doc_ids, context=context
            )

        if decision_type == "csf_practitioner":
            return self._csf_practitioner_evidence(
                jurisdiction=jurisdiction, doc_ids=doc_ids, context=context
            )

        if decision_type == "license_ny_pharmacy":
            return self._ny_pharmacy_evidence(
                jurisdiction=jurisdiction, doc_ids=doc_ids, context=context
            )

        # Default: no evidence
        return []

    def _ohio_tddd_evidence(
        self,
        jurisdiction: Optional[str],
        doc_ids: Optional[List[str]],
        context: Optional[Dict[str, Any]],
    ) -> List[RegulatoryEvidenceItem]:
        """
        Stub: returns a small set of evidence items for Ohio TDDD decisions.
        """
        jurisdiction = jurisdiction or "US-OH"

        reference = RegulatoryReference(
            id="ohio-tddd-core",
            jurisdiction=jurisdiction,
            source="Ohio TDDD Guidance",
            citation="OH ST § 4729.54",
            label="Ohio TDDD license required for controlled substances",
        )

        snippet = (
            "Ohio TDDD licenses are required for entities that purchase, store, or "
            "sell dangerous drugs within the state. The license must be active and "
            "match the facility type and scope of practice."
        )

        evidence = RegulatoryEvidenceItem(
            reference=reference,
            snippet=snippet,
            source_title="Ohio TDDD Licensing Requirements (stub)",
            raw_source={
                "doc_id": "ohio_tddd_stub",
                "url": None,
            },
        )

        return [evidence]

    def _csf_hospital_evidence(
        self,
        jurisdiction: Optional[str],
        doc_ids: Optional[List[str]],
        context: Optional[Dict[str, Any]],
    ) -> List[RegulatoryEvidenceItem]:
        jurisdiction = jurisdiction or "US-OH"
        reference = RegulatoryReference(
            id="csf_hospital_form",
            jurisdiction=jurisdiction,
            source="Hospital CSF (stub)",
            citation=None,
            label="Hospital CSF information required for controlled substances evaluation",
        )
        snippet = "Hospital CSF forms capture facility, DEA, and license info required to evaluate controlled substance orders."
        return [
            RegulatoryEvidenceItem(
                reference=reference,
                snippet=snippet,
                source_title="Hospital CSF Requirements (stub)",
                raw_source={"doc_id": "csf_hospital_form"},
            )
        ]

    def _ny_pharmacy_evidence(
        self,
        jurisdiction: Optional[str],
        doc_ids: Optional[List[str]],
        context: Optional[Dict[str, Any]],
    ) -> List[RegulatoryEvidenceItem]:
        """
        Stub: returns a small set of evidence items for NY Pharmacy license decisions.
        """
        jurisdiction = jurisdiction or "US-NY"

        reference = RegulatoryReference(
            id="ny-pharmacy-core",
            jurisdiction=jurisdiction,
            source="NY Pharmacy Board (stub)",
            citation=None,
            label="NY pharmacy license required for dispensing controlled substances",
        )

        snippet = (
            "New York pharmacy licenses must be active and associated with the "
            "dispensing location to handle controlled substances in the state."
        )

        evidence = RegulatoryEvidenceItem(
            reference=reference,
            snippet=snippet,
            source_title="NY Pharmacy Licensing Requirements (stub)",
            raw_source={
                "doc_id": "ny_pharmacy_stub",
                "url": None,
            },
        )

        return [evidence]

    def _csf_facility_evidence(
        self,
        jurisdiction: Optional[str],
        doc_ids: Optional[List[str]],
        context: Optional[Dict[str, Any]],
    ) -> List[RegulatoryEvidenceItem]:
        jurisdiction = jurisdiction or "US-OH"
        reference = RegulatoryReference(
            id="csf_facility_form",
            jurisdiction=jurisdiction,
            source="Facility CSF (stub)",
            citation=None,
            label="Facility CSF information required for controlled substances evaluation",
        )
        snippet = "Facility CSF forms ensure non-hospital facilities record appropriate licensing and DEA details."
        return [
            RegulatoryEvidenceItem(
                reference=reference,
                snippet=snippet,
                source_title="Facility CSF Requirements (stub)",
                raw_source={"doc_id": "csf_facility_form"},
            )
        ]

    def _csf_practitioner_evidence(
        self,
        jurisdiction: Optional[str],
        doc_ids: Optional[List[str]],
        context: Optional[Dict[str, Any]],
    ) -> List[RegulatoryEvidenceItem]:
        jurisdiction = jurisdiction or "US-OH"
        reference = RegulatoryReference(
            id="csf_practitioner_form",
            jurisdiction=jurisdiction,
            source="Practitioner CSF (stub)",
            citation=None,
            label="Practitioner CSF information required for controlled substances evaluation",
        )
        snippet = "Practitioner CSF forms capture prescriber identity, DEA registration, and practice location required for compliance."
        return [
            RegulatoryEvidenceItem(
                reference=reference,
                snippet=snippet,
                source_title="Practitioner CSF Requirements (stub)",
                raw_source={"doc_id": "csf_practitioner_form"},
            )
        ]


# Singleton-style accessor (easy to swap with DI later if needed)
_default_knowledge = RegulatoryKnowledge()


def get_regulatory_knowledge() -> RegulatoryKnowledge:
    return _default_knowledge


def build_csf_evidence_from_sources(
    decision_type: str,
    jurisdiction: Optional[str],
    doc_ids: Optional[List[str]],
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
                source_title=src.get("title"),
                raw_source=src,
            )
        )

    return [*base_items, *extra_items]
