from fastapi import APIRouter
from pydantic import BaseModel, Field, root_validator
from typing import Any, Dict, List, Optional

from src.autocomply.domain.rag_regulatory_explain import (
    RegulatoryRagAnswer,
    RegulatoryRagRequestModel,
    explain_csf_practitioner_decision,
    regulatory_rag_explain,
)
from src.autocomply.domain.csf_practitioner_evaluator import (
    evaluate_csf_practitioner_decision,
    get_mock_scenarios as get_csf_practitioner_scenarios,
)
from src.autocomply.domain.ohio_tddd_evaluator import (
    evaluate_ohio_tddd_decision,
    get_mock_scenarios as get_ohio_tddd_scenarios,
)
from src.autocomply.domain.ny_pharmacy_license_evaluator import (
    evaluate_ny_pharmacy_license_decision,
    get_mock_scenarios as get_ny_pharmacy_license_scenarios,
)
from src.autocomply.domain.csf_facility_evaluator import (
    evaluate_csf_facility_decision,
    get_mock_scenarios as get_csf_facility_scenarios,
)
from src.api.models.decision import RegulatoryReference
from src.api.models.compliance_models import RegulatoryExplainResponse, RegulatorySource
from src.autocomply.regulations.knowledge import get_regulatory_knowledge
from src.stores.decision_store import get_decision_store
from src.autocomply.domain.submissions_store import get_submission_store

router = APIRouter(
    prefix="/rag",
    tags=["rag_regulatory"],
)


class RegulatoryRagRequest(BaseModel):
    """
    Public API shape for /rag/regulatory-explain.

    We accept a superset of fields used by various frontend sandboxes so that
    callers don't have to perfectly match the backend model. Only the
    question/ask field is required; other fields are optional and ignored if not
    used by the current engine.
    """

    # Core question fields
    question: Optional[str] = Field(None, min_length=1)
    ask: Optional[str] = Field(None, min_length=1)

    # Engine context
    engine_family: Optional[str] = Field(
        None, description="Decision engine family (e.g., csf, license)."
    )
    decision_type: Optional[str] = Field(
        None, description="Specific decision type (e.g., csf_practitioner)."
    )

    # Decision payload and identifiers
    decision: Optional[Dict[str, Any]] = None
    account_id: Optional[str] = None
    decision_snapshot_id: Optional[str] = None
    source_document: Optional[str] = None

    regulatory_references: List[str] = Field(default_factory=list)

    @root_validator(pre=True)
    def set_question_from_ask(cls, values: Dict[str, Any]) -> Dict[str, Any]:
        # Frontends may send either `question` or `ask`; normalize to `question`.
        if not values.get("question") and values.get("ask"):
            values["question"] = values.get("ask")
        return values

    @root_validator(skip_on_failure=True)
    def ensure_question(cls, values: Dict[str, Any]) -> Dict[str, Any]:
        question = (values.get("question") or "").strip()
        if not question:
            raise ValueError("question or ask is required")
        values["question"] = question
        return values


class RegulatoryRagResponse(RegulatoryExplainResponse):
    """
    Response model; we just reuse the domain model.
    """

    pass


class RegulatoryPreviewRequest(BaseModel):
    """
    Request body for the regulatory preview endpoint.

    All fields are optional; you can:
    - provide doc_ids explicitly, or
    - rely on decision_type + jurisdiction fallback logic.
    """

    decision_type: Optional[str] = None
    jurisdiction: Optional[str] = None
    doc_ids: Optional[List[str]] = None


class RegulatoryPreviewItem(BaseModel):
    """
    Flattened version of RegulatoryEvidenceItem for public API.
    """

    id: str
    jurisdiction: Optional[str] = None
    source: Optional[str] = None
    citation: Optional[str] = None
    label: Optional[str] = None
    snippet: Optional[str] = None


class RegulatoryPreviewResponse(BaseModel):
    items: List[RegulatoryPreviewItem]


@router.post("/regulatory/preview", response_model=RegulatoryPreviewResponse)
async def regulatory_preview(
    payload: RegulatoryPreviewRequest,
) -> RegulatoryPreviewResponse:
    """
    Return a preview of regulatory evidence available for a given decision type /
    jurisdiction / doc_ids.

    This is a read-only endpoint intended for:
    - debugging
    - integrations (n8n, agents)
    - future UI cards to show the underlying regulatory basis.
    """

    knowledge = get_regulatory_knowledge()

    sources: List[RegulatorySource] = []
    doc_ids: List[str] = payload.doc_ids or []

    if not doc_ids and payload.decision_type:
        inferred_engine_family = (payload.decision_type or "").split("_", 1)[0]
        sources = knowledge.get_context_for_engine(
            engine_family=inferred_engine_family, decision_type=payload.decision_type
        )
    elif doc_ids:
        sources = knowledge.get_sources_for_doc_ids(doc_ids)
    else:
        sources = []

    items: List[RegulatoryPreviewItem] = []
    for src in sources:
        items.append(
            RegulatoryPreviewItem(
                id=src.id or "",
                jurisdiction=src.jurisdiction,
                source=src.title,
                citation=getattr(src, "citation", None),
                label=src.title or (src.id or ""),
                snippet=src.snippet,
            )
        )

    return RegulatoryPreviewResponse(items=items)


@router.post("/regulatory-explain", response_model=RegulatoryRagResponse)
async def regulatory_explain_endpoint(
    payload: RegulatoryRagRequest,
) -> RegulatoryRagResponse:
    """
    Explain a regulatory decision or rule using deterministic evaluation.

    Routes to the appropriate deterministic evaluator based on decision_type:
    - csf_practitioner: CSF Practitioner evaluator
    - ohio_tddd: Ohio TDDD License evaluator
    - ny_pharmacy_license: NY Pharmacy License evaluator
    - csf_facility: CSF Facility evaluator
    
    Falls back to generic RAG explain for other decision types.
    """

    knowledge = get_regulatory_knowledge()
    fallback_sources: List[RegulatorySource] = []

    if payload.engine_family and payload.decision_type:
        fallback_sources = knowledge.get_context_for_engine(
            engine_family=payload.engine_family,
            decision_type=payload.decision_type,
        )

    answer: RegulatoryRagAnswer
    eval_result = None

    # Route to appropriate deterministic evaluator based on decision_type
    if payload.decision and "evidence" in payload.decision:
        
        # CSF Practitioner Evaluator
        if (
            payload.engine_family == "csf"
            and payload.decision_type == "csf_practitioner"
        ):
            eval_result = evaluate_csf_practitioner_decision(
                evidence=payload.decision["evidence"],
                decision_type=payload.decision_type,
            )
        
        # Ohio TDDD Evaluator
        elif (
            payload.engine_family == "license"
            and payload.decision_type == "ohio_tddd"
        ):
            eval_result = evaluate_ohio_tddd_decision(
                evidence=payload.decision["evidence"],
                decision_type=payload.decision_type,
            )
        
        # NY Pharmacy License Evaluator
        elif (
            payload.engine_family == "license"
            and payload.decision_type == "ny_pharmacy_license"
        ):
            eval_result = evaluate_ny_pharmacy_license_decision(
                evidence=payload.decision["evidence"],
                decision_type=payload.decision_type,
            )
        
        # CSF Facility Evaluator
        elif (
            payload.engine_family == "csf"
            and payload.decision_type == "csf_facility"
        ):
            eval_result = evaluate_csf_facility_decision(
                evidence=payload.decision["evidence"],
                decision_type=payload.decision_type,
            )
    
    # Convert evaluator result to RegulatoryRagAnswer format
    if eval_result:
        answer = RegulatoryRagAnswer(
            answer=eval_result.explanation,
            sources=eval_result.sources,
            regulatory_references=[fr.id for fr in eval_result.fired_rules],
            artifacts_used=[fr.id for fr in eval_result.fired_rules],
            debug={
                "mode": "deterministic_evaluator",
                "decision_type": payload.decision_type,
                "outcome": eval_result.outcome,
                "fired_rules_count": len(eval_result.fired_rules),
                "missing_evidence_count": len(eval_result.missing_evidence),
                "next_steps_count": len(eval_result.next_steps),
                "fired_rules": [
                    {
                        "id": fr.id,
                        "title": fr.title,
                        "severity": fr.severity,
                        "citation": fr.citation,
                    }
                    for fr in eval_result.fired_rules
                ],
                "missing_evidence": eval_result.missing_evidence,
                "next_steps": eval_result.next_steps,
            },
        )
    elif (
        payload.engine_family == "csf"
        and payload.decision_type == "csf_practitioner"
    ):
        # Fallback to standard explain for csf_practitioner if no evidence provided
        answer = explain_csf_practitioner_decision(
            decision=payload.decision,
            question=payload.question,
            regulatory_references=payload.regulatory_references,
        )
    else:
        # Generic RAG explain for unsupported decision types
        domain_request = RegulatoryRagRequestModel(
            question=payload.question,
            regulatory_references=payload.regulatory_references,
            decision=payload.decision,
        )
        answer = regulatory_rag_explain(domain_request)

    if not answer.sources and fallback_sources:
        answer.sources = fallback_sources
    if not answer.artifacts_used and fallback_sources:
        answer.artifacts_used = [src.id for src in fallback_sources if src.id]
    if not answer.regulatory_references and fallback_sources:
        answer.regulatory_references = [src.id for src in fallback_sources if src.id]

    return RegulatoryRagResponse(**answer.model_dump())


@router.get("/regulatory/scenarios")
async def get_regulatory_scenarios():
    """
    Get mock decision scenarios for testing the explain endpoint.
    
    Returns pre-defined scenarios for csf_practitioner evaluations.
    """
    scenarios = get_mock_scenarios()
    
    return {
        "scenarios": [
            {
                "id": scenario_id,
                "name": data["name"],
                "description": data["description"],
                "decision_type": "csf_practitioner",
                "engine_family": "csf",
            }
            for scenario_id, data in scenarios.items()
        ]
    }


class LastDecisionResponse(BaseModel):
    """Response for GET /rag/decisions/last endpoint."""
    exists: bool
    engine_family: Optional[str] = None
    decision_type: Optional[str] = None
    saved_at: Optional[str] = None
    evidence: Optional[Dict[str, Any]] = None
    meta: Optional[Dict[str, Any]] = None


class RecentSubmissionItem(BaseModel):
    """A recent CSF submission for the submissions dropdown."""
    trace_id: str
    submission_id: str
    csf_type: str
    title: str
    status: str
    risk: Optional[str] = None
    created_at: str


class RecentSubmissionsResponse(BaseModel):
    """Response for recent submissions list."""
    submissions: List[RecentSubmissionItem]


class TraceResponse(BaseModel):
    """Full trace data for explainability."""
    trace_id: str
    submission_id: str
    csf_type: str
    status: str
    risk: Optional[str] = None
    created_at: str
    decision_summary: Optional[str] = None
    fired_rules: List[Dict[str, Any]] = []
    evaluated_rules: List[Dict[str, Any]] = []
    missing_evidence: List[str] = []
    next_steps: List[str] = []
    evidence: Dict[str, Any] = {}
    meta: Optional[Dict[str, Any]] = None


@router.get("/submissions/recent", response_model=RecentSubmissionsResponse)
async def get_recent_submissions(
    tenant: str = "ohio",
    limit: int = 20,
) -> RecentSubmissionsResponse:
    """
    Get recent CSF submissions for the connected mode dropdown.
    
    Query parameters:
    - tenant: Tenant ID (default: "ohio")
    - limit: Maximum number of submissions to return (default: 20)
    
    Returns list of recent submissions with trace_id, title, status, etc.
    """
    store = get_submission_store()
    submissions_data = store.list_submissions(tenant=tenant, limit=limit)
    
    submissions = [
        RecentSubmissionItem(
            trace_id=sub.trace_id,
            submission_id=sub.submission_id,
            csf_type=sub.csf_type,
            title=sub.title,
            status=sub.status,
            risk=sub.risk_level,
            created_at=sub.created_at,
        )
        for sub in submissions_data
    ]
    
    return RecentSubmissionsResponse(submissions=submissions)


@router.get("/trace/{trace_id}", response_model=TraceResponse)
async def get_trace(trace_id: str) -> TraceResponse:
    """
    Get full trace data for a specific trace_id.
    
    Path parameter:
    - trace_id: The trace ID to retrieve
    
    Returns full trace payload with decision data, fired rules, evidence, etc.
    """
    store = get_submission_store()
    
    # Find submission by trace_id
    all_submissions = store.list_submissions(limit=1000)
    submission = None
    for sub in all_submissions:
        if sub.trace_id == trace_id:
            submission = sub
            break
    
    if not submission:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail=f"Trace not found: {trace_id}")
    
    # Extract decision data from payload
    payload = submission.payload
    decision = payload.get("decision", {})
    
    return TraceResponse(
        trace_id=submission.trace_id,
        submission_id=submission.submission_id,
        csf_type=submission.csf_type,
        status=submission.status,
        risk=submission.risk_level,
        created_at=submission.created_at,
        decision_summary=decision.get("decision_summary", ""),
        fired_rules=decision.get("fired_rules", []),
        evaluated_rules=decision.get("evaluated_rules", []),
        missing_evidence=decision.get("missing_evidence", []),
        next_steps=decision.get("next_steps", []),
        evidence=payload.get("evidence", {}),
        meta=payload,
    )


@router.get("/decisions/last", response_model=LastDecisionResponse)
async def get_last_decision(
    engine_family: str,
    decision_type: str,
) -> LastDecisionResponse:
    """
    Get the last saved decision for a given engine family and decision type.
    
    Query parameters:
    - engine_family: e.g., "csf", "license"
    - decision_type: e.g., "csf_practitioner", "license_dea"
    
    Returns:
    - exists: Whether a decision exists
    - engine_family, decision_type, saved_at, evidence, meta if exists=True
    """
    store = get_decision_store()
    decision = store.get_last_decision(engine_family, decision_type)
    
    if decision is None:
        return LastDecisionResponse(exists=False)
    
    return LastDecisionResponse(
        exists=True,
        engine_family=decision["engine_family"],
        decision_type=decision["decision_type"],
        saved_at=decision["saved_at"],
        evidence=decision["evidence"],
        meta=decision.get("meta"),
    )

