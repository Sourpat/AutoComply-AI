from types import SimpleNamespace

from src.explanations.builder import build_explanation
from src.rag.models import RagSource


def _base_decision(status: str):
    return SimpleNamespace(
        status=status,
        reason="",
        risk_level="low" if status == "ok_to_ship" else "medium",
        risk_score=0.1,
        missing_fields=[],
        regulatory_references=[],
        rag_sources=[],
        debug_info={},
    )


def test_explanation_ok_to_ship_with_jurisdiction_and_rag_source():
    decision = _base_decision("ok_to_ship")
    source = RagSource(
        snippet="Some Ohio TDDD text.",
        score=0.95,
        raw_score=12.3,
        jurisdiction="Ohio",
        citation="OAC 4729:5-3-10",
        label="Ohio TDDD hospital rules",
    )

    explanation = build_explanation(
        decision=decision,
        jurisdiction="Ohio",
        vertical_name="Ohio Hospital vertical",
        rag_sources=[source],
    )

    assert "current rules for Ohio" in explanation
    assert "Ohio Hospital vertical" in explanation
    assert "appropriate to proceed with shipment" in explanation
    assert "OAC 4729:5-3-10" in explanation  # citation from RAG source


def test_explanation_needs_review_mentions_missing_fields():
    decision = _base_decision("needs_review")
    decision.missing_fields = ["tddd_license_number", "facility_id"]

    explanation = build_explanation(
        decision=decision,
        jurisdiction="Ohio",
        vertical_name=None,
        rag_sources=[],
    )

    assert "needs_review" not in explanation.lower()  # phrase is paraphrased
    assert "manual review" in explanation.lower() or "requiring manual review" in explanation
    assert "tddd_license_number" in explanation
    assert "facility_id" in explanation


def test_explanation_blocked_without_missing_fields_recommends_review():
    decision = _base_decision("blocked")
    explanation = build_explanation(
        decision=decision,
        jurisdiction=None,
        vertical_name=None,
        rag_sources=[],
    )

    assert "not appropriate to proceed" in explanation
    assert "manual review is recommended" in explanation.lower() or "manual review" in explanation.lower()

