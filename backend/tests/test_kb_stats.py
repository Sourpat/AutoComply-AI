from fastapi.testclient import TestClient

from src.api.main import app


client = TestClient(app)


def test_kb_stats_payload() -> None:
    response = client.get("/api/ops/kb-stats")
    assert response.status_code == 200
    payload = response.json()

    assert "ok" in payload
    assert payload.get("knowledge_version")
