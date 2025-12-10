from fastapi.testclient import TestClient

from src.api.main import app


client = TestClient(app)


def test_tenant_whoami_uses_default_when_header_missing() -> None:
    resp = client.get("/tenants/whoami")
    assert resp.status_code == 200

    data = resp.json()
    assert data["tenant_id"] == "demo-tenant"
    assert "note" in data
    assert "x-autocomply-tenant-id" in data["note"]


def test_tenant_whoami_respects_header() -> None:
    resp = client.get(
        "/tenants/whoami",
        headers={"x-autocomply-tenant-id": "hs-us-demo"},
    )
    assert resp.status_code == 200

    data = resp.json()
    assert data["tenant_id"] == "hs-us-demo"
