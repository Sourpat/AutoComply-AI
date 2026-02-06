from __future__ import annotations

from src.autocomply.domain.evidence import pack_retriever


def test_pack_loads() -> None:
    payload = pack_retriever.load_pack(pack_retriever.get_pack_path())
    assert payload.get("version") == "kp-v1"
    docs = payload.get("docs")
    assert isinstance(docs, list)
    assert len(docs) >= 1


def test_pack_retriever_ordering_is_deterministic() -> None:
    query = "Ohio TDDD requirement hospital schedule II controlled substances"
    results = pack_retriever.retrieve(query=query, jurisdiction="OH", top_k=2)
    assert len(results) == 2
    assert results[0].doc_id == "oh-tddd-overview"
    assert results[1].doc_id == "oh-tddd-certificate"


def test_pack_retriever_jurisdiction_filtering() -> None:
    query = "new york pharmacy controlled substances"
    results = pack_retriever.retrieve(query=query, jurisdiction="OH", top_k=5)
    assert all(result.doc_id != "ny-pharmacy-licensure" for result in results)
