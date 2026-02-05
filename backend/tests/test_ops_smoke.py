import asyncio

from src.api.routes.ops_smoke import ops_smoke


def test_ops_smoke_payload(monkeypatch) -> None:
    monkeypatch.setenv("ENV", "local")
    payload = asyncio.run(ops_smoke())

    assert payload["ok"] is True
    assert payload["checks"]["determinism"] == "ok"
    assert payload["checks"]["replay_diff"] == "ok"
    assert payload["checks"]["idempotency"] == "ok"
    assert payload["checks"]["truth_gate"] == "ok"
    assert payload["db_ok"] is True
    assert payload["schema_ok"] is True
