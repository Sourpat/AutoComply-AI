# Parking Lot

**Purpose:** Track deferred work items with severity classification to maintain focus and prevent scope creep.

**Format per item:**
- **ID:** Unique identifier (e.g., PL-001)
- **Severity:** P0 (critical) / P1 (high) / P2 (medium) / P3 (low)
- **Impact:** What breaks or degrades without this
- **Files:** Affected file paths
- **Next step:** Specific actionable next step
- **Notes:** Additional context, dependencies, or constraints

---

## Active Items

### PL-001: Multi-Workflow Instrumentation
- **Severity:** P2 (medium)
- **Impact:** Only recompute endpoint is traced; other AI workflows (RAG, evidence analysis, etc.) lack observability
- **Files:** `backend/app/*/router.py` (multiple AI endpoints)
- **Next step:** After Phase 1 pilot success, extend TraceContext to other AI workflows
- **Notes:** Blocked by Phase 1 completion. Requires identifying all AI call sites across codebase.

### PL-002: Trace UI Dashboard
- **Severity:** P2 (medium)
- **Impact:** No visual trace timeline; users must read raw JSON
- **Files:** `frontend/src/features/trace/` (NEW)
- **Next step:** After Phase 1 API is ready, create React component for trace visualization (spans, timeline, errors)
- **Notes:** Blocked by Phase 1 Traces API endpoint. Could use existing chart.js or d3.js libraries.

### PL-003: Trace Search/Filtering
- **Severity:** P2 (medium)
- **Impact:** Cannot filter traces by date range, error status, or duration percentiles
- **Files:** `backend/app/trace/router.py` (extend GET /api/traces)
- **Next step:** After Phase 1 basic API, add query parameters (start_date, end_date, has_error, min_duration_ms)
- **Notes:** Blocked by Phase 1 API. May need additional DB indexes for performance.

### PL-004: OTEL Exporter
- **Severity:** P3 (low)
- **Impact:** Cannot export traces to external observability platforms (Jaeger, DataDog, Honeycomb)
- **Files:** `backend/app/trace/otel_exporter.py` (NEW)
- **Next step:** Optional future work. Write adapter to convert intelligence_history spans to OTEL format.
- **Notes:** NOT blocking. Decision documented in decision-log.md. Implement only if users explicitly request OTEL.

### PL-005: Trace Sampling
- **Severity:** P3 (low)
- **Impact:** 100% tracing in production could bloat DB; no sampling strategy
- **Files:** `backend/app/trace/sampling.py` (NEW), `backend/src/config.py` (add TRACE_SAMPLE_RATE)
- **Next step:** Production-only feature. Record only N% of traces (default 1%) based on trace_id hash.
- **Notes:** NOT needed in dev. Implement only after 2+ months of prod tracing shows DB growth issues.

### PL-006: Trace Metrics Aggregation
- **Severity:** P3 (low)
- **Impact:** Cannot see p50/p95/p99 latency trends over time
- **Files:** `backend/app/analytics/` (extend existing analytics), `backend/app/trace/metrics.py` (NEW)
- **Next step:** After Phase 1 + 2 months of trace data, aggregate span durations into time-series metrics
- **Notes:** Blocked by Phase 1 + data accumulation. Requires async job to compute percentiles daily.

---

## Completed Items

_(Items moved here after resolution)_
