# PHASE 7.8 — Rule-Based Confidence V1

**Status**: ✅ COMPLETE

## Summary

Implemented deterministic, hard-coded rule-based confidence validation for all case types. Confidence is now computed from explicit validation rules with severity-based caps, providing transparent and explainable scoring.

---

## Implementation Overview

### Rule Engine Architecture

**New Module**: [app/intelligence/rules_engine.py](backend/app/intelligence/rules_engine.py) (720 lines)

**Core Components**:
1. **Rule**: Validation rule with id, title, severity, weight, check function, failure message
2. **RuleResult**: Result of evaluating a single rule
3. **RulePack**: Collection of rules for a specific case type
4. **RuleSeverity**: Enum (CRITICAL, MEDIUM, LOW)

**Confidence Algorithm**:
```python
# Base confidence
base_confidence = (rules_passed / rules_total) * 100

# Apply severity caps
if any_critical_failure:
    confidence = min(confidence, 40.0)  # Cap at 40%
if medium_failures >= 3:
    confidence = min(confidence, 70.0)  # Cap at 70%

# Minimum floor
confidence = max(confidence, 5.0)

# Band thresholds
# >= 80% = high
# 40-79% = medium
# < 40% = low
```

---

## Supported Case Types

### 1. CSF Practitioner (`csf_practitioner`)
**Total Rules**: 10 (3 critical, 4 medium, 3 low)

**Critical Rules** (must pass for approval):
- Practitioner name present
- License number present
- State valid (US state code)

**Medium Rules** (important):
- Medical specialty present
- Years of experience valid
- Practice address present
- Email valid format

**Low Rules** (nice to have):
- ZIP code valid format
- Phone number present
- DEA number present

---

### 2. CSF Facility (`csf_facility`)
**Total Rules**: 10 (3 critical, 5 medium, 2 low)

**Critical Rules**:
- Facility name present
- Facility license present
- State valid

**Medium Rules**:
- Facility address present
- Facility type present
- Facility capacity valid
- Medical director present
- Email valid format

**Low Rules**:
- ZIP code valid format
- Accreditation status present

---

### 3. CSF Generic (`csf`)
**Total Rules**: 8 (3 critical, 3 medium, 2 low)

**Critical Rules**:
- Applicant name present
- License number present
- State valid

**Medium Rules**:
- Address present
- Specialty/Type present
- Email valid format

**Low Rules**:
- ZIP code valid format
- Experience/Background present

---

### 4. CSA (` csa`)
**Total Rules**: 8 (3 critical, 3 medium, 2 low)

**Critical Rules**:
- Business name present
- Address present
- State valid

**Medium Rules**:
- Authorization type present
- Business purpose present
- Email valid format

**Low Rules**:
- ZIP code valid format
- Responsible person present

---

## API Response Format

### Updated DecisionIntelligenceResponse (Phase 7.8)

Added fields to existing response model (backward compatible):

```json
{
  "case_id": "abc-123",
  "confidence_score": 75.0,
  "confidence_band": "medium",
  "narrative": "Case passed 6/8 validation rules...",
  
  // Phase 7.8: New rule fields
  "rules_total": 8,
  "rules_passed": 6,
  "rules_failed_count": 2,
  "failed_rules": [
    {
      "rule_id": "csf_specialty_present",
      "title": "Specialty/Type Present",
      "severity": "medium",
      "message": "Specialty or facility type should be specified",
      "field_path": "specialty",
      "weight": 6
    },
    {
      "rule_id": "csf_experience_present",
      "title": "Experience/Background Present",
      "severity": "low",
      "message": "Experience or operational history is recommended",
      "field_path": "years_experience",
      "weight": 4
    }
  ],
  
  // Existing fields (unchanged)
  "gaps": [],
  "bias_flags": [],
  "explanation_factors": [],
  "is_stale": false
}
```

---

## Files Changed

### Backend (4 files)

#### 1. [backend/app/intelligence/rules_engine.py](backend/app/intelligence/rules_engine.py) **(NEW - 720 lines)**
Complete rule-based validation engine with:
- 4 case type rule packs (csf_practitioner, csf_facility, csf, csa)
- 36 total validation rules across all types
- Severity-based confidence caps
- Helper functions for email/zip/state validation

#### 2. [backend/app/intelligence/models.py](backend/app/intelligence/models.py)
Added to `DecisionIntelligenceResponse`:
```python
# Phase 7.8: Rule-based confidence details
rules_total: int = 0
rules_passed: int = 0
rules_failed_count: int = 0
failed_rules: List[Dict[str, Any]] = []
```

#### 3. [backend/app/intelligence/repository.py](backend/app/intelligence/repository.py)
Updated `compute_and_upsert_decision_intelligence()`:
- Import new rules engine: `from .rules_engine import evaluate_case, compute_confidence`
- Evaluate rules against submission data
- Extract failed rules for API response
- Build explanation_factors from rule summary

#### 4. [backend/app/intelligence/router.py](backend/app/intelligence/router.py)
Updated both GET and POST endpoints:
- Extract rule fields from intelligence data
- Include in DecisionIntelligenceResponse
- Enhanced case event with rule counts

### Tests (1 file)

#### 5. [backend/tests/test_phase7_8_rule_engine.py](backend/tests/test_phase7_8_rule_engine.py) **(NEW - 470 lines)**
**17 comprehensive tests** covering:
- Perfect submissions (100% confidence)
- Critical failures (cap at 40%)
- Medium failures (3+ cap at 70%)
- Partial submissions
- Confidence banding
- Severity caps
- API response structure
- Edge cases (empty payload, minimum floor)

**Test Results**: ✅ **17 passed**, 32 warnings, 0.15s

---

## Test Coverage

### Test Cases by Category

**CSF Practitioner** (4 tests):
- ✅ Perfect submission (100%)
- ✅ Missing critical field (<=40%)
- ✅ 3+ medium failures (<=70%)
- ✅ Rule structure validation

**CSF Facility** (2 tests):
- ✅ Perfect submission
- ✅ Missing license (critical)

**CSF Generic** (2 tests):
- ✅ Complete submission
- ✅ Partial submission

**CSA** (2 tests):
- ✅ Perfect submission
- ✅ Missing address (critical)

**Confidence Bands** (1 test):
- ✅ Band threshold verification

**Severity Caps** (2 tests):
- ✅ Critical failure caps at 40%
- ✅ 3+ medium failures cap at 70%

**API Response** (2 tests):
- ✅ Failed rules structure
- ✅ Rule summary structure

**Edge Cases** (2 tests):
- ✅ Empty payload
- ✅ Minimum 5% floor

---

## Example Scenarios

### Scenario 1: Perfect CSF Practitioner Submission

**Input**:
```json
{
  "name": "Dr. Jane Smith",
  "license_number": "MD-12345",
  "state": "CA",
  "specialty": "Pain Management",
  "years_experience": 10,
  "address": "123 Medical Plaza",
  "email": "dr.smith@medical.com",
  "zip": "90210",
  "phone": "555-1234",
  "dea_number": "BS1234563"
}
```

**Result**:
- Rules: 10/10 passed
- Confidence: 100.0%
- Band: high
- Failed rules: []

---

### Scenario 2: CSF Practitioner Missing Name (Critical)

**Input**:
```json
{
  "license_number": "MD-12345",
  "state": "CA",
  "specialty": "Pain Management",
  ...
}
```

**Result**:
- Rules: 9/10 passed (1 critical failure)
- Confidence: 40.0% (capped from 90%)
- Band: medium
- Failed rules:
  ```json
  [
    {
      "rule_id": "csf_prac_name_present",
      "title": "Practitioner Name Present",
      "severity": "critical",
      "message": "Practitioner name is required"
    }
  ]
  ```

---

### Scenario 3: CSF Practitioner with 3+ Medium Failures

**Input**:
```json
{
  "name": "Dr. Smith",
  "license_number": "MD-123",
  "state": "CA"
  // Missing: specialty, years_experience, address, email (4 medium failures)
}
```

**Result**:
- Rules: 6/10 passed
- Confidence: 60.0% (no critical, but would be 60%)
- Band: medium
- Failed rules: 4 (all medium severity)

---

## Severity Caps Explained

### Cap 1: Critical Failure => Max 40%

**Why**: Critical fields are mandatory for approval. If any critical validation fails, the case cannot achieve high confidence.

**Example**: Missing practitioner name drops confidence from 90% to 40%

---

### Cap 2: 3+ Medium Failures => Max 70%

**Why**: Multiple important field failures indicate significant data quality issues, even if critical fields are present.

**Example**: Missing specialty + experience + address + invalid email (4 medium failures) caps confidence at 70%

---

### Minimum Floor: 5%

**Why**: Prevents cases from showing 0% confidence, which looks broken in UI.

**Example**: Empty submission would be 0/10 = 0%, but shows 5% minimum

---

## Integration Points

### Repository Layer
```python
# app/intelligence/repository.py

from .rules_engine import evaluate_case, compute_confidence

# In compute_and_upsert_decision_intelligence():
submission_data = {}
if case and case.submissionId:
    submission = get_submission(case.submissionId)
    if submission:
        submission_data = submission.formData or {}

# Evaluate rules
rule_results = evaluate_case(decision_type, submission_data)
confidence_score, confidence_band, rule_summary = compute_confidence(rule_results)

# Extract failed rules for API
failed_rules_list = rule_summary.get("failed_rules", [])
```

### Router Layer
```python
# app/intelligence/router.py

# Extract rule fields from intelligence
try:
    if intelligence.executive_summary_json:
        exec_data = json.loads(intelligence.executive_summary_json)
        explanation_obj = exec_data.get("explanation_factors", {})
        rules_total = explanation_obj.get("total_rules", 0)
        rules_passed = explanation_obj.get("passed_rules", 0)
        rules_failed_count = explanation_obj.get("failed_rules", 0)
        rule_summary = explanation_obj.get("rule_summary", {})
        failed_rules = rule_summary.get("failed_rules", [])
except:
    pass

# Return in response
return DecisionIntelligenceResponse(
    ...,
    rules_total=rules_total,
    rules_passed=rules_passed,
    rules_failed_count=rules_failed_count,
    failed_rules=failed_rules
)
```

---

## Backward Compatibility

✅ **All existing fields preserved** in DecisionIntelligenceResponse  
✅ **New fields default to 0/[]** if not available  
✅ **No breaking changes** to existing API consumers  
✅ **Existing tests still pass** (27 Phase 7.5 + 12 Phase 7.7 tests)

---

## UI Integration (Future)

Frontend can now display:
1. **Rule Progress**: "Passed 6/8 rules" badge
2. **Failed Rules List**: Expandable panel showing:
   - Rule title
   - Severity badge (critical/medium/low)
   - Failure message
   - Affected field
3. **Confidence Explanation**: Tooltip showing caps applied

**Example UI Component**:
```tsx
<div className="rules-panel">
  <div className="rules-header">
    <span>Passed {rules_passed}/{rules_total} rules</span>
    <ConfidenceBadge score={confidence_score} band={confidence_band} />
  </div>
  
  {failed_rules.length > 0 && (
    <details className="failed-rules">
      <summary>Failed Rules ({failed_rules.length})</summary>
      {failed_rules.map(rule => (
        <div key={rule.rule_id} className={`rule-failure ${rule.severity}`}>
          <SeverityBadge severity={rule.severity} />
          <span className="rule-title">{rule.title}</span>
          <span className="rule-message">{rule.message}</span>
        </div>
      ))}
    </details>
  )}
</div>
```

---

## Verification

### Manual API Test

```powershell
# 1. Start backend
cd backend
.venv/Scripts/python -m uvicorn src.api.main:app --reload --host 127.0.0.1 --port 8001

# 2. Get intelligence (includes rule fields)
irm "http://127.0.0.1:8001/workflow/cases/{CASE_ID}/intelligence" | ConvertTo-Json -Depth 5

# 3. Verify response has new fields
# rules_total, rules_passed, rules_failed_count, failed_rules[]
```

### Test Suite

```bash
# Run all rule engine tests
pytest tests/test_phase7_8_rule_engine.py -v

# Expected: 17 passed, 0 failures
```

---

## Known Limitations

1. **Hard-coded rules**: No dynamic rule configuration (by design for Phase 7.8)
2. **Field path assumptions**: Uses common field names (name, license_number, state, etc.)
3. **No custom weights**: All rules use fixed weights (by design)
4. **Case type routing**: Unknown types default to CSF generic rules

These are intentional design choices for V1 to keep the system simple and deterministic.

---

## Future Enhancements (Not in Scope)

- **Rule Configuration UI**: Allow admins to enable/disable rules
- **Custom Rules**: Per-organization rule customization
- **Dynamic Weights**: Adjust rule importance based on context
- **Rule Templates**: Import/export rule packs
- **Rule Analytics**: Track which rules fail most often

---

## Technical Details

### Rule Evaluation Flow

```
1. GET /intelligence endpoint called
   ↓
2. Repository: compute_and_upsert_decision_intelligence()
   ↓
3. Fetch case → get submission → extract formData
   ↓
4. rules_engine.evaluate_case(decision_type, formData)
   ↓
5. Get rule pack for case type (cached)
   ↓
6. Evaluate each rule's check() function
   ↓
7. Build list of RuleResult objects
   ↓
8. compute_confidence(rule_results)
   ↓
9. Apply severity caps
   ↓
10. Return (confidence_score, confidence_band, rule_summary)
   ↓
11. Store in decision_intelligence table
   ↓
12. Return in API response with failed_rules[]
```

### Performance

- **Rule evaluation**: O(n) where n = number of rules (~8-10 per case)
- **Caching**: Rule packs cached in memory after first access
- **No DB queries**: Rules execute against in-memory formData dict

---

## Related Documentation

- [PHASE_7_5_AUTORECOMPUTE.md](docs/PHASE_7_5_AUTORECOMPUTE.md) - Auto-recompute triggers
- [PHASE_7_7_E2E_RECOMPUTE.md](PHASE_7_7_E2E_RECOMPUTE.md) - E2E recompute flow
- [api_endpoints.md](docs/api_endpoints.md) - API reference

---

## Verification Checklist

- ✅ rules_engine.py created with 4 case types (36 total rules)
- ✅ DecisionIntelligenceResponse updated with rule fields
- ✅ Repository integration complete
- ✅ Router endpoints return rule data
- ✅ 17 backend tests passing
- ✅ Severity caps working correctly
- ✅ API backward compatible
- ✅ No breaking changes to existing tests
- ✅ Documentation complete

---

## Test Results Summary

```
======================== 17 passed, 32 warnings in 0.15s ========================

tests/test_phase7_8_rule_engine.py::test_csf_practitioner_perfect_submission PASSED
tests/test_phase7_8_rule_engine.py::test_csf_practitioner_missing_critical_field PASSED
tests/test_phase7_8_rule_engine.py::test_csf_practitioner_three_medium_failures PASSED
tests/test_phase7_8_rule_engine.py::test_csf_facility_perfect_submission PASSED
tests/test_phase7_8_rule_engine.py::test_csf_facility_missing_license PASSED
tests/test_phase7_8_rule_engine.py::test_csf_generic_submission PASSED
tests/test_phase7_8_rule_engine.py::test_csf_generic_partial_submission PASSED
tests/test_phase7_8_rule_engine.py::test_csa_perfect_submission PASSED
tests/test_phase7_8_rule_engine.py::test_csa_missing_address PASSED
tests/test_phase7_8_rule_engine.py::test_confidence_bands PASSED
tests/test_phase7_8_rule_engine.py::test_critical_failure_caps_at_40 PASSED
tests/test_phase7_8_rule_engine.py::test_three_medium_failures_cap_at_70 PASSED
tests/test_phase7_8_rule_engine.py::test_failed_rules_structure PASSED
tests/test_phase7_8_rule_engine.py::test_rule_summary_structure PASSED
tests/test_phase7_8_rule_engine.py::test_empty_payload PASSED
tests/test_phase7_8_rule_engine.py::test_minimum_floor PASSED
tests/test_phase7_8_rule_engine.py::test_invalid_case_type_defaults_to_csf PASSED
```

---

✅ **PHASE 7.8 COMPLETE** - Rule-Based Confidence V1 Implemented
