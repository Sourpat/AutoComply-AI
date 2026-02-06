from __future__ import annotations

import shutil
import threading
from pathlib import Path
from tempfile import mkdtemp

from src.autocomply.domain.explainability.models import ExplainResult
from src.autocomply.domain.explainability.store import init_db, insert_run, list_runs


def _make_result(run_id: str, submission_id: str) -> ExplainResult:
    return ExplainResult(
        run_id=run_id,
        submission_id=submission_id,
        submission_hash=f"hash-{submission_id}",
        policy_version="policy-v1",
        knowledge_version="kb-v1",
        status="approved",  # type: ignore[arg-type]
        risk="low",  # type: ignore[arg-type]
        summary="ok",
        missing_fields=[],
        fired_rules=[],
        citations=[],
        next_steps=[],
        debug={},
    )


def test_idempotency_reuses_run_id() -> None:
    tmp_dir = mkdtemp()
    try:
        db_path = str(Path(tmp_dir) / "runs.sqlite")
        init_db(db_path)

        first = _make_result("run-1", "sub-1")
        second = _make_result("run-2", "sub-1")

        run_id_1 = insert_run(first, db_path=db_path, idempotency_key="key-1")
        run_id_2 = insert_run(second, db_path=db_path, idempotency_key="key-1")

        assert run_id_1 == run_id_2
        runs = list_runs(submission_id="sub-1", limit=10, db_path=db_path)
        assert len(runs) == 1
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


def test_idempotency_threaded_single_row() -> None:
    tmp_dir = mkdtemp()
    try:
        db_path = str(Path(tmp_dir) / "runs.sqlite")
        init_db(db_path)
        results: list[str] = []
        results_lock = threading.Lock()

        def _worker(index: int) -> None:
            result = _make_result(f"run-{index}", "sub-2")
            run_id = insert_run(result, db_path=db_path, idempotency_key="thread-key")
            with results_lock:
                results.append(run_id)

        threads = [threading.Thread(target=_worker, args=(idx,)) for idx in range(5)]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join()

        assert len(set(results)) == 1
        runs = list_runs(submission_id="sub-2", limit=10, db_path=db_path)
        assert len(runs) == 1
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)
