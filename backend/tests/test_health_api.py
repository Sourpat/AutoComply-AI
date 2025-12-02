from fastapi.testclient import TestClient

from src.api.main import app


client = TestClient(app)


def test_health_endpoint_returns_ok() -> None:
    resp = client.get("/health")
    assert resp.status_code == 200

    data = resp.json()
    assert data["status"] == "ok"
    assert data["service"] == "autocomply-ai"
    assert "version" in data
    assert isinstance(data.get("checks", {}), dict)

    checks = data["checks"]
    # Soft checks for known keys
    for key in ["fastapi", "csf_suite", "license_suite", "rag_layer"]:
        assert key in checks
