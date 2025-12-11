# Risk and Explanation Semantics

AutoComply AI exposes decisions with a consistent **status**, optional
**risk metadata**, and a short **explanation text** that reads like a
regulatory analyst's note.

This document describes:

- How status maps to risk levels
- How `risk_level` and `risk_score` are intended to be used
- How the explanation text is generated from the regulatory context

---

## 1. Decision status → risk semantics

Every decision object (CSF, license, order, etc.) exposes a `status` field,
typically one of:

- `ok_to_ship`
- `needs_review`
- `blocked`

When a decision does not explicitly set `risk_level`, AutoComply AI derives
a default risk level from status:

- `ok_to_ship` → **low** risk
- `needs_review` → **medium** risk
- `blocked` → **high** risk

This mapping is used consistently in:

- `GET /decisions/recent`
  - Surfaced in the **Recent Decisions** panel as risk badges
- `GET /cases/summary/{trace_id}`
  - Aggregated into per-engine entries in the **Case Summary** panel
- Operational overview
  - Summarized as low / medium / high counts in the **Operational Overview**
    panel

Engines are free to override this default by explicitly setting `risk_level`
to `"low"`, `"medium"`, or `"high"`. When present, the explicit value takes
precedence over the status-derived default.

---

## 2. `risk_level` and `risk_score`

Each decision may include risk metadata:

```json
{
  "status": "needs_review",
  "reason": "...",
  "risk_level": "medium",
  "risk_score": 0.45
}
```

**`risk_level` (string, optional)**

- Qualitative view of risk: `"low"`, `"medium"`, or `"high"`.
- If omitted, it is inferred from status as described above.

**`risk_score` (number, optional)**

- Quantitative indicator intended for future ranking / triage.
- Currently stubbed in many flows; in a production deployment this would be
  driven by rule weights (e.g., DEA mismatch vs minor missing field),
  regulatory severity, and model-based scoring from the RAG/ML layer.

Downstream systems can use:

- `status` for hard gating (e.g., block shipment).
- `risk_level` and `risk_score` to prioritize work queues, dashboards, and
  alerts.

---

## 3. Explanation text semantics

The explanation text builder (deterministic helper referenced in
`backend/tests/test_rag_explanation_text.py`) converts regulatory context into a
short narrative that reads like a compliance analyst's note. It combines:

- **Decision status** — e.g., `ok_to_ship`, `needs_review`, `blocked`
- **Jurisdiction information** — such as "Ohio", "New York", or
  "DEA / Federal"
- **Regulatory sources and citations** — such as Ohio TDDD rules or NY
  Pharmacy Board guidance

A typical explanation looks like:

> Based on the information provided and the current rules for Ohio, AutoComply
> AI considers this request appropriate to proceed with shipment. This
> assessment is informed by Ohio TDDD Rules (OAC 4729:5-3) and related
> regulatory guidance.

At a high level, the builder:

1. Maps the internal status to a phrase:
   - `ok_to_ship` → "appropriate to proceed with shipment"
   - `needs_review` → "not fully clear and should be reviewed"
   - `blocked` → "not permitted to proceed as-is"
2. Combines that phrase with jurisdiction (if available), e.g., "Based on the
   information provided and the current rules for Ohio…"
3. References at least one regulatory source or citation when present, e.g.,
   "This assessment is informed by Ohio TDDD Rules (OAC 4729:5-3)…"
4. Optionally notes that additional supporting references exist if multiple
   sources were used.

This explanation text is used in:

- CSF explain / form copilot flows
- License RAG explanations (Ohio TDDD, NY Pharmacy)
- Case summaries and mock order narratives

It is intentionally:

- Short and scannable for non-technical stakeholders.
- Deterministic and testable (no randomness).
- Aligned with the underlying regulatory references surfaced in the UI.

---

## 4. Where this surfaces in the product

- **Compliance Console** — Each CSF and license panel shows status + explanation
  + references.
- **Regulatory Knowledge Explorer** — Shows the underlying snippets and
  citations contributing to decisions.
- **Recent Decisions** — Uses status + risk mapping to show risk badges per
  decision.
- **Case Summary** — Exposes the canonical JSON contract for a trace, including
  status, risk metadata, regulatory references, and RAG sources.
- **Operational Overview** — Aggregates recent decisions into low / medium /
  high risk counts for an at-a-glance risk posture.
