from __future__ import annotations

import json
import os
import re
from functools import lru_cache
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple

from src.autocomply.domain.explainability.models import Citation

PACK_VERSION = "kp-v1"


def is_pack_mode() -> bool:
    env = os.getenv("ENV", "local").lower()
    mode = os.getenv("KNOWLEDGE_MODE", "").lower()
    return env == "ci" or mode == "pack"


def get_pack_path() -> Path:
    return Path(__file__).resolve().parents[5] / "knowledge_packs" / "v1" / "pack.json"


@lru_cache(maxsize=4)
def load_pack(path: str | Path) -> Dict[str, Any]:
    pack_path = Path(path)
    with pack_path.open("r", encoding="utf-8") as handle:
        payload = json.load(handle)
    return payload if isinstance(payload, dict) else {}


def _tokenize(text: str) -> set[str]:
    return set(re.findall(r"[a-z0-9]+", text.lower()))


def _jurisdiction_match(doc_jurisdiction: Optional[str], jurisdiction: Optional[str]) -> bool:
    if not jurisdiction:
        return True
    if not doc_jurisdiction:
        return False
    doc_value = doc_jurisdiction.lower()
    if doc_value == "us":
        return True
    return jurisdiction.lower() in doc_value


def _jurisdiction_boost(doc_jurisdiction: Optional[str], jurisdiction: Optional[str]) -> int:
    if not jurisdiction:
        return 0
    if not doc_jurisdiction:
        return 0
    return 2 if doc_jurisdiction.lower() == jurisdiction.lower() else 0


def _build_citation(
    doc: Dict[str, Any],
    chunk: Dict[str, Any],
    score: int,
) -> Citation:
    return Citation(
        doc_id=str(doc.get("doc_id", "")),
        chunk_id=str(chunk.get("chunk_id", "")),
        snippet=str(chunk.get("text", "")),
        jurisdiction=doc.get("jurisdiction"),
        confidence=float(score),
        source_title=doc.get("title"),
        url=doc.get("url"),
    )


def retrieve(
    query: str,
    jurisdiction: Optional[str],
    top_k: int = 4,
    path: str | Path | None = None,
) -> List[Citation]:
    q = query.strip()
    if not q:
        return []

    payload = load_pack(path or get_pack_path())
    docs: Iterable[Dict[str, Any]] = payload.get("docs", []) if isinstance(payload, dict) else []
    query_tokens = _tokenize(q)
    scored: List[Tuple[int, str, str, Citation]] = []

    for doc in docs:
        if not isinstance(doc, dict):
            continue
        doc_id = str(doc.get("doc_id", ""))
        doc_jurisdiction = doc.get("jurisdiction")
        if not _jurisdiction_match(doc_jurisdiction, jurisdiction):
            continue
        doc_title = str(doc.get("title", ""))
        doc_tags = doc.get("tags", [])
        tag_text = " ".join(doc_tags) if isinstance(doc_tags, list) else str(doc_tags)
        base_tokens = _tokenize(f"{doc_title} {tag_text}")
        boost = _jurisdiction_boost(doc_jurisdiction, jurisdiction)

        chunks = doc.get("chunks", [])
        for chunk in chunks if isinstance(chunks, list) else []:
            if not isinstance(chunk, dict):
                continue
            chunk_text = str(chunk.get("text", ""))
            tokens = base_tokens | _tokenize(chunk_text)
            overlap = len(query_tokens & tokens)
            score = overlap + boost
            if score <= 0:
                continue
            citation = _build_citation(doc, chunk, score)
            scored.append((score, doc_id, citation.chunk_id, citation))

    scored.sort(key=lambda item: (-item[0], item[1], item[2]))
    return [item[3] for item in scored[:top_k]]


def get_pack_stats(path: str | Path | None = None) -> Dict[str, Any]:
    payload = load_pack(path or get_pack_path())
    docs = payload.get("docs", []) if isinstance(payload, dict) else []
    doc_ids: set[str] = set()
    chunks_total = 0
    jurisdictions: Dict[str, int] = {}

    for doc in docs if isinstance(docs, list) else []:
        if not isinstance(doc, dict):
            continue
        doc_id = str(doc.get("doc_id", ""))
        if doc_id:
            doc_ids.add(doc_id)
        jurisdiction = str(doc.get("jurisdiction", "")) or "unknown"
        jurisdictions[jurisdiction] = jurisdictions.get(jurisdiction, 0) + 1
        chunks = doc.get("chunks", [])
        if isinstance(chunks, list):
            chunks_total += len(chunks)

    return {
        "knowledge_version": payload.get("version", PACK_VERSION) if isinstance(payload, dict) else PACK_VERSION,
        "docs_total": len(doc_ids) if doc_ids else 0,
        "chunks_total": chunks_total,
        "jurisdictions": jurisdictions,
    }
