from tests.conftest import client


def test_regulatory_search_returns_results_for_known_terms() -> None:
    # 'hospital' should match csf_hospital_form snippet/title seeded in knowledge
    resp = client.post(
        "/rag/regulatory/search",
        json={"query": "hospital csf"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["query"] == "hospital csf"
    assert "results" in data
    assert isinstance(data["results"], list)
    assert any(
        r.get("id") == "csf_hospital_form" for r in data["results"]
    )


def test_regulatory_search_400_for_empty_query() -> None:
    resp = client.post(
        "/rag/regulatory/search",
        json={"query": "   "},
    )
    assert resp.status_code == 400
