# Backend Module Import Fix - RESOLVED ✅

## Problem
Backend was crashing on startup with:
```
ModuleNotFoundError: No module named 'src.domain.decision_log'
```

Triggered from:
- `backend/src/api/routes/csf_facility.py`
- `backend/src/api/routes/csf_ems.py`  
- `backend/src/api/routes/csf_researcher.py`

## Root Cause
The CSF routes were importing from a non-existent module `src.domain.decision_log`, when the actual functions existed in:
- `ensure_trace_id()` → `src.autocomply.domain.trace`
- `get_decision_log()` → `src.autocomply.audit.decision_log`

Additionally, the code was incorrectly calling `ensure_trace_id(request)` instead of extracting the trace ID from headers first, and using dictionary assignment `decision_log[trace_id] = ...` instead of the `record()` method.

## Fixes Applied

### 1. Fixed Import Paths
**Files modified:**
- `backend/src/api/routes/csf_facility.py`
- `backend/src/api/routes/csf_ems.py`
- `backend/src/api/routes/csf_researcher.py`

**Changed from:**
```python
from src.domain.decision_log import ensure_trace_id, get_decision_log
```

**Changed to:**
```python
from src.autocomply.domain.trace import ensure_trace_id, TRACE_HEADER_NAME
from src.autocomply.audit.decision_log import get_decision_log
```

### 2. Fixed ensure_trace_id() Usage
**Before:**
```python
trace_id = ensure_trace_id(request)  # ❌ Wrong - passing Request object
```

**After:**
```python
incoming_trace_id = request.headers.get(TRACE_HEADER_NAME)
trace_id = ensure_trace_id(incoming_trace_id)  # ✅ Correct - passing Optional[str]
```

### 3. Fixed Decision Log Recording
**Before:**
```python
decision_log = get_decision_log()
decision_log[trace_id] = decision_outcome  # ❌ Dictionary assignment not supported
```

**After:**
```python
decision_log = get_decision_log()
decision_log.record(  # ✅ Using proper record() method
    trace_id=trace_id,
    engine_family="csf",
    decision_type="csf_facility",  # or csf_ems, csf_researcher
    decision=decision_outcome,
)
```

## Verification

### Import Test
```bash
cd backend
python -c "from src.api.routes.csf_facility import router; \
           from src.api.routes.csf_ems import router as ems_router; \
           from src.api.routes.csf_researcher import router as researcher_router; \
           print('✅ All CSF routes import successfully')"
```

**Result:** ✅ All CSF routes import successfully

### Backend Startup Test
```bash
cd backend
uvicorn src.api.main:app --host 127.0.0.1 --port 8000
```

**Expected output:**
```
INFO:     Application startup complete.
INFO:     Uvicorn running on http://127.0.0.1:8000
```

### Health Check
```bash
curl http://127.0.0.1:8000/health
```

**Expected:** HTTP 200 with service status

## Files Changed

1. **backend/src/api/routes/csf_facility.py**
   - Fixed imports (lines 8-14)
   - Fixed ensure_trace_id call (lines 80-82)
   - Fixed decision_log.record call (lines 115-120)

2. **backend/src/api/routes/csf_ems.py**
   - Fixed imports (lines 5-7)
   - Fixed ensure_trace_id call (lines 30-32)
   - Fixed decision_log.record call (lines 54-59)

3. **backend/src/api/routes/csf_researcher.py**
   - Fixed imports (lines 5-7)
   - Fixed ensure_trace_id call (lines 30-32)
   - Fixed decision_log.record call (lines 54-59)

## Testing Checklist

- [x] Backend imports without ModuleNotFoundError
- [x] All CSF route modules import successfully
- [ ] Backend starts with uvicorn (requires clean port 8000)
- [ ] /health endpoint responds
- [ ] /csf/facility/evaluate endpoint works
- [ ] /csf/ems/evaluate endpoint works
- [ ] /csf/researcher/evaluate endpoint works
- [ ] Trace recording works correctly
- [ ] Frontend can connect and make requests

## Notes

- The `DecisionLog` class uses a `record()` method, not dictionary assignment
- The `ensure_trace_id()` function expects `Optional[str]`, not a `Request` object
- Trace ID should be extracted from the `x-autocomply-trace-id` header
- All three CSF routes (Facility, EMS, Researcher) followed the same incorrect pattern
- The correct pattern is demonstrated in `csf_hospital.py` and `csf_practitioner.py`

## Next Steps

1. Ensure backend is running: `cd backend && uvicorn src.api.main:app --reload`
2. Test frontend connectivity
3. Verify trace recording in Compliance Console
4. Test all 5 CSF sandboxes end-to-end
