from src.autocomply.regulations.knowledge import get_regulatory_knowledge


def test_get_sources_for_known_ids_returns_sources() -> None:
    knowledge = get_regulatory_knowledge()
    sources = knowledge.get_sources_for_doc_ids(["csf_hospital_form"])
    assert len(sources) == 1
    assert sources[0].id == "csf_hospital_form"


def test_get_context_for_engine_maps_engine_and_type() -> None:
    knowledge = get_regulatory_knowledge()
    sources = knowledge.get_context_for_engine(
        engine_family="csf", decision_type="csf_hospital"
    )
    assert sources
    ids = {s.id for s in sources}
    assert "csf_hospital_form" in ids
