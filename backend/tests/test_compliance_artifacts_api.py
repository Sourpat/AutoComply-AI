from fastapi.testclient import TestClient

from src.api.main import app

client = TestClient(app)


def test_list_compliance_artifacts_includes_ohio_and_csf():
    resp = client.get("/compliance/artifacts")
    assert resp.status_code == 200

    data = resp.json()
    ids = {item["id"] for item in data}

    assert "ohio_tddd" in ids
    assert "csf_practitioner" in ids

    ohio = next(item for item in data if item["id"] == "ohio_tddd")
    assert ohio["engine_status"] == "full_loop"
    assert "Ohio TDDD" in ohio["name"]
