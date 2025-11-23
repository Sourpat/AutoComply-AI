from __future__ import annotations

from fastapi import APIRouter

from src.domain.pdma_sample import (
    PDMA_REGULATORY_REFERENCE,
    PdmaSampleExplainRequest,
    PdmaSampleExplainResponse,
    PdmaSampleRequest,
    PdmaSampleVerdict,
    evaluate_pdma_sample,
)

router = APIRouter(prefix="/pdma-sample", tags=["pdma_sample"])


@router.post("/evaluate", response_model=PdmaSampleVerdict)
def evaluate_pdma_sample_endpoint(payload: PdmaSampleRequest) -> PdmaSampleVerdict:
    """
    Evaluate PDMA sample eligibility for a single request.

    This is a deterministic rules engine, not an LLM. It returns a
    PdmaSampleVerdict with status/reasons plus a regulatory reference
    pointing at a /mnt/data/... PDMA-style policy document.
    """
    verdict = evaluate_pdma_sample(payload)
    return verdict


@router.post("/explain", response_model=PdmaSampleExplainResponse)
def explain_pdma_sample_decision(
    payload: PdmaSampleExplainRequest,
) -> PdmaSampleExplainResponse:
    """
    Provide a short, human-readable explanation of a PDMA sample verdict.

    This mirrors the CSF and Ohio "explain" pattern and can be combined with
    /rag/regulatory-explain for deeper RAG-based narrative.
    """
    decision = payload.decision

    # Very simple deterministic summary; RAG can layer on top later.
    if decision.status == "eligible":
        prefix = "This PDMA sample request is eligible in the demo engine."
    elif decision.status == "ineligible":
        prefix = "This PDMA sample request is ineligible in the demo engine."
    else:
        prefix = "This PDMA sample request requires manual review in the demo engine."

    short_explanation = prefix + " " + " ".join(decision.reasons)

    return PdmaSampleExplainResponse(
        decision=decision,
        short_explanation=short_explanation,
        regulatory_references=decision.regulatory_references or [PDMA_REGULATORY_REFERENCE],
    )
