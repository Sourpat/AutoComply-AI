# PHASE 7.1 — Signal Intelligence Schema & Backend

**Status:** ✅ Complete  
**Date:** January 15, 2026  
**Author:** AutoComply AI Dev Team

---

## Overview

Phase 7.1 introduces **Signal Intelligence** - a backend capability for collecting, analyzing, and reporting on case decision quality metrics. The system captures signals from multiple sources (submissions, evidence, RAG traces, case events) and computes decision intelligence metrics including completeness, gaps, bias detection, and confidence scoring.

---

## Database Schema

### `signals` Table

Stores individual data points collected during case processing.

```sql
CREATE TABLE signals (
    id TEXT PRIMARY KEY NOT NULL,
    case_id TEXT NOT NULL,
    decision_type TEXT NOT NULL,
    source_type TEXT NOT NULL,  -- submission, evidence, rag_trace, case_event
    timestamp TEXT NOT NULL,    -- ISO 8601 format (UTC)
    signal_strength REAL DEFAULT 1.0,
    completeness_flag INTEGER DEFAULT 0,  -- 0 = incomplete, 1 = complete
    metadata_json TEXT DEFAULT '{}',
    created_at TEXT NOT NULL,
    FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE
);
```

**Indexes:**
- `idx_signals_case_id` - Fast case lookups
- `idx_signals_case_id_timestamp` - Chronological ordering
- `idx_signals_source_type` - Filter by source
- `idx_signals_decision_type` - Filter by decision type

### `decision_intelligence` Table

Stores computed intelligence metrics for each case.

```sql
CREATE TABLE decision_intelligence (
    case_id TEXT PRIMARY KEY NOT NULL,
    computed_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    completeness_score INTEGER NOT NULL,  -- 0-100
    gap_json TEXT DEFAULT '[]',           -- JSON array of gaps
    bias_json TEXT DEFAULT '[]',          -- JSON array of bias flags
    confidence_score INTEGER NOT NULL,    -- 0-100
    confidence_band TEXT NOT NULL,        -- high, medium, low
    narrative_template TEXT NOT NULL,
    narrative_genai TEXT,                 -- Optional GenAI narrative
    FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE
);
```

**Indexes:**
- `idx_decision_intelligence_computed_at` - Sort by computation time
- `idx_decision_intelligence_confidence_band` - Filter by confidence level

---

## Migration

**Script:** `backend/scripts/migrate_add_signal_intelligence.py`

**Usage:**
```bash
cd backend
.venv/Scripts/python scripts/migrate_add_signal_intelligence.py
```

**Features:**
- Idempotent (safe to run multiple times)
- Creates both tables and all indexes
- Validates schema before attempting creation

---

## Backend Implementation

### Module Structure

```
backend/app/intelligence/
├── __init__.py
├── models.py          # Pydantic models
├── repository.py      # Database operations
└── router.py          # API endpoints
```

### Pydantic Models

**`Signal`** - Individual signal data point
```python
{
    "id": "sig_abc123",
    "case_id": "case_xyz",
    "decision_type": "csf_practitioner",
    "source_type": "submission",
    "timestamp": "2026-01-15T10:30:00Z",
    "signal_strength": 1.0,
    "completeness_flag": 1,
    "metadata_json": "{\"field\": \"license_number\"}"
}
```

**`DecisionIntelligence`** - Computed intelligence
```python
{
    "case_id": "case_xyz",
    "computed_at": "2026-01-15T10:35:00Z",
    "completeness_score": 85,
    "gap_json": "[\"Missing employer verification\"]",
    "confidence_score": 80,
    "confidence_band": "high",
    "narrative_template": "Case has 85% completeness..."
}
```

### Repository Functions

**`upsert_signals(case_id, signals)`**
- Insert signals for a case
- Returns list of signal IDs
- Batch operation for efficiency

**`get_signals(case_id, source_type=None, limit=100)`**
- Retrieve signals for a case
- Optional filtering by source type
- Ordered by timestamp descending

**`compute_and_upsert_decision_intelligence(case_id)`**
- Aggregate signals
- Compute completeness, gaps, confidence
- Generate narrative template
- Upsert intelligence record
- Returns DecisionIntelligence object

**`get_decision_intelligence(case_id)`**
- Retrieve computed intelligence
- Returns None if not computed

### Intelligence Algorithm

**Completeness Score:**
```
completeness_score = (complete_signals / total_signals) * 100
```

**Confidence Score:**
```
confidence_score = completeness_score * average_signal_strength
```

**Confidence Band:**
- **High:** ≥ 80%
- **Medium:** 50-79%
- **Low:** < 50%

**Gap Detection:**
- Identify signals with `completeness_flag = 0`
- Extract description from metadata
- Return as JSON array

**Bias Detection:**
- Placeholder for future implementation
- Returns empty array currently

---

## API Endpoints

### GET `/workflow/cases/{caseId}/intelligence`

Get decision intelligence for a case.

**Auth:** Any role with case access  
**Auto-compute:** If not computed, automatically computes on first access

**Response:**
```json
{
    "case_id": "case_xyz",
    "computed_at": "2026-01-15T10:35:00Z",
    "updated_at": "2026-01-15T10:35:00Z",
    "completeness_score": 85,
    "gaps": ["Missing employer verification"],
    "bias_flags": [],
    "confidence_score": 80,
    "confidence_band": "high",
    "narrative": "Case has 85% completeness with 1 gap. Confidence: high (80%).",
    "narrative_genai": null
}
```

### POST `/workflow/cases/{caseId}/intelligence/recompute`

Recompute decision intelligence (admin/devsupport only).

**Auth:** Admin or devsupport role required  
**Side Effects:** Emits `decision_intelligence_updated` case event

**Request:**
```json
{
    "force": true
}
```

**Response:** Same as GET endpoint

**Case Event Emitted:**
```json
{
    "event_type": "decision_intelligence_updated",
    "actor_role": "admin",
    "message": "Decision intelligence recomputed: high confidence",
    "payload_json": {
        "completeness_score": 85,
        "confidence_score": 80,
        "confidence_band": "high",
        "gap_count": 1,
        "bias_count": 0
    }
}
```

---

## Integration Points

### 1. Workflow Events
- Case events can emit signals to track verifier actions
- Signal strength can indicate action importance

### 2. Submission Processing
- Emit signals for required fields present/missing
- Track completeness of submission data

### 3. Evidence Collection
- Signal for each evidence item added
- Track evidence quality and relevance

### 4. RAG Traces
- Signal for RAG retrieval confidence
- Track regulatory citation availability

---

## Testing

**Test Suite:** `backend/tests/test_signal_intelligence.py`

**Coverage:**
- ✅ Schema validation (tables, columns, indexes)
- ✅ Signal insertion and retrieval
- ✅ Intelligence computation with various scenarios
- ✅ Confidence band calculation
- ✅ API endpoint integration
- ✅ Role-based access control
- ✅ Edge cases (custom timestamps, narrative generation)

**Run Tests:**
```bash
cd backend
pytest tests/test_signal_intelligence.py -v
```

**Expected Results:**
- 15+ test cases
- 100% pass rate
- Coverage of all repo functions and endpoints

---

## Usage Examples

### Example 1: Emit Signals During Submission

```python
from app.intelligence.repository import upsert_signals

signals = [
    {
        "decision_type": "csf_practitioner",
        "source_type": "submission",
        "completeness_flag": 1 if license_number else 0,
        "metadata_json": json.dumps({
            "field": "license_number",
            "present": bool(license_number)
        })
    }
]

upsert_signals(case_id, signals)
```

### Example 2: Compute Intelligence

```python
from app.intelligence.repository import compute_and_upsert_decision_intelligence

intelligence = compute_and_upsert_decision_intelligence(case_id)
print(f"Confidence: {intelligence.confidence_band} ({intelligence.confidence_score}%)")
print(f"Gaps: {json.loads(intelligence.gap_json)}")
```

### Example 3: API Call (Frontend)

```typescript
// Get intelligence
const response = await fetch(
    `/workflow/cases/${caseId}/intelligence`,
    {
        headers: { 'X-User-Role': 'verifier' }
    }
);
const intelligence = await response.json();

console.log(`Completeness: ${intelligence.completeness_score}%`);
console.log(`Gaps: ${intelligence.gaps.join(', ')}`);
```

---

## Future Enhancements

### Phase 7.2 - Advanced Intelligence
- **Bias Detection:** Implement ML-based bias detection
- **Trend Analysis:** Track intelligence over time
- **Predictive Scoring:** Predict case outcomes based on signals
- **GenAI Narratives:** Use LLM to generate human-readable explanations

### Phase 7.3 - Frontend Visualization
- Intelligence dashboard widget
- Gap visualization and remediation guidance
- Confidence meter in case header
- Signal timeline view

### Phase 7.4 - Automation
- Auto-trigger verification when confidence < threshold
- Automated gap remediation suggestions
- Smart case routing based on intelligence

---

## Dependencies

- **SQLAlchemy:** Database operations
- **FastAPI:** API endpoints
- **Pydantic:** Data validation
- **Pytest:** Testing framework

---

## Deployment Checklist

- [x] Schema added to `app/workflow/schema.sql`
- [x] Migration script created and tested
- [x] Repository functions implemented
- [x] Pydantic models defined
- [x] API endpoints added to router
- [x] Router registered in `src/api/main.py`
- [x] Tests written and passing
- [x] Documentation complete

---

## Performance Considerations

**Signal Volume:**
- Index on `case_id` enables fast case lookups
- Limit query to 100 signals by default
- Timestamp index supports chronological ordering

**Computation:**
- Intelligence computed on-demand (lazy evaluation)
- Cached in `decision_intelligence` table
- Recompute only when forced or stale

**API Response Time:**
- GET endpoint: < 50ms (cached)
- POST recompute: < 200ms (with 100 signals)

---

## Security Notes

- **Recompute Endpoint:** Admin/devsupport only (prevents abuse)
- **Case Event Emission:** Audit trail for all intelligence updates
- **SQL Injection:** All queries use parameterized statements
- **Data Privacy:** Metadata JSON allows flexible data capture without PII exposure

---

## Summary

Phase 7.1 establishes the foundation for intelligent case decision support. By capturing signals from multiple sources and computing actionable metrics, the system can provide real-time feedback to verifiers, identify gaps early, and improve decision quality.

**Next Steps:** Phase 7.2 will add advanced analytics and ML-based insights, while Phase 7.3 will expose these capabilities to the frontend UI.

---

**Questions?** Contact the AutoComply AI dev team or file an issue in the repository.
