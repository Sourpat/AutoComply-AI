from starlette.testclient import TestClient

from src.api.main import app
from src.config import get_settings


client = TestClient(app)


def _refresh_settings() -> None:
    get_settings.cache_clear()


def test_chat_alias_health_endpoint() -> None:
    response = client.get("/api/chat/health")
    assert response.status_code == 200
    payload = response.json()
    assert payload.get("ok") is True
    assert payload.get("route") == "chat"


def test_chat_alias_post_is_not_404() -> None:
    response = client.post("/api/chat/ask")
    assert response.status_code == 422


def test_chat_v1_post_is_not_404() -> None:
    response = client.post("/api/v1/chat/ask")
    assert response.status_code == 422


def test_chat_alias_post_returns_200_with_minimal_payload(monkeypatch) -> None:
    monkeypatch.setenv("RAG_ENABLED", "false")
    _refresh_settings()

    response = client.post("/api/chat/ask", json={"question": "What is a Schedule II drug?"})

    assert response.status_code == 200
    payload = response.json()
    assert "answer" in payload
    assert "decision_trace" in payload
