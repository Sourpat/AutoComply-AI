import os

from starlette.testclient import TestClient

from src.api.main import app
from src.config import get_settings
from src.api.dependencies import auth


client = TestClient(app)


def _refresh_settings() -> None:
    get_settings.cache_clear()


def test_review_queue_missing_headers_forbidden(monkeypatch) -> None:
    monkeypatch.setenv("DEV_SEED_TOKEN", "local_dev_token")
    _refresh_settings()

    response = client.get("/api/v1/admin/review-queue/items?limit=1")

    assert response.status_code == 403
    assert response.json().get("detail") == "forbidden: missing role header"


def test_review_queue_allows_role_with_dev_seed(monkeypatch) -> None:
    monkeypatch.setenv("DEV_SEED_TOKEN", "local_dev_token")
    _refresh_settings()

    response = client.get(
        "/api/v1/admin/review-queue/items?limit=1",
        headers={
            auth.ROLE_HEADER: "admin",
            auth.DEV_SEED_HEADER: "local_dev_token",
        },
    )

    assert response.status_code == 200
