# Case Summary JSON Contract

The **Case Summary** endpoint exposes the canonical decision contract for a
given trace. It is backed by the Pydantic models in
`src/autocomply/insights/case_summary.py`, `src/api/models/decision.py`, and
`src/api/models/compliance_models.py` and is exercised in
`backend/tests/test_case_summary_api.py`.

```http
GET /cases/summary/{trace_id}
```

The endpoint aggregates:

- CSF decisions (hospital, facility, practitioner, EMS, etc.)
- License decisions (Ohio TDDD, NY Pharmacy, others in future)
- Order decisions (mock order approvals, future real order flows)
- Regulatory references and RAG sources
- Embedded decision insights for the full trace

This document describes the JSON structure returned by the endpoint.

## Top-level shape

A typical response looks like:

```json
{
  "trace_id": "trace-123",
  "overall_status": "ok_to_ship",
  "overall_risk": "low",
  "decisions": [ /* array of decision entries */ ],
  "regulatory_references": [ /* array of regulatory reference IDs */ ],
  "rag_sources": [ /* array of RAG source objects */ ],
  "insight": {
    "trace_id": "trace-123",
    "overall_status": "ok_to_ship",
    "overall_risk": "low",
    "summary": "Found 3 decision(s) for trace trace-123. ...",
    "recommendations": ["No immediate blockers detected; proceed..."]
  }
}
```

Field overview:

- **trace_id** (string, required)
  - Unique identifier for this decision trace.
  - Shared across CSF, license, and order decisions linked to the flow.
- **overall_status** (string, required)
  - Aggregated decision status across engines.
  - One of: `"ok_to_ship"`, `"needs_review"`, `"blocked"` (see `DecisionStatus`).
- **overall_risk** (string, required)
  - Aggregated risk across decisions as computed by `generate_decision_insight`.
  - One of: `"low"`, `"medium"`, `"high"`, `"mixed"`.
- **decisions** (array, required)
  - Flattened per-engine decision summaries (see [Decision entries](#decision-entries)).
- **regulatory_references** (array of strings, required)
  - Canonical reference IDs aggregated from individual decisions or inferred from
    regulatory knowledge.
- **rag_sources** (array of objects, required)
  - RAG sources keyed by `regulatory_references`, using the
    `RegulatorySource` shape (see [RAG sources](#rag-sources)).
- **insight** (object, required)
  - Trace-level decision insight generated from the recorded audit entries
    (see [Insights](#insights)).

## Decision entries

Each entry in `decisions` describes one engine’s outcome for this trace. It uses
the `CaseDecisionSummary` model:

```json
{
  "engine_family": "csf",
  "decision_type": "csf_hospital",
  "status": "ok_to_ship",
  "reason": "Hospital CSF is approved for this Ohio Schedule II scenario.",
  "risk_level": "low",
  "trace_id": "trace-123"
}
```

Fields:

- **engine_family** (string)
  - Logical family: `"csf"`, `"license"`, `"order"`, etc.
- **decision_type** (string)
  - Specific engine: `"csf_hospital"`, `"csf_facility"`,
    `"license_ohio_tddd"`, `"license_ny_pharmacy"`, `"order_mock_ny_pharmacy"`,
    etc.
- **status** (string)
  - Decision status from `DecisionOutcome.status`: `"ok_to_ship"`,
    `"needs_review"`, `"blocked"`.
- **reason** (string)
  - Short explanation in natural language.
- **risk_level** (string, optional)
  - Qualitative risk indicator captured by the engine ("low", "medium",
    "high", or omitted).
- **trace_id** (string, optional)
  - Trace ID tying this decision back to the overall case.

> Note: Detailed engine-level fields such as `risk_score` or `debug_info` live
> on the underlying `DecisionOutcome` objects and in the decision audit log, but
> are not surfaced in the case summary payload.

## Regulatory references

The `regulatory_references` array contains canonical reference IDs that can be
shared across decisions. Each entry is an ID string (for example,
`"ohio_tddd_rules"` or `"csf_hospital_form"`). IDs correspond to
`RegulatoryReference.id` values returned by engines and are used to look up
source material.

These references are gathered from individual `DecisionOutcome.regulatory_references`
values and, if necessary, inferred from regulatory knowledge when an engine does
not emit explicit references.

## RAG sources

The `rag_sources` array lists document or snippet-level information used by the
RAG pipeline. It uses the `RegulatorySource` shape:

```json
{
  "id": "csf_hospital_form",
  "title": "Hospital Controlled Substance Form",
  "jurisdiction": "Ohio",
  "source": "csf_pdf_stub",
  "snippet": "Section 3 requires DEA and state license to be current...",
  "url": "https://example.org/csf/hospital.pdf"
}
```

Typical fields:

- **id** (string, optional)
- **title** (string, optional)
- **jurisdiction** (string, optional)
- **source** (string, optional)
- **snippet** (string, optional)
- **url** (string, optional)

These map to the `RegulatorySource` model and are returned by
`get_regulatory_knowledge()` when matching the collected reference IDs for the
trace.

## Insights

The `insight` object provides a trace-level view derived from the recorded audit
entries (see `DecisionInsight`):

- **trace_id** – the trace identifier.
- **overall_status** – same enum as the top-level `overall_status`.
- **overall_risk** – same enum as the top-level `overall_risk`.
- **summary** – generated sentence describing how many decisions were found and
  which engine families contributed.
- **recommendations** – list of suggestions based on the combined status/risk
  (e.g., prompts to escalate blocked traces).

## Contract stability expectations

- `trace_id`, `overall_status`, `overall_risk`, and `decisions[*].status` are
  stable contract fields exercised by `backend/tests/test_case_summary_api.py`.
- `regulatory_references` and `rag_sources` are stable and align with
  `RegulatoryReference` / `RegulatorySource` usage across CSF, license, and
  order flows.
- `insight` is part of the contract so downstream systems can render the same
  high-level view as the UI.
- Engine-level debug metadata (`DecisionOutcome.debug_info`) is considered
  non-contractual and may evolve without changing the case summary payload.
