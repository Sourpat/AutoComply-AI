from __future__ import annotations

import hashlib
import json
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

BASE_DIR = Path(__file__).resolve().parents[3]
DATA_DIR = BASE_DIR / ".data"
MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _sanitize_filename(filename: str) -> str:
    name = os.path.basename(filename or "")
    name = name.replace("/", "_").replace("\\", "_")
    return name or "upload.bin"


def _uploads_root() -> Path:
    env_dir = os.getenv("ATTACHMENTS_UPLOAD_DIR")
    if env_dir:
        return Path(env_dir).resolve()
    return DATA_DIR / "uploads"


def _index_file() -> Path:
    return _uploads_root() / "index.json"


def _ensure_dirs(submission_id: str) -> Path:
    uploads_dir = _uploads_root()
    uploads_dir.mkdir(parents=True, exist_ok=True)
    submission_dir = uploads_dir / submission_id
    submission_dir.mkdir(parents=True, exist_ok=True)
    return submission_dir


def _load_index() -> Dict[str, Dict[str, Any]]:
    index_file = _index_file()
    if not index_file.exists():
        return {}
    try:
        return json.loads(index_file.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {}


def _write_index(index: Dict[str, Dict[str, Any]]) -> None:
    index_file = _index_file()
    index_file.write_text(json.dumps(index, indent=2), encoding="utf-8")


def _submission_index_path(submission_id: str) -> Path:
    return _ensure_dirs(submission_id) / "attachments.json"


def _load_submission_index(submission_id: str) -> List[Dict[str, Any]]:
    path = _submission_index_path(submission_id)
    if not path.exists():
        return []
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return []


def _write_submission_index(submission_id: str, records: List[Dict[str, Any]]) -> None:
    path = _submission_index_path(submission_id)
    path.write_text(json.dumps(records, indent=2), encoding="utf-8")


def _resolve_storage_path(storage_path: str) -> Path:
    uploads_root = _uploads_root().resolve()
    candidate = (_uploads_root() / storage_path).resolve()
    if str(candidate).lower().startswith(str(uploads_root).lower()):
        return candidate
    raise ValueError("Invalid storage path")


def save_upload(
    file_bytes: bytes,
    filename: str,
    content_type: Optional[str],
    submission_id: str,
) -> Dict[str, Any]:
    if len(file_bytes) > MAX_ATTACHMENT_BYTES:
        raise ValueError("Attachment too large")

    sanitized = _sanitize_filename(filename)
    attachment_id = str(uuid.uuid4())
    sha256 = hashlib.sha256(file_bytes).hexdigest()

    submission_dir = _ensure_dirs(submission_id)
    storage_name = f"{attachment_id}-{sanitized}"
    storage_path = f"{submission_id}/{storage_name}"
    file_path = submission_dir / storage_name
    file_path.write_bytes(file_bytes)

    record = {
        "attachment_id": attachment_id,
        "submission_id": submission_id,
        "filename": sanitized,
        "content_type": content_type or "application/octet-stream",
        "byte_size": len(file_bytes),
        "sha256": sha256,
        "storage_path": storage_path,
        "created_at": _now_iso(),
    }

    submission_records = _load_submission_index(submission_id)
    submission_records.append(record)
    _write_submission_index(submission_id, submission_records)

    index = _load_index()
    index[attachment_id] = record
    _write_index(index)

    return record


def get_attachment(attachment_id: str) -> Tuple[Dict[str, Any], Path]:
    index = _load_index()
    record = index.get(attachment_id)
    if not record:
        raise FileNotFoundError("Attachment not found")
    storage_path = record.get("storage_path")
    if not storage_path:
        raise FileNotFoundError("Attachment path missing")
    file_path = _resolve_storage_path(storage_path)
    if not file_path.exists():
        raise FileNotFoundError("Attachment file missing")
    return record, file_path


def list_attachments_for_submission(submission_id: str) -> List[Dict[str, Any]]:
    return _load_submission_index(submission_id)
