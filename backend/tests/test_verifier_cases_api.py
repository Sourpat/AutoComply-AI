import sqlite3

from fastapi.testclient import TestClient

from src.api.main import app
from src.autocomply.domain import verifier_store


client = TestClient(app)


def test_verifier_cases_schema_exists_after_seed() -> None:
    verifier_store.seed_cases()

    conn = sqlite3.connect(verifier_store.DB_PATH)
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='cases'")
        assert cursor.fetchone() is not None
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='case_events'")
        assert cursor.fetchone() is not None
    finally:
        conn.close()


def test_verifier_cases_list_and_detail() -> None:
    client.post("/api/ops/seed-verifier-cases")

    response = client.get("/api/verifier/cases")
    assert response.status_code == 200
    payload = response.json()
    assert payload["count"] >= 10
    assert len(payload["items"]) >= 10

    detail = client.get("/api/verifier/cases/case-001")
    assert detail.status_code == 200
    detail_payload = detail.json()
    assert detail_payload["case"]["case_id"] == "case-001"
    assert "events" in detail_payload


def test_verifier_case_missing_returns_404() -> None:
    response = client.get("/api/verifier/cases/does-not-exist")
    assert response.status_code == 404
