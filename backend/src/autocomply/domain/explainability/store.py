from __future__ import annotations

import hashlib
import json
import sqlite3
import threading
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional

from src.autocomply.domain.explainability.models import ExplainResult
from src.utils.logger import get_logger

logger = get_logger("explain_runs_store")


@dataclass(frozen=True)
class ExplainRunRecord:
    run_id: str
    submission_id: str
    submission_hash: str
    policy_version: str
    knowledge_version: str
    status: str
    risk: str
    created_at: str
    payload_json: str
    request_id: Optional[str] = None
    idempotency_key: Optional[str] = None
    run_dedupe_key: Optional[str] = None


_WRITE_LOCK = threading.Lock()


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


def _existing_columns(conn: sqlite3.Connection, table_name: str) -> set[str]:
    rows = conn.execute(f"PRAGMA table_info({table_name})").fetchall()
    return {row[1] for row in rows}


def init_db(db_path: Optional[str] = None) -> None:
    path = _db_path(db_path)
    conn = _connect(path)
    try:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS explain_runs (
                run_id TEXT PRIMARY KEY,
                submission_id TEXT,
                submission_hash TEXT,
                policy_version TEXT,
                knowledge_version TEXT,
                status TEXT,
                risk TEXT,
                created_at TEXT,
                payload_json TEXT,
                request_id TEXT,
                idempotency_key TEXT,
                run_dedupe_key TEXT
            )
            """
        )
        existing = _existing_columns(conn, "explain_runs")
        if "request_id" not in existing:
            conn.execute("ALTER TABLE explain_runs ADD COLUMN request_id TEXT")
        if "idempotency_key" not in existing:
            conn.execute("ALTER TABLE explain_runs ADD COLUMN idempotency_key TEXT")
        if "run_dedupe_key" not in existing:
            conn.execute("ALTER TABLE explain_runs ADD COLUMN run_dedupe_key TEXT")
        conn.execute(
            "CREATE UNIQUE INDEX IF NOT EXISTS idx_explain_runs_dedupe_key ON explain_runs (run_dedupe_key)"
        )
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_explain_runs_submission_id ON explain_runs (submission_id)"
        )
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_explain_runs_submission_hash ON explain_runs (submission_hash)"
        )
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_explain_runs_created_at ON explain_runs (created_at)"
        )
        conn.commit()
    finally:
        conn.close()


def _dedupe_key(
    submission_hash: str,
    policy_version: str,
    knowledge_version: str,
    idempotency_key: str,
) -> str:
    payload = f"{submission_hash}|{policy_version}|{knowledge_version}|{idempotency_key}"
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def insert_run(
    explain_result: ExplainResult,
    db_path: Optional[str] = None,
    request_id: Optional[str] = None,
    idempotency_key: Optional[str] = None,
) -> str:
    init_db(db_path)
    path = _db_path(db_path)
    created_at = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    payload_json = json.dumps(explain_result.model_dump(), default=str)
    safe_idempotency_key = (idempotency_key or "").strip() or None
    run_dedupe_key = (
        _dedupe_key(
            explain_result.submission_hash,
            explain_result.policy_version,
            explain_result.knowledge_version,
            safe_idempotency_key,
        )
        if safe_idempotency_key
        else None
    )

    with _WRITE_LOCK:
        conn = _connect(path)
        try:
            conn.execute(
                """
                INSERT INTO explain_runs (
                    run_id, submission_id, submission_hash, policy_version, knowledge_version,
                    status, risk, created_at, payload_json, request_id, idempotency_key, run_dedupe_key
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    explain_result.run_id,
                    explain_result.submission_id,
                    explain_result.submission_hash,
                    explain_result.policy_version,
                    explain_result.knowledge_version,
                    explain_result.status,
                    explain_result.risk,
                    created_at,
                    payload_json,
                    request_id,
                    safe_idempotency_key,
                    run_dedupe_key,
                ),
            )
            conn.commit()
            return explain_result.run_id
        except sqlite3.IntegrityError:
            if run_dedupe_key:
                row = conn.execute(
                    "SELECT run_id FROM explain_runs WHERE run_dedupe_key = ?",
                    (run_dedupe_key,),
                ).fetchone()
                if row:
                    return str(row[0])
            raise
        finally:
            conn.close()


def _row_to_record(row: sqlite3.Row) -> Dict[str, Any]:
    payload = json.loads(row["payload_json"]) if row["payload_json"] else None
    return {
        "run_id": row["run_id"],
        "submission_id": row["submission_id"],
        "submission_hash": row["submission_hash"],
        "policy_version": row["policy_version"],
        "knowledge_version": row["knowledge_version"],
        "status": row["status"],
        "risk": row["risk"],
        "created_at": row["created_at"],
        "request_id": row["request_id"],
        "idempotency_key": row["idempotency_key"],
        "run_dedupe_key": row["run_dedupe_key"],
        "payload": payload,
        "payload_json": row["payload_json"],
    }


def get_run(run_id: str, db_path: Optional[str] = None) -> Optional[Dict[str, Any]]:
    init_db(db_path)
    path = _db_path(db_path)
    conn = _connect(path)
    try:
        conn.row_factory = sqlite3.Row
        row = conn.execute(
            "SELECT * FROM explain_runs WHERE run_id = ?",
            (run_id,),
        ).fetchone()
        if not row:
            return None
        return _row_to_record(row)
    finally:
        conn.close()


def list_runs(
    submission_id: Optional[str] = None,
    limit: int = 50,
    db_path: Optional[str] = None,
) -> List[Dict[str, Any]]:
    init_db(db_path)
    path = _db_path(db_path)
    conn = _connect(path)
    try:
        conn.row_factory = sqlite3.Row
        if submission_id:
            rows = conn.execute(
                """
                SELECT * FROM explain_runs
                WHERE submission_id = ?
                ORDER BY created_at DESC
                LIMIT ?
                """,
                (submission_id, limit),
            ).fetchall()
        else:
            rows = conn.execute(
                """
                SELECT * FROM explain_runs
                ORDER BY created_at DESC
                LIMIT ?
                """,
                (limit,),
            ).fetchall()
        return [_row_to_record(row) for row in rows]
    finally:
        conn.close()


def list_runs_by_hash(
    submission_hash: str,
    limit: int = 50,
    db_path: Optional[str] = None,
) -> List[Dict[str, Any]]:
    init_db(db_path)
    path = _db_path(db_path)
    conn = _connect(path)
    try:
        conn.row_factory = sqlite3.Row
        rows = conn.execute(
            """
            SELECT * FROM explain_runs
            WHERE submission_hash = ?
            ORDER BY created_at DESC
            LIMIT ?
            """,
            (submission_hash, limit),
        ).fetchall()
        return [_row_to_record(row) for row in rows]
    finally:
        conn.close()


def _diff_set(a_items: Iterable[Dict[str, Any]], b_items: Iterable[Dict[str, Any]], key_fn) -> Dict[str, List[str]]:
    a_keys = {key_fn(item) for item in a_items}
    b_keys = {key_fn(item) for item in b_items}
    added = sorted(b_keys - a_keys)
    removed = sorted(a_keys - b_keys)
    return {"added": added, "removed": removed}


def _diff_value(a_val: Any, b_val: Any) -> Dict[str, Any]:
    return {
        "from": a_val,
        "to": b_val,
        "changed": a_val != b_val,
    }


def diff_explain_runs(run_a: Dict[str, Any], run_b: Dict[str, Any]) -> Dict[str, Any]:
    payload_a = run_a.get("payload") or {}
    payload_b = run_b.get("payload") or {}

    missing_a = payload_a.get("missing_fields", []) or []
    missing_b = payload_b.get("missing_fields", []) or []
    fired_a = payload_a.get("fired_rules", []) or []
    fired_b = payload_b.get("fired_rules", []) or []
    citations_a = payload_a.get("citations", []) or []
    citations_b = payload_b.get("citations", []) or []

    debug_a = payload_a.get("debug", {}) or {}
    debug_b = payload_b.get("debug", {}) or {}
    evidence_a = (debug_a.get("evidence") or {}) if isinstance(debug_a, dict) else {}
    evidence_b = (debug_b.get("evidence") or {}) if isinstance(debug_b, dict) else {}
    retrieval_a = (debug_a.get("retrieval") or {}) if isinstance(debug_a, dict) else {}
    retrieval_b = (debug_b.get("retrieval") or {}) if isinstance(debug_b, dict) else {}

    return {
        "ok": True,
        "run_a": {
            "run_id": run_a.get("run_id"),
            "created_at": run_a.get("created_at"),
            "submission_hash": run_a.get("submission_hash"),
            "policy_version": run_a.get("policy_version"),
            "knowledge_version": run_a.get("knowledge_version"),
        },
        "run_b": {
            "run_id": run_b.get("run_id"),
            "created_at": run_b.get("created_at"),
            "submission_hash": run_b.get("submission_hash"),
            "policy_version": run_b.get("policy_version"),
            "knowledge_version": run_b.get("knowledge_version"),
        },
        "changes": {
            "status": _diff_value(run_a.get("status"), run_b.get("status")),
            "risk": _diff_value(run_a.get("risk"), run_b.get("risk")),
            "submission_hash": _diff_value(run_a.get("submission_hash"), run_b.get("submission_hash")),
            "versions": {
                "policy_version": _diff_value(run_a.get("policy_version"), run_b.get("policy_version")),
                "knowledge_version": _diff_value(run_a.get("knowledge_version"), run_b.get("knowledge_version")),
            },
            "missing_fields": _diff_set(
                missing_a,
                missing_b,
                lambda item: f"{item.get('key','')}:{item.get('category','')}"
            ),
            "fired_rules": _diff_set(
                fired_a,
                fired_b,
                lambda item: str(item.get("id", ""))
            ),
            "citations": _diff_set(
                citations_a,
                citations_b,
                lambda item: f"{item.get('doc_id','')}:{item.get('chunk_id','')}"
            ),
            "debug": {
                "evidence_coverage": _diff_value(
                    evidence_a.get("evidence_coverage"),
                    evidence_b.get("evidence_coverage")
                ),
                "unique_docs": _diff_value(
                    retrieval_a.get("unique_docs"),
                    retrieval_b.get("unique_docs")
                ),
            },
        },
    }