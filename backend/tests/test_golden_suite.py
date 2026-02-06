import asyncio
import os

from src.autocomply.domain.explainability.golden_runner import run_golden_suite


def test_golden_suite() -> None:
    payload = asyncio.run(run_golden_suite())

    assert payload["ok"] is True
    assert payload["failed"] == 0
    assert payload["total"] >= 7

    env = os.getenv("ENV", "local").lower()
    mode = os.getenv("KNOWLEDGE_MODE", "").lower()
    if env == "ci" or mode == "pack":
        for case in payload.get("cases", []):
            assert case.get("knowledge_version") == "kp-v1"
