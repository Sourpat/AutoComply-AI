from fastapi.testclient import TestClient

from src.api.main import app

client = TestClient(app)


def test_assignment_and_assignee_filter() -> None:
    client.post("/api/ops/seed-verifier-cases")

    assign_resp = client.patch(
        "/api/verifier/cases/case-001/assignment",
        json={"assignee": "verifier-1", "actor": "qa"},
    )
    assert assign_resp.status_code == 200
    assert assign_resp.json()["assignee"] == "verifier-1"

    list_resp = client.get("/api/verifier/cases?assignee=verifier-1")
    assert list_resp.status_code == 200
    items = list_resp.json()["items"]
    assert any(item["case_id"] == "case-001" for item in items)

    list_me = client.get("/api/verifier/cases?assignee=me")
    assert list_me.status_code == 200
    items_me = list_me.json()["items"]
    assert any(item["case_id"] == "case-001" for item in items_me)

    events_resp = client.get("/api/verifier/cases/case-001/events")
    assert events_resp.status_code == 200
    assert events_resp.json()[0]["event_type"] in {"assigned", "unassigned"}


def test_bulk_assign_and_action() -> None:
    client.post("/api/ops/seed-verifier-cases")

    bulk_assign = client.post(
        "/api/verifier/cases/bulk/assign",
        json={"case_ids": ["case-001", "case-002", "missing"], "assignee": "verifier-1"},
    )
    assert bulk_assign.status_code == 200
    payload = bulk_assign.json()
    assert payload["updated_count"] == 2
    assert any(item["case_id"] == "missing" for item in payload["failures"])

    bulk_action = client.post(
        "/api/verifier/cases/bulk/actions",
        json={"case_ids": ["case-001", "case-002"], "action": "needs_review"},
    )
    assert bulk_action.status_code == 200
    assert bulk_action.json()["updated_count"] == 2

    detail = client.get("/api/verifier/cases/case-002")
    assert detail.status_code == 200
    assert detail.json()["case"]["status"] == "pending_review"

    events_resp = client.get("/api/verifier/cases/case-002/events")
    assert events_resp.status_code == 200
    assert events_resp.json()[0]["event_type"] == "action"
