# PHASE 7.2 Quick Reference

## Summary
Decision Intelligence v2 with gap detection, bias checks, and explainable confidence scoring.

## What Was Built
- ✅ Gap detection (missing, partial, weak, stale signals)
- ✅ Bias detection (single-source, low diversity, contradictions, stale)
- ✅ Confidence v2 (weighted, penalized, explainable)
- ✅ 20 unit tests (all passing)
- ✅ Complete documentation

## Key Files

### New Modules
- `backend/app/intelligence/expectations.py` - Signal expectations by decision type
- `backend/app/intelligence/bias.py` - 4 bias detection functions
- `backend/app/intelligence/scoring.py` - Confidence v2 scoring
- `backend/tests/test_phase7_2_intelligence_v2.py` - 20 unit tests
- `backend/scripts/smoke_phase7_2_intelligence_v2.py` - Demo script

### Modified Modules
- `backend/app/intelligence/repository.py` - Gap detection integration
- `backend/app/intelligence/models.py` - Updated response models
- `backend/app/intelligence/router.py` - Updated endpoints

### Documentation
- `docs/PHASE_7_2_INTELLIGENCE_V2.md` - Full documentation
- `PHASE_7_2_SUMMARY.md` - Implementation summary

## API Usage

### Get Intelligence (v2)
```http
GET /workflow/cases/{caseId}/intelligence?decision_type=csf
```

**Response includes:**
- `gaps` - Structured gap objects (missing, partial, weak, stale)
- `gap_severity_score` - 0-100 gap severity
- `bias_flags` - Structured bias flag objects
- `confidence_score` - Weighted confidence (0-100)
- `explanation_factors` - Confidence breakdown

### Recompute Intelligence
```http
POST /workflow/cases/{caseId}/intelligence/recompute?decision_type=csf
```

**Requires:** admin or devsupport role

## Gap Types

| Type | Severity | Description |
|------|----------|-------------|
| `missing` | High | Required signal not present |
| `partial` | Medium | Signal incomplete (completeness_flag=0) |
| `weak` | Low | Signal strength below threshold |
| `stale` | Low | Signal older than max_age_hours |

## Bias Types

| Type | Threshold | Description |
|------|-----------|-------------|
| `single_source_reliance` | >70% | Too much from one source |
| `low_diversity` | <3 sources | Not enough unique sources |
| `contradiction` | N/A | Conflicting signals |
| `stale_signals` | >72h | Old signals |

## Confidence Scoring

### Formula
```
Base = Σ(weight × strength × completeness)
Penalties = gap_penalty + bias_penalty
Final = max(0, min(100, Base - Penalties))
```

### Signal Weights
- submission_present: 20
- submission_completeness: 25
- evidence_present: 20
- request_info_open: 10
- submitter_responded: 10
- explainability_available: 15

### Penalties
- Missing gap: -15 points (× severity)
- Partial gap: -10 points
- Weak gap: -5 points
- Stale gap: -3 points
- High bias: -15 points
- Medium bias: -10 points
- Low bias: -5 points

### Bands
- **High**: 75-100
- **Medium**: 50-74
- **Low**: 0-49

## Testing

### Run Unit Tests
```bash
pytest tests/test_phase7_2_intelligence_v2.py -v
```

**Expected:** 20 passed

### Run Smoke Test
```bash
python backend/scripts/smoke_phase7_2_intelligence_v2.py
```

**Demonstrates:**
- Expected signals by decision type
- Gap detection scenarios
- Bias detection scenarios
- Confidence v2 scoring
- API response structure

## Configuration

### Adjustable in `scoring.py`:
- `SIGNAL_WEIGHTS` - Signal importance
- `GAP_PENALTY_*` - Gap penalties
- `BIAS_PENALTY_*` - Bias penalties

### Adjustable in `bias.py`:
- `SINGLE_SOURCE_THRESHOLD` - Default 0.7 (70%)
- `MIN_DIVERSITY_SOURCES` - Default 3
- `MAX_SIGNAL_AGE_HOURS` - Default 72

### Adjustable in `expectations.py`:
- `EXPECTED_SIGNALS_BY_DECISION_TYPE` - Required signals per type
- `min_strength` - Minimum signal strength threshold
- `max_age_hours` - Maximum signal age

## Example Response

```json
{
  "case_id": "case_123",
  "confidence_score": 48.5,
  "confidence_band": "low",
  "gaps": [
    {
      "gapType": "missing",
      "severity": "high",
      "signalType": "evidence_present",
      "message": "Required signal 'evidence_present' is missing"
    }
  ],
  "gap_severity_score": 42,
  "bias_flags": [
    {
      "flagType": "low_diversity",
      "severity": "medium",
      "message": "Only 2 unique source types",
      "suggestedAction": "Collect signals from additional sources"
    }
  ],
  "explanation_factors": [
    {"factor": "base_signal_score", "impact": 60.0, "detail": "..."},
    {"factor": "gap_penalties", "impact": -8.5, "detail": "..."},
    {"factor": "bias_penalties", "impact": -3.0, "detail": "..."}
  ]
}
```

## Common Use Cases

### 1. Check Why Confidence is Low
```python
intelligence = get_intelligence(case_id)
for gap in intelligence["gaps"]:
    print(f"Gap: {gap['message']}")
```

### 2. Identify Bias in Signals
```python
for bias in intelligence["bias_flags"]:
    print(f"Bias: {bias['flagType']}")
    print(f"Action: {bias['suggestedAction']}")
```

### 3. Audit Confidence Calculation
```python
for factor in intelligence["explanation_factors"]:
    print(f"{factor['factor']}: {factor['impact']:+.1f}")
```

### 4. Recompute After Evidence Upload
```python
# Admin recomputes after submitter adds evidence
recompute_intelligence(case_id, decision_type="csf")
```

## Decision Types

- `csf` - Controlled Substance Form (6 expected signals, 3 required)
- `csf_practitioner` - Same as csf
- `csf_facility` - Same as csf
- `csa` - Same as csf
- `license_renewal` - License renewal (3 expected, 3 required)
- `export_permit` - Same as license_renewal
- `default` - Fallback (3 expected, 2 required)

## Status

✅ **COMPLETE** - All features implemented, tested, and documented

**Test Results:**
- 20/20 unit tests passing
- Smoke test successful
- 100% feature coverage

**Files Changed:**
- 4 new files (expectations, bias, scoring, tests)
- 3 modified files (repository, models, router)
- 2 docs (full docs, summary)
- 1 smoke test

**Total LOC:** ~1,050 (code) + 370 (tests) + 500+ (docs)

## Next Steps (Optional)

For future enhancement consideration:
- PHASE 7.3: ML-based confidence
- PHASE 7.4: Real-time intelligence updates
- PHASE 7.5: Cross-case benchmarking
- PHASE 7.6: Automated remediation

---

**Quick Links:**
- Full Documentation: `docs/PHASE_7_2_INTELLIGENCE_V2.md`
- Summary: `PHASE_7_2_SUMMARY.md`
- Tests: `backend/tests/test_phase7_2_intelligence_v2.py`
- Smoke Test: `backend/scripts/smoke_phase7_2_intelligence_v2.py`
