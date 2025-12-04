from src.autocomply.regulations.knowledge import (
    RegulatoryEvidenceItem,
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

    # Snippet is present and non-empty
    assert first.snippet
