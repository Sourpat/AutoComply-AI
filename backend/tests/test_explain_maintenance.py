from __future__ import annotations

import shutil
from pathlib import Path
from tempfile import mkdtemp

from src.autocomply.domain.explainability.maintenance import prune_runs, vacuum_if_needed
from src.autocomply.domain.explainability.models import ExplainResult
from src.autocomply.domain.explainability.store import init_db, insert_run


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


def test_prune_runs_max_rows() -> None:
    tmp_dir = mkdtemp()
    try:
        db_path = str(Path(tmp_dir) / "runs.sqlite")
        init_db(db_path)
        for idx in range(5):
            insert_run(_make_result(f"run-{idx}", "sub-1"), db_path=db_path)

        result = prune_runs(max_age_days=0, max_rows=2, db_path=db_path)
        assert result["remaining_rows"] == 2
        assert result["deleted_rows"] >= 3
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


def test_vacuum_if_needed_threshold() -> None:
    tmp_dir = mkdtemp()
    try:
        db_path = str(Path(tmp_dir) / "runs.sqlite")
        init_db(db_path)
        vacuum_ran = vacuum_if_needed(min_deleted_rows=9999, db_path=db_path)
        assert vacuum_ran is False
        vacuum_ran = vacuum_if_needed(min_deleted_rows=0, db_path=db_path)
        assert vacuum_ran is True
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)
