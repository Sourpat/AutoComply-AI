from starlette.testclient import TestClient
from sqlalchemy.exc import SQLAlchemyError

from src.api.main import app
from src.config import get_settings
from src.api.routes import admin_review


client = TestClient(app)


def test_admin_review_queue_safe_empty_when_schema_missing(monkeypatch) -> None:
    def _raise(*args, **kwargs):
        raise SQLAlchemyError("no such table: review_queue_items")

    monkeypatch.setattr(admin_review.ReviewQueueService, "get_queue_items", _raise)
    monkeypatch.delenv("DEV_SEED_TOKEN", raising=False)
    get_settings.cache_clear()

    response = client.get(
        "/api/v1/admin/review-queue/items?limit=1",
        headers={"X-User-Role": "admin"},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["items"] == []
    assert payload["total"] == 0
    assert payload["note"] == "review queue not initialized"
