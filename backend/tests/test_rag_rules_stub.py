from src.rag.knowledge_base import (
    RegulationSnippet,
    list_all_snippets,
    get_snippets_for_jurisdiction,
)
from src.rag.retriever import RegulationRetriever


def test_knowledge_base_has_sample_snippets():
    snippets = list_all_snippets()
    assert snippets
    assert all(isinstance(s, RegulationSnippet) for s in snippets)


def test_get_snippets_for_jurisdiction_filters_correctly():
    ca_snippets = get_snippets_for_jurisdiction("US-CA")
    assert ca_snippets
    assert all(s.jurisdiction == "US-CA" for s in ca_snippets)


def test_regulation_retriever_state_context():
    retriever = RegulationRetriever()

    ca_context = retriever.get_context_for_state("CA")
    assert ca_context
    assert all(s.jurisdiction == "US-CA" for s in ca_context)

    dea_context = retriever.get_dea_baseline_context()
    assert dea_context
    assert any(s.jurisdiction == "US-DEA" for s in dea_context)
