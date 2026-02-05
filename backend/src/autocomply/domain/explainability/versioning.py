from __future__ import annotations

import hashlib
import json
from typing import Any, Dict

from src.autocomply.domain.submissions.canonical import CanonicalSubmission

POLICY_VERSION = "explainability-policy-v1"
KNOWLEDGE_VERSION = "regulatory-knowledge-static-v1"


def get_policy_version() -> str:
    return POLICY_VERSION


def get_knowledge_version() -> str:
    return KNOWLEDGE_VERSION


def hash_canonical_submission(canonical: CanonicalSubmission) -> str:
    payload: Dict[str, Any] = canonical.model_dump(exclude={"raw"}, exclude_none=True)
    encoded = json.dumps(payload, sort_keys=True, default=str).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def make_run_id(submission_hash: str) -> str:
    return f"exp-v1-{submission_hash[:12]}"
