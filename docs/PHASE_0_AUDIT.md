# PHASE 0 — REPO AUDIT: TRACE & QUALITY GOVERNANCE

**Created:** 2026-01-24  
**Purpose:** Inventory existing infrastructure before building enterprise trace observability  
**Status:** ✅ COMPLETE (read-only audit, no code changes)

---

## 🎯 WHAT WE ALREADY HAVE (DO NOT DUPLICATE)

### 📊 **Existing Audit/Log Infrastructure**

#### **1. intelligence_history Table (PRIMARY AUDIT LOG)**
- **Purpose:** Comprehensive audit trail for all AI/intelligence computations
- **Location:** `backend/app/intelligence/repository.py` (lines 617-890)
- **Schema:** Includes integrity fields (Phase 7.20), evidence snapshots (Phase 7.24), policy versioning (Phase 7.25), request_id (Phase 7.33)
- **Key Fields:**
  - Core: `id`, `case_id`, `computed_at`, `payload` (full intelligence JSON)
  - Integrity: `input_hash`, `evidence_hash`, `previous_run_id`, `integrity_check`
  - Trace: `request_id` (UUID for request tracing)
  - Evidence: `evidence_text`, `evidence_summary`, `evidence_structured_json`
  - Policy: `policy_version`, `policy_hash`, `decision_type`
  - Reason: `trigger` (manual/submission/evidence/request_info), `actor_role`
- **API:** `insert_intelligence_history()`, `get_intelligence_history()`, `cleanup_old_intelligence_history()`
- **Migration:** `backend/scripts/migrate_add_intelligence_history.py`
- **Tests:** `backend/tests/test_phase7_11_intelligence_history.py`, `test_phase7_20_audit_integrity.py`

**🔑 KEY INSIGHT:** This is already a **trace-like structure**! It captures:
- Input/output snapshots
- Chain of custody (previous_run_id)
- Why it ran (trigger, actor_role)
- Request correlation (request_id)

#### **2. audit_events Table (Workflow Audit)**
- **Purpose:** Workflow state transitions and user actions
- **Location:** `backend/app/workflow/models.py` (lines 53-309)
- **Schema:** `id`, `case_id`, `event_type`, `timestamp`, `actor_id`, `metadata_json`
- **Event Types:** `case_created`, `case_updated`, `submission_verified`, `decision_intelligence_updated`, etc.
- **API:** Not found in search (likely in workflow repository)

#### **3. Request ID Middleware (Phase 7.33)**
- **Purpose:** Generate X-Request-Id for end-to-end request tracing
- **Location:** `backend/app/middleware/request_id.py`
- **Features:**
  - Generates UUID if not present
  - Reuses client-provided X-Request-Id
  - Adds to response headers
  - Stores in `request.state.request_id`
  - Logs request start/completion/error with request_id
- **Integration:** Registered in `src/api/main.py` (line 79)

#### **4. Cryptographic Signing (Phase 7.26)**
- **Purpose:** HMAC-SHA256 tamper-proof signatures for audit exports
- **Location:** `backend/app/intelligence/signing.py`
- **Functions:** `canonical_json()`, `hmac_sign()`, `hmac_verify()`

#### **5. Redaction & Retention (Phase 7.28/7.31)**
- **Purpose:** Safe-by-default PII redaction for exports
- **Location:** `backend/app/intelligence/redaction.py`, `backend/app/intelligence/pii_scanner.py`
- **Features:**
  - Allowlist-based field redaction
  - PII pattern detection (email, phone, SSN)
  - Retention policy enforcement (30-90 days)

---

### 🤖 **Existing AI/Intelligence Workflows**

#### **1. Decision Intelligence Computation**
- **Entrypoint:** `POST /api/workflow/cases/{case_id}/intelligence/recompute`
- **Location:** `backend/app/intelligence/router.py` (line 465)
- **Process:**
  1. User triggers recompute (or auto-triggered by submission/evidence)
  2. `compute_decision_intelligence_v2()` calls AI service
  3. Result stored in `decision_intelligence` table
  4. **Snapshot written to `intelligence_history`** (line 492)
  5. Audit event created in `audit_events`
- **Trigger Types:** `manual`, `submission`, `evidence`, `request_info`
- **Actor Roles:** `admin`, `reviewer`, `verifier`, `system`

#### **2. Intelligence History Endpoint**
- **Entrypoint:** `GET /api/workflow/cases/{case_id}/intelligence/history`
- **Location:** `backend/app/intelligence/router.py` (line 745)
- **Purpose:** Retrieve historical snapshots from `intelligence_history`
- **Returns:** List of `IntelligenceHistoryEntry` with confidence trends over time

#### **3. Intelligence Diff Endpoint**
- **Entrypoint:** `GET /api/workflow/cases/{case_id}/intelligence/diff`
- **Location:** `backend/app/intelligence/router.py` (line 612)
- **Purpose:** Compare two intelligence snapshots for confidence changes

#### **4. Audit Export Endpoint (Phase 7.22)**
- **Entrypoint:** `GET /api/workflow/cases/{case_id}/intelligence/audit-export`
- **Location:** `backend/app/intelligence/router.py` (line 882)
- **Features:**
  - Cryptographically signed JSON export
  - Role-based redaction (safe mode vs full access)
  - Evidence snapshot included
  - HMAC signature in `_signature_metadata`

---

### 🗄️ **Database Infrastructure**

- **ORM:** SQLModel + SQLAlchemy (SQLite dev, PostgreSQL prod)
- **Database File (dev):** `backend/data/autocomply.db`
- **Migrations:** Manual SQL scripts in `backend/scripts/migrate_*.py`
- **Test DB:** In-memory SQLite via `backend/src/data/database.py`
- **Query Helpers:** `execute_sql()`, `execute_delete()` in `backend/src/data/database.py`

---

### 🧪 **Test Coverage**

- **Intelligence History:** 75+ tests across 5 test files
  - `test_phase7_11_intelligence_history.py`
  - `test_phase7_17_intelligence_history.py`
  - `test_phase7_20_audit_integrity.py`
  - `test_phase7_24_evidence_snapshot.py`
  - `test_phase7_33_request_id.py`
- **Request ID Middleware:** 12+ tests in `test_phase7_33_request_id.py`
- **Audit Signing:** 8+ tests in `test_phase7_26_audit_signing.py`
- **Redaction:** 7+ tests in `test_phase7_28_retention_redaction.py`

---

## 🚀 WHAT WE WILL ADD (NO DUPLICATION)

### **1. Lightweight Trace Schema (EXTEND intelligence_history)**

**NEW COLUMNS for `intelligence_history`:**
```sql
ALTER TABLE intelligence_history ADD COLUMN trace_id TEXT;  -- Global trace ID
ALTER TABLE intelligence_history ADD COLUMN parent_span_id TEXT;  -- For hierarchical spans
ALTER TABLE intelligence_history ADD COLUMN span_name TEXT;  -- Operation name
ALTER TABLE intelligence_history ADD COLUMN span_kind TEXT;  -- 'internal', 'ai_call', 'db_query', etc.
ALTER TABLE intelligence_history ADD COLUMN duration_ms INTEGER;  -- Execution time
ALTER TABLE intelligence_history ADD COLUMN error TEXT;  -- Error message if failed
ALTER TABLE intelligence_history ADD COLUMN metadata_json TEXT;  -- Flexible trace metadata
```

**WHY EXTEND instead of creating new `traces` table:**
- ✅ Reuse existing audit infrastructure (insert, retrieve, retention)
- ✅ Preserve chronological ordering with `computed_at`
- ✅ Maintain integrity chain with `previous_run_id`
- ✅ Avoid JOIN hell (trace + audit data already co-located)
- ✅ Single source of truth for "what happened when"

### **2. TraceContext Utility (Python)**

**Location:** `backend/app/trace/context.py` (NEW MODULE)

```python
class TraceContext:
    """
    Thread-local trace context for propagating trace_id/parent_span_id.
    
    Usage:
        with TraceContext.start_span("ai_call", metadata={"model": "gpt-4"}):
            result = call_openai(...)
            # Automatically records span to intelligence_history
    """
    
    @classmethod
    def start_span(cls, span_name: str, span_kind: str = "internal", metadata: dict = None):
        # Context manager for auto-timing + recording
        pass
    
    @classmethod
    def get_current_trace_id(cls) -> str | None:
        # Retrieve trace_id from thread-local storage
        pass
    
    @classmethod
    def record_span(cls, span_name: str, duration_ms: int, error: str = None, metadata: dict = None):
        # Write span to intelligence_history
        pass
```

### **3. Instrument ONE Workflow (Pilot)**

**Target:** `POST /api/workflow/cases/{case_id}/intelligence/recompute`

**Instrumentation Points:**
1. **Span 1:** `recompute_request` (parent) - Full HTTP request lifecycle
2. **Span 2:** `fetch_case_data` (child) - DB query for case/submission/evidence
3. **Span 3:** `ai_inference` (child) - OpenAI/Gemini API call
4. **Span 4:** `save_intelligence` (child) - Write to `decision_intelligence` + `intelligence_history`

**Why this workflow:**
- ✅ Most critical AI operation (intelligence recompute)
- ✅ Already has audit trail (`intelligence_history`)
- ✅ Triggers from multiple sources (manual, submission, evidence)
- ✅ Has existing tests (`test_phase7_11_intelligence_history.py`)

### **4. Basic Traces API Endpoint**

**Endpoint:** `GET /api/traces?case_id={case_id}&limit=50`

**Query:** Simple read from `intelligence_history` where `trace_id IS NOT NULL`

**Response:**
```json
{
  "traces": [
    {
      "trace_id": "uuid-123",
      "request_id": "req-456",
      "case_id": "case_789",
      "spans": [
        {
          "span_id": "uuid-abc",
          "parent_span_id": null,
          "span_name": "recompute_request",
          "span_kind": "internal",
          "computed_at": "2026-01-24T10:00:00Z",
          "duration_ms": 1250,
          "error": null,
          "metadata": {"trigger": "manual", "actor_role": "admin"}
        },
        {
          "span_id": "uuid-def",
          "parent_span_id": "uuid-abc",
          "span_name": "ai_inference",
          "span_kind": "ai_call",
          "computed_at": "2026-01-24T10:00:00.800Z",
          "duration_ms": 800,
          "error": null,
          "metadata": {"model": "gpt-4", "tokens": 1500}
        }
      ]
    }
  ]
}
```

---

## 📋 KEY POINTERS FOR PHASE 1 IMPLEMENTATION

### **Files to Modify:**
- `backend/app/intelligence/repository.py` - Add `insert_trace_span()` helper
- `backend/app/intelligence/router.py` (line 465) - Instrument recompute endpoint
- `backend/src/api/main.py` - Register new traces router
- `backend/scripts/migrate_add_trace_fields.py` - NEW migration script

### **Files to Create:**
- `backend/app/trace/__init__.py` - NEW module
- `backend/app/trace/context.py` - TraceContext utility
- `backend/app/trace/router.py` - Traces API endpoint
- `backend/tests/test_phase8_01_trace.py` - NEW test file

### **DO NOT Touch:**
- `backend/app/middleware/request_id.py` - Already working, reuse `request.state.request_id`
- `backend/app/intelligence/signing.py` - Reuse for trace signing if needed
- `backend/app/intelligence/redaction.py` - Reuse for trace redaction
- `backend/app/workflow/router.py` - Keep audit_events separate (no merge)

### **OpenTelemetry Deferral:**
- **Decision:** Implement custom JSON traces first, defer OTEL integration (see `docs/decision-log.md`)
- **Rationale:** Minimize risk, reuse existing patterns, OTEL can be added later as optional exporter
- **Future:** If OTEL needed, write adapter to convert `intelligence_history` spans to OTEL format

---

## 🚨 DEFERRED WORK (ADD TO PARKING LOT)

1. **Multi-Workflow Instrumentation** (P2) - Extend to other endpoints after pilot success
2. **Trace UI Dashboard** (P2) - React component for visualizing traces
3. **Trace Search/Filtering** (P2) - Advanced query by date range, error status, duration
4. **OTEL Exporter** (P3) - Optional bridge to Jaeger/Zipkin/DataDog
5. **Trace Sampling** (P3) - Only record 1% of traces in production
6. **Trace Metrics** (P3) - Aggregate span durations into analytics (p50, p95, p99)

---

## ✅ PHASE 0 COMPLETE

**Next Step:** Phase 1 - Implement trace schema + TraceContext + instrument recompute endpoint + basic traces API

**Commit this audit report:**
```bash
git add docs/PHASE_0_AUDIT.md
git commit -m "docs: Phase 0 repo audit for enterprise trace observability"
```
