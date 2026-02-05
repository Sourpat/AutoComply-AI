from __future__ import annotations

from dataclasses import dataclass
from time import perf_counter
from typing import Iterable, List, Optional, Tuple

from src.autocomply.domain.explainability.models import Citation
from src.autocomply.regulations.knowledge import get_regulatory_knowledge


@dataclass(frozen=True)
class EvidenceRetrievalStats:
    top_k: int
    elapsed_ms: int
    unique_docs: int


def _jurisdiction_match(source_jurisdiction: Optional[str], jurisdiction: Optional[str]) -> bool:
    if not jurisdiction:
        return True
    if not source_jurisdiction:
        return False
    return jurisdiction.lower() in source_jurisdiction.lower()


def _unique_key(doc_id: str, chunk_id: str) -> Tuple[str, str]:
    return (doc_id, chunk_id)


def retrieve_evidence(
    queries: Iterable[str],
    jurisdiction: str | None,
    k: int = 4,
) -> List[Citation]:
    knowledge = get_regulatory_knowledge()
    citations: dict[Tuple[str, str], Citation] = {}

    for query in queries:
        q = query.strip()
        if not q:
            continue
        results = knowledge.search_sources(q, limit=k)
        for src in results:
            if not _jurisdiction_match(getattr(src, "jurisdiction", None), jurisdiction):
                continue
            doc_id = src.id or ""
            chunk_id = src.id or ""
            key = _unique_key(doc_id, chunk_id)

            citation = Citation(
                doc_id=doc_id,
                chunk_id=chunk_id,
                snippet=src.snippet or "",
                jurisdiction=getattr(src, "jurisdiction", None),
                confidence=getattr(src, "score", None),
                source_title=getattr(src, "label", None) or getattr(src, "title", None),
                url=getattr(src, "url", None),
            )

            existing = citations.get(key)
            if existing is None:
                citations[key] = citation
            else:
                existing_conf = existing.confidence or 0.0
                new_conf = citation.confidence or 0.0
                if new_conf > existing_conf:
                    citations[key] = citation

    ordered = sorted(
        citations.values(),
        key=lambda item: (
            -(item.confidence or 0.0),
            item.doc_id,
            item.chunk_id,
        ),
    )

    return ordered[:k]


def retrieve_evidence_with_stats(
    queries: Iterable[str],
    jurisdiction: str | None,
    k: int = 4,
) -> Tuple[List[Citation], EvidenceRetrievalStats]:
    start = perf_counter()
    citations = retrieve_evidence(queries=queries, jurisdiction=jurisdiction, k=k)
    elapsed_ms = int((perf_counter() - start) * 1000)
    unique_docs = len({citation.doc_id for citation in citations if citation.doc_id})
    stats = EvidenceRetrievalStats(top_k=k, elapsed_ms=elapsed_ms, unique_docs=unique_docs)
    return citations, stats
