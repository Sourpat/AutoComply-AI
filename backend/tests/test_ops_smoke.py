from starlette.testclient import TestClient

from src.api.main import app


client = TestClient(app)


def test_ops_smoke_payload() -> None:
    response = client.get("/api/ops/smoke")
    assert response.status_code == 200
    payload = response.json()

    assert "db_ok" in payload
    assert "schema_ok" in payload
    assert "signing_enabled" in payload
    assert "active_contract_present" in payload
    assert "env" in payload
    assert "build_sha" in payload

    assert payload["db_ok"] is True
    assert payload["schema_ok"] is True
    assert payload["missing_tables"] == []
    assert "intelligence_history.trace_id" not in payload.get("missing_columns", [])
