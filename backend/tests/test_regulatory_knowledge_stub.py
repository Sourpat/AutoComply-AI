from src.api.models.decision import RegulatoryReference
from src.autocomply.regulations.knowledge import (
    RegulatoryEvidenceItem,
    build_csf_evidence_from_sources,
    get_regulatory_knowledge,
)


def test_regulatory_knowledge_ohio_tddd_returns_evidence() -> None:
    knowledge = get_regulatory_knowledge()

    evidence = knowledge.get_regulatory_evidence(
        decision_type="license_ohio_tddd",
        jurisdiction="US-OH",
        doc_ids=None,
        context={"license_number": "TDDD-123456"},
    )

    assert isinstance(evidence, list)
    assert evidence, "Expected at least one evidence item for license_ohio_tddd"

    first = evidence[0]
    assert isinstance(first, RegulatoryEvidenceItem)

    ref = first.reference
    assert ref.id == "ohio-tddd-core"
    assert ref.jurisdiction == "US-OH"
    assert ref.label
    assert "Ohio TDDD" in (ref.source or "Ohio TDDD Guidance")

    # Snippet may be populated by future RAG; static knowledge may omit it
    assert first.snippet is None


def test_build_csf_evidence_from_sources_includes_stub() -> None:
    evidence = build_csf_evidence_from_sources(
        decision_type="csf_hospital",
        jurisdiction=None,
        doc_ids=["csf_hospital_form"],
        rag_sources=[],
    )

    assert isinstance(evidence, list)
    for item in evidence:
        assert isinstance(item.reference, RegulatoryReference)


def test_regulatory_knowledge_ny_pharmacy_returns_evidence() -> None:
    knowledge = get_regulatory_knowledge()

    evidence = knowledge.get_regulatory_evidence(
        decision_type="license_ny_pharmacy",
        jurisdiction="US-NY",
        doc_ids=None,
        context={"license_number": "NYPHARM-12345"},
    )

    assert evidence
    ref = evidence[0].reference
    assert ref.id == "ny-pharmacy-core"
    assert ref.jurisdiction == "US-NY"
    assert "pharmacy" in (ref.label or "").lower()
