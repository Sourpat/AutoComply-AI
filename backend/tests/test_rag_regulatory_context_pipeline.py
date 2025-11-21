"""
Tests for the RAG-style regulatory context builder.

This does NOT depend on external vector stores or APIs.
It simply ensures we always return a well-structured list of
context snippets that:
- mention DEA (federal baseline)
- mention the state / jurisdiction where appropriate
"""

from src.rag.regulatory_context import build_regulatory_context


def test_build_regulatory_context_shape_and_types():
    ctx = build_regulatory_context(state="CA", purchase_intent="Telemedicine")

    assert isinstance(ctx, list)
    assert len(ctx) >= 2

    for item in ctx:
        assert isinstance(item, dict)
        assert "source" in item
        assert "snippet" in item
        assert isinstance(item["source"], str)
        assert isinstance(item["snippet"], str)


def test_build_regulatory_context_contains_dea_and_state():
    state = "CA"
    ctx = build_regulatory_context(state=state, purchase_intent="Telemedicine")

    joined = " ".join(item["snippet"] for item in ctx)

    # Federal baseline context should mention DEA somewhere
    assert "DEA" in joined

    # State-specific context should reference the state or its full name
    assert "CA" in joined or "California" in joined
