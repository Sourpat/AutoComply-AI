from src.autocomply.regulations.knowledge import (
    get_regulatory_knowledge,
    sources_to_regulatory_references,
)


def test_regulatory_knowledge_returns_sources() -> None:
    knowledge = get_regulatory_knowledge()

    sources = knowledge.get_sources_for_doc_ids(["ohio-tddd-core"])

    assert sources
    assert sources[0].id == "ohio-tddd-core"

    refs = sources_to_regulatory_references(sources)
    assert refs
    assert refs[0].id == "ohio-tddd-core"


def test_regulatory_context_lookup_by_engine_and_type() -> None:
    knowledge = get_regulatory_knowledge()

    sources = knowledge.get_context_for_engine(
        engine_family="csf", decision_type="csf_hospital"
    )

    assert sources
    ids = [src.id for src in sources]
    assert "csf_hospital_form" in ids
