from __future__ import annotations

from typing import Any, List

from src.rag.models import RagSource


def normalize_scores(raw_scores: List[float]) -> List[float]:
    """
    Normalize raw retriever scores into [0.0, 1.0].

    Assumes higher scores are better; if scores are identical we return 1.0 for
    all results to avoid division by zero and to keep deterministic ordering.
    """

    if not raw_scores:
        return []

    max_score = max(raw_scores)
    min_score = min(raw_scores)

    if max_score == min_score:
        return [1.0 for _ in raw_scores]

    return [(score - min_score) / (max_score - min_score) for score in raw_scores]


def _extract_metadata(result: Any) -> tuple[dict, str]:
    if isinstance(result, RagSource):
        meta = {
            "id": result.id,
            "label": result.label,
            "jurisdiction": result.jurisdiction,
            "citation": result.citation,
            "url": result.url,
            "source_type": result.source_type,
        }
        snippet = result.snippet
        return meta, snippet

    if isinstance(result, dict):
        meta = result.get("metadata") or result.get("meta") or {}
        snippet = (
            result.get("page_content")
            or result.get("text")
            or result.get("snippet")
            or ""
        )
        if not meta:
            meta = {k: v for k, v in result.items() if k not in {"page_content", "text", "score", "similarity"}}
        return meta, snippet

    meta = getattr(result, "metadata", getattr(result, "meta", {})) or {}
    snippet = getattr(result, "page_content", getattr(result, "text", "")) or ""
    return meta, snippet


def _extract_raw_score(result: Any) -> float:
    if isinstance(result, RagSource):
        if result.raw_score is not None:
            return float(result.raw_score)
        return float(result.score)

    if isinstance(result, dict):
        return float(result.get("score") or result.get("similarity") or 0.0)

    return float(getattr(result, "score", getattr(result, "similarity", 0.0)) or 0.0)


def build_rag_sources(results: list[Any]) -> List[RagSource]:
    """
    Convert raw retriever results into sorted RagSource models.

    ``results`` can include dicts, objects with ``metadata``/``page_content`` fields,
    or already-constructed ``RagSource`` instances.
    """

    if not results:
        return []

    raw_scores = [_extract_raw_score(res) for res in results]
    norm_scores = normalize_scores(raw_scores)

    rag_sources: List[RagSource] = []

    for idx, (res, norm) in enumerate(zip(results, norm_scores)):
        meta, snippet = _extract_metadata(res)
        snippet = (snippet or "").strip()

        rag_sources.append(
            RagSource(
                id=str(meta.get("id") or meta.get("doc_id") or idx),
                label=meta.get("title") or meta.get("label"),
                jurisdiction=meta.get("jurisdiction"),
                citation=meta.get("citation"),
                snippet=snippet[:600],
                score=round(norm, 4),
                raw_score=float(raw_scores[idx]),
                url=meta.get("url"),
                source_type=meta.get("source_type") or meta.get("source"),
            )
        )

    rag_sources.sort(key=lambda source: source.score, reverse=True)

    return rag_sources
