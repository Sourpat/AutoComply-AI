import pytest
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


def test_health_basic_ok() -> None:
    resp = client.get("/health")
    assert resp.status_code == 200
    body = resp.json()
    # minimal contract: there is a status, and it's "ok" in a healthy system
    assert "status" in body
    assert body["status"] == "ok"


def test_health_full_includes_components() -> None:
    resp = client.get("/health/full")
    assert resp.status_code == 200
    body = resp.json()

    # top-level status plus components bag
    assert "status" in body
    assert "components" in body
    assert isinstance(body["components"], dict)

    components = body["components"]

    # These keys should match what you configured in health_full()
    for key in ["csf_engine", "license_engine", "mock_orders"]:
        assert key in components
        assert "status" in components[key]
        # Status is a simple string like "ok" / "degraded" / "error"
        assert isinstance(components[key]["status"], str)
