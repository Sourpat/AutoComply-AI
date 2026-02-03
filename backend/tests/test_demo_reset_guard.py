from starlette.testclient import TestClient

from src.api.main import app
from src.config import get_settings


client = TestClient(app)


def test_demo_reset_blocked_in_prod_without_token(monkeypatch) -> None:
    get_settings.cache_clear()
    monkeypatch.setenv("APP_ENV", "prod")
    monkeypatch.setenv("DEV_SEED_TOKEN", "secret")

    response = client.post("/api/demo/reset")
    assert response.status_code == 403
    assert "Demo reset disabled" in response.json().get("detail", "")
    get_settings.cache_clear()


def test_demo_reset_allowed_with_token_in_prod(monkeypatch) -> None:
    get_settings.cache_clear()
    monkeypatch.setenv("APP_ENV", "prod")
    monkeypatch.setenv("DEV_SEED_TOKEN", "secret")

    response = client.post("/api/demo/reset", headers={"X-Dev-Seed-Token": "secret"})
    assert response.status_code == 200
    payload = response.json()
    assert payload.get("ok") is True
    assert payload.get("mode") == "cleared"
    assert "counts" in payload
    get_settings.cache_clear()
