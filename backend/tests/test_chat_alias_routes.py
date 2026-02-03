from starlette.testclient import TestClient

from src.api.main import app


client = TestClient(app)


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
