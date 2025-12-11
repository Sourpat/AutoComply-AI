from src.rag.models import RagSource
from src.rag.service import build_rag_sources, normalize_scores


class DummyResult:
    def __init__(self, text: str, score: float, metadata: dict | None = None):
        self.page_content = text
        self.score = score
        self.metadata = metadata or {}


def test_normalize_scores_basic():
    raw = [0.2, 0.5, 0.8]
    norm = normalize_scores(raw)
    assert len(norm) == 3
    assert min(norm) == 0.0
    assert max(norm) == 1.0


def test_normalize_scores_all_equal():
    raw = [0.5, 0.5, 0.5]
    norm = normalize_scores(raw)
    assert all(x == 1.0 for x in norm)


def test_build_rag_sources_sorts_by_score_desc():
    results = [
        DummyResult("low", 0.2, {"id": "low"}),
        DummyResult("mid", 0.5, {"id": "mid"}),
        DummyResult("high", 0.8, {"id": "high"}),
    ]
    sources = build_rag_sources(results)
    assert isinstance(sources[0], RagSource)
    # first should be the highest raw score
    assert sources[0].id == "high"
    # scores should be within [0.0, 1.0]
    assert all(0.0 <= s.score <= 1.0 for s in sources)
