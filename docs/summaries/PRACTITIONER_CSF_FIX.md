# Practitioner CSF Fix - Complete ✅

## Issue
Practitioner CSF endpoint was crashing with HTTP 500:
```
AttributeError: 'PractitionerCsfDecision' object has no attribute 'risk_level'
```

## Root Cause
Two issues:
1. **Missing `risk_level` computation** - Code tried to access `decision.risk_level` which doesn't exist in the domain model
2. **Missing `trace_id` field** - Code tried to assign `decision.trace_id = trace_id` but `PractitionerCsfDecision` model didn't have this field

## Solution

### Fix 1: Add risk_level computation (✅ DONE)
**File:** `backend/src/api/routes/csf_practitioner.py`

**Added import:**
```python
from src.autocomply.domain.decision_risk import compute_risk_for_status
```

**Fixed DecisionOutcome creation:**
```python
# BEFORE (broken):
decision_outcome = DecisionOutcome(
    status=normalized_status,
    reason=decision.reason,
    risk_level=decision.risk_level,  # ❌ Field doesn't exist!
    regulatory_references=regulatory_references,
    trace_id=trace_id,
)

# AFTER (working):
# Compute risk level and score based on decision status
risk_level, risk_score = compute_risk_for_status(normalized_status.value)

decision_outcome = DecisionOutcome(
    status=normalized_status,
    reason=decision.reason,
    risk_level=risk_level,  # ✅ Now computed correctly
    risk_score=risk_score,  # ✅ Added
    regulatory_references=regulatory_references,
    trace_id=trace_id,
    debug_info={"missing_fields": decision.missing_fields} if decision.missing_fields else None,
)
```

### Fix 2: Add trace_id field (✅ DONE)
**File:** `backend/src/autocomply/domain/csf_practitioner.py`

**Added field:**
```python
class PractitionerCsfDecision(BaseModel):
    """
    Output of the practitioner CSF decision logic.
    """

    status: CsDecisionStatus
    reason: str
    missing_fields: List[str] = Field(default_factory=list)
    regulatory_references: List[str] = Field(
        default_factory=list,
        description=(
            "IDs of compliance artifacts (e.g. csf_fl_addendum) that directly "
            "informed this decision."
        ),
    )
    trace_id: Optional[str] = Field(  # ✅ ADDED
        default=None,
        description="Trace ID for decision audit and replay",
    )
```

## How to Apply Fix

### Option 1: Backend with Auto-Reload (if uvicorn --reload is running)
**Status:** Uvicorn should auto-detect the file changes and reload.

**Verify by checking terminal output for:**
```
INFO:     Watching for file changes
INFO:     Detected file change in 'src/api/routes/csf_practitioner.py'
INFO:     Reloading...
INFO:     Application startup complete.
```

**If you DON'T see the reload messages, use Option 2.**

### Option 2: Manual Backend Restart (RECOMMENDED)
```powershell
# 1. Stop backend (Ctrl+C in backend terminal)

# 2. Restart:
cd C:\Users\sourp\AutoComply-AI-fresh\backend
.\.venv\Scripts\Activate.ps1
$env:PYTHONPATH = "$PWD"
python -m uvicorn src.api.main:app --host 127.0.0.1 --port 8001 --reload
```

**Expected output:**
```
INFO:     Will watch for changes in these directories: ['C:\\Users\\sourp\\AutoComply-AI-fresh\\backend']
INFO:     Uvicorn running on http://127.0.0.1:8001 (Press CTRL+C to quit)
INFO:     Started reloader process [XXXXX] using WatchFiles
INFO:     Started server process [XXXXX]
INFO:     Waiting for application startup.
INFO:     Application startup complete.
```

## Testing the Fix

### Test 1: Practitioner CSF Evaluate
```powershell
$body = @{
    facility_name = "Dr. Smith Practice"
    facility_type = "individual_practitioner"
    account_number = "P123"
    practitioner_name = "Dr. John Smith"
    state_license_number = "NY123456"
    dea_number = "AS1234567"
    ship_to_state = "NY"
    attestation_accepted = $true
    controlled_substances = @()
} | ConvertTo-Json -Compress

Invoke-WebRequest -Uri "http://127.0.0.1:8001/csf/practitioner/evaluate" `
  -Method POST `
  -Body $body `
  -ContentType "application/json"
```

**Expected Result:**
```
StatusCode        : 200
{
  "status": "ok_to_ship",
  "reason": "Practitioner CSF is approved to proceed.",
  "missing_fields": [],
  "regulatory_references": [],
  "trace_id": "12345..."
}
```

### Test 2: All CSF Endpoints
```powershell
# Hospital
Invoke-WebRequest -Uri "http://127.0.0.1:8001/csf/hospital/evaluate" -Method POST ...
# Expected: HTTP 200 ✅

# Practitioner
Invoke-WebRequest -Uri "http://127.0.0.1:8001/csf/practitioner/evaluate" -Method POST ...
# Expected: HTTP 200 ✅

# Facility
Invoke-WebRequest -Uri "http://127.0.0.1:8001/csf/facility/evaluate" -Method POST ...
# Expected: HTTP 200 ✅

# EMS
Invoke-WebRequest -Uri "http://127.0.0.1:8001/csf/ems/evaluate" -Method POST ...
# Expected: HTTP 200 ✅

# Researcher
Invoke-WebRequest -Uri "http://127.0.0.1:8001/csf/researcher/evaluate" -Method POST ...
# Expected: HTTP 200 ✅
```

## Verification Checklist

After restarting backend:

- [ ] Backend starts without errors (`Application startup complete`)
- [ ] Health endpoint works: `http://127.0.0.1:8001/health` returns HTTP 200
- [ ] Practitioner CSF evaluate returns HTTP 200 (not 500)
- [ ] Response includes `trace_id` field
- [ ] Response includes computed `risk_level` and `risk_score` in audit log

## Changes Summary

**Files Modified:**
1. `backend/src/api/routes/csf_practitioner.py`
   - Added `from src.autocomply.domain.decision_risk import compute_risk_for_status`
   - Added `risk_level, risk_score = compute_risk_for_status(normalized_status.value)`
   - Updated `DecisionOutcome` to use computed `risk_level` and `risk_score`
   - Added `debug_info` parameter

2. `backend/src/autocomply/domain/csf_practitioner.py`
   - Added `trace_id: Optional[str]` field to `PractitionerCsfDecision`

**Status:** ✅ All code changes complete. Just needs backend restart.

---

**Last Updated:** December 21, 2025  
**Next Step:** Restart backend to apply fixes
