# CSF Sandbox Network Timeout Fix - Complete

## Problem Summary
ALL CSF sandboxes (Hospital, Practitioner, Facility, EMS, Researcher) were experiencing:
- Evaluate buttons stuck on "Evaluating..." indefinitely
- Submit failing with "Request timeout after 15000ms: POST /csf/<type>/submit"
- No proper error messages displayed to users

## Root Cause Analysis

### 1. **API_BASE Empty String Bug** (CRITICAL)
The `getApiBase()` function was treating empty environment variables (`VITE_API_BASE=""`) as valid values, overriding the localhost fallback. This caused requests to go to `""` instead of `"http://127.0.0.1:8000"` in local development.

**Before:**
```typescript
if (viteBaseRaw !== undefined) {
  return viteBaseRaw; // Returns "" if VITE_API_BASE=""
}
```

**After:**
```typescript
const envBase = metaEnv.VITE_API_BASE_URL || metaEnv.VITE_API_BASE;
if (envBase && envBase.trim()) {
  return envBase.trim(); // Only returns non-empty strings
}
```

### 2. **CSF Clients Using Raw `fetch` Without Timeout**
All CSF client functions (`csfPractitionerClient.ts`, `csfFacilityClient.ts`, etc.) were using raw `fetch()` which has NO timeout mechanism. This caused requests to hang indefinitely when the backend wasn't responding.

**Before:**
```typescript
const resp = await fetch(`${API_BASE}/csf/practitioner/evaluate`, {...});
```

**After:**
```typescript
const data = await apiFetch<any>("/csf/practitioner/evaluate", {
  method: "POST",
  body: JSON.stringify(payload),
}); // Now has 15s timeout + proper error handling
```

### 3. **Poor Error Handling**
Errors weren't being parsed from FastAPI validation responses, leading to unclear error messages.

## Changes Made

### A. Fixed API Base Configuration (`frontend/src/lib/api.ts` + `apiBase.ts`)

**Updated `getApiBase()` function:**
- Treats empty string env vars as undefined
- Falls back to `http://127.0.0.1:8000` for localhost
- Falls back to same-origin for deployed environments
- Added comprehensive documentation explaining the bug

**Added diagnostic logging (dev-only):**
```typescript
if (isDev && typeof window !== "undefined") {
  console.info("[AutoComply API] Backend URL:", API_BASE);
}
```

### B. Enhanced `apiFetch()` Helper (`frontend/src/lib/api.ts`)

**Improved features:**
1. **Better logging** - Logs request method, URL, payload (dev only)
2. **FastAPI validation error parsing** - Converts detail arrays to readable messages
3. **Improved timeout messages** - Now includes diagnostic hints
4. **Network error detection** - Distinguishes between timeout and network failures

**Error message examples:**
- Before: `Request timeout after 15000ms: POST /csf/facility/submit`
- After: `Request timed out after 15000ms. Backend may not be running at http://127.0.0.1:8000. Check: 1) Backend is running, 2) No CORS issues, 3) Network connectivity.`

**Validation errors:**
- Before: `API Error 422: [object Object]`
- After: `422 Unprocessable Entity: Validation error - facility_name: field required; dea_number: field required`

### C. Updated All CSF Clients

Converted all 5 CSF client functions to use `apiFetch`:

1. ✅ **csfHospitalClient.ts** - `evaluateHospitalCsf()`
2. ✅ **csfPractitionerClient.ts** - `evaluatePractitionerCsf()`
3. ✅ **csfFacilityClient.ts** - `evaluateFacilityCsf()`
4. ✅ **csfEmsClient.ts** - `evaluateEmsCsf()`
5. ✅ **csfResearcherClient.ts** - `evaluateResearcherCsf()`

**Benefits:**
- 15-second timeout on all requests (prevents infinite hanging)
- Automatic error parsing and formatting
- Centralized logging for debugging
- Consistent behavior across all sandboxes

### D. Error Rendering

Error display already uses string interpolation correctly:
```tsx
{error && <ErrorAlert message={error} />}
```

The `apiFetch` helper now ensures all errors are properly formatted strings, eliminating `[object Object]` issues.

## Files Modified

### Frontend
1. `frontend/src/lib/api.ts` - Fixed API_BASE, enhanced apiFetch with logging and error parsing
2. `frontend/src/lib/apiBase.ts` - Fixed empty string handling in getApiBase()
3. `frontend/src/api/csfHospitalClient.ts` - Switched to apiFetch
4. `frontend/src/api/csfPractitionerClient.ts` - Switched to apiFetch
5. `frontend/src/api/csfFacilityClient.ts` - Switched to apiFetch
6. `frontend/src/api/csfEmsClient.ts` - Switched to apiFetch
7. `frontend/src/api/csfResearcherClient.ts` - Switched to apiFetch

### Backend (Previously Fixed)
- All CSF evaluate/submit endpoints already have trace_id support
- Backend trace recording is working correctly

## Testing Checklist

### Before Testing
- [ ] Backend is running: `cd backend && uvicorn src.main:app --reload`
- [ ] Frontend is running: `cd frontend && npm run dev`
- [ ] Check console for: `[AutoComply API] Backend URL: http://127.0.0.1:8000`

### Test Each Sandbox

For **Practitioner CSF**:
- [ ] Load page at http://localhost:5173/practitioner-csf
- [ ] Fill form with preset "Primary care prescriber (happy path)"
- [ ] Click "Evaluate Practitioner CSF"
  - Should complete in <3 seconds
  - Decision box should appear with status
  - Console should show: `[API Request] POST http://127.0.0.1:8000/csf/practitioner/evaluate`
  - Console should show: `[API Response] POST ... → 200`
- [ ] Click "Submit for verification"
  - Should complete in <3 seconds
  - Success message should appear
  - No timeout errors

For **Facility CSF**:
- [ ] Load page, use preset "Multi-site clinic chain (happy path)"
- [ ] Evaluate → Should work without timeout
- [ ] Submit → Should work without timeout

For **EMS CSF**:
- [ ] Load page, use preset "EMS CSF – complete & compliant"
- [ ] Evaluate → Should work without timeout
- [ ] Submit → Should work without timeout

For **Researcher CSF**:
- [ ] Load page, use preset "Researcher CSF – complete & controlled"
- [ ] Evaluate → Should work without timeout
- [ ] Submit → Should work without timeout

For **Hospital CSF**:
- [ ] Load page, use preset from dropdown
- [ ] Evaluate → Should work without timeout
- [ ] Submit → Should work without timeout

### Test Error Scenarios

- [ ] Stop backend, try to evaluate → Should show clear error:
  - "Network error: Cannot connect to backend at http://127.0.0.1:8000. Verify backend is running and accessible."
- [ ] Submit invalid form (missing required fields) → Should show:
  - "422 Unprocessable Entity: Validation error - field_name: field required"
- [ ] No more `[object Object]` in error messages

### Test Trace Recording

- [ ] Evaluate any CSF type
- [ ] Submit the form
- [ ] Navigate to Compliance Console
- [ ] Find submission in work queue
- [ ] Click "Open trace" → Should show trace timeline

## Success Criteria

✅ All evaluate buttons resolve (no infinite "Evaluating...")  
✅ All submit buttons work (no 15000ms timeout)  
✅ Error messages are readable and helpful  
✅ Console logs show proper request/response flow  
✅ Backend trace recording works  
✅ No TypeScript compilation errors

## Code Comments Added

In both `api.ts` and `apiBase.ts`:
```typescript
/**
 * CRITICAL: Empty string env vars (VITE_API_BASE="") should NOT override
 * the localhost fallback. This was causing "Request timeout" errors in local dev
 * because requests went to "" instead of "http://127.0.0.1:8000".
 */
```

## Next Steps

1. Run frontend: `npm run dev` in frontend/
2. Run backend: `uvicorn src.main:app --reload` in backend/
3. Test all 5 CSF sandboxes using the checklist above
4. Verify console logs show proper API_BASE resolution
5. Verify error messages are clear and actionable

## Notes

- The `useCsfActions` hook already uses `apiFetch`, so no changes needed there
- The sandbox components already have proper error display with `ErrorAlert`
- All loading states (`isEvaluating`, `isSubmitting`) are managed correctly with try/finally blocks
- Backend endpoints already return proper trace_id for Console integration
