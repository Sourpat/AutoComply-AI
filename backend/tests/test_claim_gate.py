from src.autocomply.domain.explainability.claim_gate import gate_summary
from src.autocomply.domain.explainability.models import Citation, FiredRule, MissingField


def test_claim_gate_blocks_tddd_without_evidence() -> None:
    summary = "TDDD required for approval."
    gated = gate_summary(summary, [], [], [], "blocked")
    assert "Blocked due to missing required information" in gated


def test_claim_gate_blocks_regulatory_claim_without_citations() -> None:
    summary = "Approval required by statute."
    gated = gate_summary(summary, [], [], [], "needs_review")
    assert "Needs review" in gated


def test_claim_gate_allows_known_missing_fields() -> None:
    summary = "Blocked: missing DEA Number."
    missing = [MissingField(key="dea_number", label="DEA Number", category="BLOCK")]
    gated = gate_summary(summary, missing, [], [], "blocked")
    assert gated == summary


def test_claim_gate_allows_known_rule_name_with_citations() -> None:
    summary = "Ohio TDDD certificate required by policy."
    fired_rules = [
        FiredRule(
            id="OH_TDDD_REQUIRED",
            name="Ohio TDDD certificate required",
            severity="BLOCK",
            rationale="",
            inputs={},
            conditions=None,
        )
    ]
    citations = [
        Citation(
            doc_id="doc-1",
            chunk_id="chunk-1",
            snippet="",
            source_title="Ohio Revised Code",
        )
    ]
    gated = gate_summary(summary, [], fired_rules, citations, "blocked")
    assert gated == summary
