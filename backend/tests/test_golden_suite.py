import asyncio

from src.autocomply.domain.explainability.golden_runner import run_golden_suite


def test_golden_suite() -> None:
    payload = asyncio.run(run_golden_suite())

    assert payload["ok"] is True
    assert payload["failed"] == 0
    assert payload["total"] >= 6
