from __future__ import annotations

import shutil
import time
from pathlib import Path
from tempfile import mkdtemp

from src.autocomply.domain.explainability.models import ExplainResult
from src.autocomply.domain.explainability.store import get_run, init_db, insert_run, list_runs


def _make_result(run_id: str, submission_id: str, status: str) -> ExplainResult:
    return ExplainResult(
        run_id=run_id,
        submission_id=submission_id,
        submission_hash=f"hash-{submission_id}",
        policy_version="policy-v1",
        knowledge_version="kb-v1",
        status=status,  # type: ignore[arg-type]
        risk="low",  # type: ignore[arg-type]
        summary="ok",
        missing_fields=[],
        fired_rules=[],
        citations=[],
        next_steps=[],
        debug={},
    )


def test_insert_and_get_run_roundtrip():
    tmp_dir = mkdtemp()
    try:
        db_path = str(Path(tmp_dir) / "runs.sqlite")
        init_db(db_path)
        result = _make_result("run-1", "sub-1", "approved")
        insert_run(result, db_path=db_path)

        stored = get_run("run-1", db_path=db_path)
        assert stored is not None
        assert stored["run_id"] == "run-1"
        assert stored["submission_id"] == "sub-1"
        assert stored["payload"]["run_id"] == "run-1"
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


def test_list_runs_newest_first():
    tmp_dir = mkdtemp()
    try:
        db_path = str(Path(tmp_dir) / "runs.sqlite")
        init_db(db_path)
        insert_run(_make_result("run-1", "sub-2", "approved"), db_path=db_path)
        time.sleep(0.01)
        insert_run(_make_result("run-2", "sub-2", "approved"), db_path=db_path)

        runs = list_runs(submission_id="sub-2", limit=10, db_path=db_path)
        assert len(runs) == 2
        assert runs[0]["run_id"] == "run-2"
        assert runs[1]["run_id"] == "run-1"
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)
