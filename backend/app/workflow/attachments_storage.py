import hashlib
import os
import re
from pathlib import Path
from typing import Tuple


ALLOWED_CONTENT_TYPES = {
    "application/pdf",
    "image/jpeg",
    "image/png",
}
MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024  # 10 MB


def get_upload_base_dir() -> Path:
    """Return base directory for attachments uploads."""
    env_dir = os.getenv("ATTACHMENTS_UPLOAD_DIR")
    if env_dir:
        return Path(env_dir)
    return Path(__file__).resolve().parent.parent / "data" / "uploads"


def safe_filename(filename: str) -> str:
    """Sanitize filename to prevent path traversal and unsafe chars."""
    base = os.path.basename(filename)
    base = base.strip().replace("\x00", "")
    name, ext = os.path.splitext(base)
    name = re.sub(r"[^a-zA-Z0-9._-]+", "_", name).strip("._")
    ext = re.sub(r"[^a-zA-Z0-9._-]+", "", ext)
    if not name:
        name = "file"
    return f"{name}{ext}"


def validate_upload(content_type: str, size_bytes: int) -> None:
    if content_type not in ALLOWED_CONTENT_TYPES:
        raise ValueError("Unsupported file type")
    if size_bytes > MAX_FILE_SIZE_BYTES:
        raise ValueError("File too large")


def compute_sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def save_upload(case_id: str, original_filename: str, content_type: str, data: bytes) -> Tuple[str, str]:
    """Save attachment to disk and return (relative_path, sha256)."""
    size_bytes = len(data)
    validate_upload(content_type, size_bytes)

    base_dir = get_upload_base_dir()
    case_dir = base_dir / case_id
    case_dir.mkdir(parents=True, exist_ok=True)

    safe_name = safe_filename(original_filename)
    file_id = compute_sha256(f"{case_id}:{safe_name}:{size_bytes}:{os.urandom(8).hex()}".encode("utf-8"))[:16]
    filename = f"{file_id}_{safe_name}"

    rel_path = Path(case_id) / filename
    abs_path = base_dir / rel_path

    with open(abs_path, "wb") as f:
        f.write(data)

    sha256 = compute_sha256(data)
    return str(rel_path), sha256


def resolve_storage_path(storage_path: str) -> Path:
    """Resolve a storage path under uploads directory safely."""
    base_dir = get_upload_base_dir().resolve()
    abs_path = (base_dir / storage_path).resolve()
    if not str(abs_path).startswith(str(base_dir)):
        raise ValueError("Invalid storage path")
    return abs_path
