from __future__ import annotations

import os
import sqlite3
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, Optional

from src.autocomply.domain.explainability.store import init_db
from src.utils.logger import get_logger

logger = get_logger("explain_runs_maintenance")


def _backend_root() -> Path:
    return Path(__file__).resolve().parents[5]


def _db_path(default: Optional[str] = None) -> str:
    if default:
        return default
    data_dir = _backend_root() / ".data"
    data_dir.mkdir(parents=True, exist_ok=True)
    return str(data_dir / "explain_runs.sqlite")


def _connect(path: str) -> sqlite3.Connection:
    conn = sqlite3.connect(path, check_same_thread=False, timeout=5.0)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA synchronous=NORMAL")
    conn.execute("PRAGMA busy_timeout=5000")
    return conn


def get_explain_db_path(default: Optional[str] = None) -> str:
    return _db_path(default)


def prune_runs(
    max_age_days: int,
    max_rows: int,
    db_path: Optional[str] = None,
) -> Dict[str, Any]:
    deleted_rows = 0
    remaining_rows = 0
    try:
        init_db(db_path)
        path = _db_path(db_path)
        conn = _connect(path)
        try:
            if max_age_days and max_age_days > 0:
                threshold = (datetime.now(timezone.utc) - timedelta(days=max_age_days))
                threshold_str = threshold.isoformat().replace("+00:00", "Z")
                cursor = conn.execute(
                    "DELETE FROM explain_runs WHERE created_at < ?",
                    (threshold_str,),
                )
                deleted_rows += cursor.rowcount or 0

            if max_rows and max_rows > 0:
                total = conn.execute("SELECT COUNT(*) FROM explain_runs").fetchone()[0]
                if total > max_rows:
                    to_delete = total - max_rows
                    cursor = conn.execute(
                        """
                        DELETE FROM explain_runs
                        WHERE run_id IN (
                            SELECT run_id FROM explain_runs
                            ORDER BY created_at ASC
                            LIMIT ?
                        )
                        """,
                        (to_delete,),
                    )
                    deleted_rows += cursor.rowcount or 0

            remaining_rows = conn.execute("SELECT COUNT(*) FROM explain_runs").fetchone()[0]
            conn.commit()
        finally:
            conn.close()
    except Exception as exc:
        logger.exception("Explain run prune failed", exc_info=exc)
        return {"deleted_rows": 0, "remaining_rows": 0}

    return {"deleted_rows": deleted_rows, "remaining_rows": remaining_rows}


def vacuum_if_needed(
    min_deleted_rows: int,
    db_path: Optional[str] = None,
) -> bool:
    try:
        init_db(db_path)
        path = _db_path(db_path)
        conn = _connect(path)
        try:
            freelist_count = conn.execute("PRAGMA freelist_count").fetchone()[0]
            if freelist_count < min_deleted_rows:
                return False
            conn.execute("VACUUM")
            return True
        finally:
            conn.close()
    except Exception as exc:
        logger.exception("Explain run vacuum failed", exc_info=exc)
        return False


def explain_db_size_mb(db_path: Optional[str] = None) -> float:
    path = _db_path(db_path)
    if not os.path.exists(path):
        return 0.0
    return os.path.getsize(path) / (1024 * 1024)


def count_runs(db_path: Optional[str] = None) -> int:
    try:
        init_db(db_path)
        path = _db_path(db_path)
        conn = _connect(path)
        try:
            return int(conn.execute("SELECT COUNT(*) FROM explain_runs").fetchone()[0])
        finally:
            conn.close()
    except Exception as exc:
        logger.exception("Explain run count failed", exc_info=exc)
        return 0
