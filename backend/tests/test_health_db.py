from starlette.testclient import TestClient

from src.api.main import app


client = TestClient(app)


def test_health_db_ok() -> None:
    response = client.get("/health/db")
    assert response.status_code == 200
    payload = response.json()
    assert payload["ok"] is True
    assert payload["missing_tables"] == []
    assert payload["missing_columns"] == []
