from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict

BASE_DIR = Path(__file__).resolve().parents[3]
DATA_DIR = BASE_DIR / ".data"
OUTBOX_PATH = DATA_DIR / "email_outbox.jsonl"


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def enqueue_email(event: Dict[str, Any]) -> None:
    env_marker = os.getenv("ENV", "").lower()
    app_env = os.getenv("APP_ENV", "dev").lower()
    if env_marker not in {"dev", "ci"} and app_env not in {"dev", "ci"}:
        return

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    record = {
        "queued_at": _now_iso(),
        "event": event,
    }
    with OUTBOX_PATH.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(record) + "\n")
