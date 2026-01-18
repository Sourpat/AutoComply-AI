# PHASE 7.2: Decision Intelligence v2

**Status:** ✅ COMPLETE  
**Date:** 2026-01-15  
**Focus:** Gap Detection + Bias Checks + Confidence Scoring v2

---

## Overview

PHASE 7.2 upgrades Decision Intelligence from basic signal aggregation to advanced gap/bias detection with explainable confidence scoring. This phase builds on PHASE 7.1B's signal generator to provide actionable insights into case quality.

### Key Enhancements

1. **Gap Detection** - Identifies 4 gap types (missing, partial, weak, stale signals)
2. **Bias Detection** - Flags 4 bias patterns (single-source, low diversity, contradictions, stale)
3. **Confidence v2** - Weighted scoring with gap/bias penalties and transparency
4. **Explainability** - Breakdown of confidence score factors for audit trails

### Implementation Approach

- **100% Heuristic-based** - No ML, fully deterministic
- **Configurable Expectations** - Define required signals per decision type
- **Backwards Compatible** - Extends existing intelligence schema
- **API-driven** - RESTful endpoints with structured responses

---

## Architecture

### Modules Created

```
backend/app/intelligence/
├── expectations.py       # Expected signals by decision type (NEW)
├── bias.py               # Bias detection heuristics (NEW)
├── scoring.py            # Confidence v2 scoring (NEW)
├── repository.py         # Updated with gap/bias logic (MODIFIED)
├── models.py             # Updated response models (MODIFIED)
└── router.py             # Updated endpoints (MODIFIED)
```

### Data Flow

```
1. Generate Signals (7.1B)
   ↓
2. Retrieve Expected Signals (expectations.py)
   ↓
3. Detect Gaps (repository.py)
   - Compare expected vs actual
   - Flag: missing, partial, weak, stale
   ↓
4. Detect Bias (bias.py)
   - Single-source reliance check
   - Diversity check
   - Contradiction detection
   - Staleness check
   ↓
5. Compute Confidence v2 (scoring.py)
   - Base score = Σ(weight × strength × completeness)
   - Gap penalties
   - Bias penalties
   - Clamp to 0-100
   ↓
6. Generate Explanation Factors
   ↓
7. Upsert to DB + Return API Response
```

---

## Gap Detection

### Gap Types

| Gap Type | Severity | Description | Example |
|----------|----------|-------------|---------|
| **Missing** | High | Required signal not present | CSF case without evidence_present |
| **Partial** | Medium | Signal has `completeness_flag=0` | Submission incomplete (50% credit) |
| **Weak** | Low-Medium | Signal strength below expected threshold | evidence_present=0.3 (expected 1.0) |
| **Stale** | Low | Signal older than `max_age_hours` | 80-hour old signal (max 72h) |

### Expected Signals Configuration

Defined in [`expectations.py`](../backend/app/intelligence/expectations.py):

```python
EXPECTED_SIGNALS_BY_DECISION_TYPE = {
    "csf": [
        SignalExpectation("submission_present", required=True, min_strength=1.0),
        SignalExpectation("submission_completeness", required=True, min_strength=0.5),
        SignalExpectation("evidence_present", required=True, min_strength=1.0),
        SignalExpectation("request_info_open", required=False, min_strength=0.0),
        SignalExpectation("submitter_responded", required=False, min_strength=0.0),
        SignalExpectation("explainability_available", required=False, min_strength=0.5),
    ],
    # ... other decision types
}
```

### Gap Severity Score

Formula:
```
gap_weight = (
    missing_count × 0.3 +
    partial_count × 0.2 +
    weak_count × 0.1 +
    stale_count × 0.05
)
gap_severity_score = min(100, 100 × gap_weight / (1 + gap_weight))
```

Example:
- 2 missing, 1 partial → gap_severity_score = 44

---

## Bias Detection

### Bias Types

| Bias Type | Severity | Threshold | Description |
|-----------|----------|-----------|-------------|
| **Single-Source Reliance** | Medium-High | >70% | >70% signal strength from one source_type |
| **Low Diversity** | Low-Medium | <3 sources | Fewer than 3 unique source types |
| **Contradiction** | Medium | N/A | Conflicting signals (e.g., request_info_open + submitter_responded) |
| **Stale Signals** | Low | >72h | Signals older than 72 hours |

### Detection Algorithms

Implemented in [`bias.py`](../backend/app/intelligence/bias.py):

#### 1. Single-Source Reliance
```python
def detect_single_source_reliance(signals, threshold=0.7):
    # Calculate total strength per source_type
    # Flag if any source > 70%
    ratio = source_strength / total_strength
    if ratio > 0.85:
        severity = "high"
    elif ratio > 0.7:
        severity = "medium"
```

#### 2. Low Diversity
```python
def detect_low_diversity(signals, min_sources=3):
    unique_sources = set(signal["source_type"] for signal in signals)
    if len(unique_sources) < min_sources:
        # Flag with severity based on how far below threshold
```

#### 3. Contradictions
Detects 3 patterns:
- Request for info open + submitter already responded
- Submission absent (strength=0) but completeness>0
- Evidence absent but evidence_count>0 in metadata

#### 4. Stale Signals
```python
def detect_stale_signals(signals, max_age_hours=72):
    # Flag signals older than 72 hours
    # Severity: low (always)
```

---

## Confidence Scoring v2

### Signal Weights

From [`scoring.py`](../backend/app/intelligence/scoring.py):

```python
SIGNAL_WEIGHTS = {
    "submission_present": 20.0,        # Critical
    "submission_completeness": 25.0,   # Critical
    "evidence_present": 20.0,          # Important
    "request_info_open": 10.0,         # Moderate
    "submitter_responded": 10.0,       # Moderate
    "explainability_available": 15.0,  # Important
}
```

### Scoring Algorithm

```
Base Score = Σ (weight × strength × completeness_multiplier)
  where completeness_multiplier = 1.0 if complete, 0.5 if partial

Gap Penalty = Σ (penalty × severity_multiplier)
  - Missing: 15 points × severity
  - Partial: 10 points × severity
  - Weak: 5 points × severity
  - Stale: 3 points × severity
  - Severity multiplier: high=1.5, medium=1.0, low=0.5

Bias Penalty = Σ (penalty by severity)
  - High: 15 points
  - Medium: 10 points
  - Low: 5 points

Final Score = max(0, min(100, Base - Gap Penalty - Bias Penalty))
```

### Confidence Bands

| Score | Band | Description |
|-------|------|-------------|
| 75-100 | **High** | Strong confidence, minimal gaps/bias |
| 50-74 | **Medium** | Moderate confidence, some gaps/bias |
| 0-49 | **Low** | Weak confidence, significant gaps/bias |

### Explanation Factors

Example:
```json
{
  "explanation_factors": [
    {
      "factor": "base_signal_score",
      "impact": 65.0,
      "detail": "Weighted sum of 3 signals"
    },
    {
      "factor": "submission_present_signal",
      "impact": 20.0,
      "detail": "Signal strength 1.0 × weight 20.0 × completeness 1.0"
    },
    {
      "factor": "gap_penalties",
      "impact": -15.0,
      "detail": "Gaps: 1 missing, 0 partial, 0 weak, 0 stale"
    },
    {
      "factor": "bias_penalties",
      "impact": -10.0,
      "detail": "Bias flags: 0 high, 1 medium, 0 low severity"
    },
    {
      "factor": "final_confidence",
      "impact": 40.0,
      "detail": "LOW confidence band"
    }
  ]
}
```

---

## API Reference

### GET /workflow/cases/{caseId}/intelligence

Retrieve decision intelligence v2 for a case.

**Query Parameters:**
- `decision_type` (optional): Decision type for gap expectations (default: "default")

**Response:**
```json
{
  "case_id": "case_123",
  "computed_at": "2026-01-15T10:30:00Z",
  "updated_at": "2026-01-15T10:30:00Z",
  "completeness_score": 67,
  "gaps": [
    {
      "gapType": "missing",
      "severity": "high",
      "signalType": "evidence_present",
      "message": "Required signal 'evidence_present' is missing",
      "expectedThreshold": 1.0
    }
  ],
  "gap_severity_score": 42,
  "bias_flags": [
    {
      "flagType": "low_diversity",
      "severity": "medium",
      "message": "Only 2 unique source types",
      "suggestedAction": "Collect signals from additional sources",
      "metadata": {"unique_sources": 2, "expected_min": 3}
    }
  ],
  "confidence_score": 48.5,
  "confidence_band": "low",
  "narrative": "Case has 67% completeness with 1 gap(s) and 1 bias flag(s). Confidence: low (48.5%).",
  "narrative_genai": null,
  "explanation_factors": [...]
}
```

### POST /workflow/cases/{caseId}/intelligence/recompute

Recompute decision intelligence (admin/devsupport only).

**Query Parameters:**
- `decision_type` (optional): Decision type for gap expectations

**Behavior:**
1. Generates signals from case artifacts (PHASE 7.1B)
2. Upserts signals to DB
3. Detects gaps and bias
4. Computes confidence v2
5. Emits case event

**Authorization:**
- Roles: `admin`, `devsupport`

---

## Testing

### Unit Tests

Location: [`tests/test_phase7_2_intelligence_v2.py`](../backend/tests/test_phase7_2_intelligence_v2.py)

**Coverage:**
- ✅ Expected signals configuration (3 tests)
- ✅ Bias detection (8 tests)
  - Single-source reliance (high/ok)
  - Low diversity (flagged/ok)
  - Contradictions (3 scenarios)
  - Stale signals
  - Combined detection
- ✅ Confidence scoring v2 (9 tests)
  - Confidence bands
  - Signal weights
  - Perfect case
  - Gap penalties
  - Bias penalties
  - Partial completeness
  - Weak signals
  - Comprehensive scenario

**Results:**
```
20 tests passed, 0 failed
```

### Smoke Test

Location: [`scripts/smoke_phase7_2_intelligence_v2.py`](../backend/scripts/smoke_phase7_2_intelligence_v2.py)

**Run:**
```bash
python backend/scripts/smoke_phase7_2_intelligence_v2.py
```

**Demonstrates:**
1. Expected signals by decision type
2. Gap detection (4 scenarios)
3. Bias detection (4 scenarios)
4. Confidence v2 scoring (4 scenarios)
5. API response structure

---

## Database Schema

No schema changes required. Uses existing `decision_intelligence` table:

```sql
CREATE TABLE decision_intelligence (
    case_id TEXT PRIMARY KEY,
    computed_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    completeness_score INTEGER NOT NULL,
    gap_json TEXT DEFAULT '[]',         -- ✓ Already exists (7.1A)
    bias_json TEXT DEFAULT '[]',        -- ✓ Already exists (7.1A)
    confidence_score INTEGER NOT NULL,
    confidence_band TEXT NOT NULL,
    narrative_template TEXT,
    narrative_genai TEXT
);
```

**New JSON Structures:**

**`gap_json`** (was string array, now structured):
```json
[
  {
    "gapType": "missing",
    "severity": "high",
    "signalType": "evidence_present",
    "message": "Required signal 'evidence_present' is missing",
    "expectedThreshold": 1.0
  }
]
```

**`bias_json`** (was empty array, now populated):
```json
[
  {
    "flagType": "low_diversity",
    "severity": "medium",
    "message": "Only 2 unique source types",
    "suggestedAction": "Collect signals from additional sources",
    "metadata": {"unique_sources": 2, "expected_min": 3}
  }
]
```

---

## Configuration

### Adjustable Parameters

In [`scoring.py`](../backend/app/intelligence/scoring.py):

```python
# Signal weights (adjust based on domain expertise)
SIGNAL_WEIGHTS = {...}

# Gap penalties
GAP_PENALTY_PER_MISSING = 15.0
GAP_PENALTY_PER_PARTIAL = 10.0
GAP_PENALTY_PER_WEAK = 5.0
GAP_PENALTY_PER_STALE = 3.0

# Bias penalties
BIAS_PENALTY_LOW = 5.0
BIAS_PENALTY_MEDIUM = 10.0
BIAS_PENALTY_HIGH = 15.0
```

In [`bias.py`](../backend/app/intelligence/bias.py):

```python
# Bias thresholds
SINGLE_SOURCE_THRESHOLD = 0.7  # 70%
MIN_DIVERSITY_SOURCES = 3
MAX_SIGNAL_AGE_HOURS = 72
```

---

## Usage Examples

### Scenario 1: Reviewing Case Intelligence

```python
import requests

response = requests.get(
    "http://localhost:8001/workflow/cases/case_123/intelligence",
    params={"decision_type": "csf"}
)

intelligence = response.json()

# Check gaps
if intelligence["gaps"]:
    print(f"⚠️ {len(intelligence['gaps'])} gap(s) detected:")
    for gap in intelligence["gaps"]:
        print(f"  - {gap['gapType']}: {gap['message']}")

# Check bias
if intelligence["bias_flags"]:
    print(f"⚠️ {len(intelligence['bias_flags'])} bias flag(s):")
    for bias in intelligence["bias_flags"]:
        print(f"  - {bias['flagType']}: {bias['message']}")

# Check confidence
print(f"Confidence: {intelligence['confidence_band'].upper()} ({intelligence['confidence_score']}%)")
```

### Scenario 2: Recomputing After Evidence Upload

```python
# Admin recomputes intelligence after submitter uploads new evidence
response = requests.post(
    "http://localhost:8001/workflow/cases/case_123/intelligence/recompute",
    params={"decision_type": "csf"},
    headers={"Authorization": "Bearer <admin_token>"}
)

# Check if gaps reduced
intelligence = response.json()
print(f"Gap severity: {intelligence['gap_severity_score']}/100")
print(f"New confidence: {intelligence['confidence_score']}%")
```

### Scenario 3: Auditing Confidence Factors

```python
# Reviewer examines why confidence is low
intelligence = ...

for factor in intelligence["explanation_factors"]:
    if factor["impact"] < 0:
        print(f"❌ {factor['factor']}: {factor['impact']:.1f} - {factor['detail']}")
    else:
        print(f"✅ {factor['factor']}: +{factor['impact']:.1f} - {factor['detail']}")
```

---

## Decision Type Mappings

| Decision Type | Expected Signals | Required | Notes |
|---------------|------------------|----------|-------|
| `csf` | 6 signals | 3 required | Includes evidence_present, explainability |
| `csf_practitioner` | 6 signals | 3 required | Same as csf |
| `csf_facility` | 6 signals | 3 required | Same as csf |
| `csa` | 6 signals | 3 required | Same as csf |
| `license_renewal` | 3 signals | 3 required | Minimal set (submission + evidence) |
| `export_permit` | 3 signals | 3 required | Same as license_renewal |
| `default` | 3 signals | 2 required | Fallback for unknown types |

---

## Performance Considerations

### Computational Complexity

- **Gap Detection:** O(E × S) where E = expected signals, S = actual signals
- **Bias Detection:** O(S) for all checks
- **Confidence v2:** O(S + G + B) where G = gaps, B = bias flags

### Caching Strategy

Intelligence is:
- ✅ Computed on-demand (first GET)
- ✅ Recomputed explicitly (POST /recompute)
- ✅ Cached in DB (no re-computation unless requested)

### Recompute Triggers

Manual recompute recommended after:
- New submission uploaded
- Evidence attached
- Request for info resolved
- Case status change

---

## Limitations & Future Work

### Current Limitations

1. **Static Weights** - Signal weights are hardcoded (not ML-learned)
2. **No Temporal Decay** - All signals treated equally regardless of age (except stale flag)
3. **Simple Bias Checks** - Heuristic-based, may miss nuanced patterns
4. **No Cross-Case Learning** - Each case analyzed independently

### Potential Enhancements (Future Phases)

- **PHASE 7.3:** ML-based confidence scoring (train on historical decisions)
- **PHASE 7.4:** Real-time signal streaming (update intelligence on events)
- **PHASE 7.5:** Cross-case benchmarking (compare to similar cases)
- **PHASE 7.6:** Automated remediation (suggest actions to close gaps)

---

## Change Log

### v2.0 (PHASE 7.2) - 2026-01-15
- ✅ Added gap detection (missing, partial, weak, stale)
- ✅ Added bias detection (single-source, low diversity, contradictions, stale)
- ✅ Implemented confidence v2 (weighted, penalized, explainable)
- ✅ Created expectations module for decision type configuration
- ✅ Updated API responses with structured gaps/bias
- ✅ Added 20 unit tests (all passing)
- ✅ Created smoke test script
- ✅ Documentation complete

### v1.0 (PHASE 7.1B) - Previous
- Signal generator (6 signal types)
- Basic confidence scoring
- Completeness calculation

### v0.1 (PHASE 7.1A) - Previous
- Signal Intelligence schema
- Database tables
- Basic repository

---

## Support

For issues or questions:
- Check unit tests: `pytest tests/test_phase7_2_intelligence_v2.py -v`
- Run smoke test: `python backend/scripts/smoke_phase7_2_intelligence_v2.py`
- Review logs: Intelligence computation logs to `logger` in repository.py

---

**✅ PHASE 7.2 COMPLETE**

All objectives met:
- ✅ Gap detection with 4 gap types
- ✅ Bias detection with 4 bias checks
- ✅ Confidence v2 with weighted scoring and penalties
- ✅ Explainable factors for transparency
- ✅ Comprehensive tests (20/20 passing)
- ✅ Smoke test demonstrating all features
- ✅ Full documentation
