# Fix: Everything Stuck Loading (API Integration)

## Problem Summary
All CSF sandboxes, "Submit for verification", "Check & Explain", and Console Work Queue were getting stuck in infinite loading states. This was caused by:
1. Hardcoded API URLs (`http://127.0.0.1:8000`) instead of using environment variables
2. No timeout on fetch requests (could hang forever)
3. Inconsistent error handling without try/catch/finally
4. Missing fallback to mock data removed, hiding real API failures

## Solution Implemented

### 1. Created Centralized API Wrapper

**File: `frontend/src/lib/api.ts`**
- Single source of truth for `API_BASE` URL
- Reads from `VITE_API_BASE_URL` or `VITE_API_BASE` env variables
- Fallback to `http://localhost:8000`
- `apiFetch<T>(path, options)` function with:
  - **15-second timeout** using AbortController
  - Automatic API_BASE prefixing
  - Proper error handling (reads error body, includes status code)
  - Dev logging (method + URL + status)
  - JSON parsing with content-type detection
  - Network error detection with helpful messages

### 2. Updated All API Clients

**Updated Files:**
- ✅ `frontend/src/hooks/useCsfActions.ts` - Now uses `apiFetch` instead of hardcoded fetch
- ✅ `frontend/src/api/csfExplainClient.ts` - Now uses `apiFetch` for "Check & Explain"
- ✅ `frontend/src/pages/ConsoleDashboard.tsx` - Now uses `apiFetch` for work queue

**Key Changes:**
- Replaced all `fetch(\`http://127.0.0.1:8000/...\`)` with `apiFetch(\`/...\`)`
- Removed manual error handling (now handled by apiFetch)
- Removed fallback to mock data (now shows real errors)
- All loading states properly reset in `finally` blocks

### 3. Enhanced Error Handling

**Console Work Queue:**
- Shows clear error message when API fails
- Added "Retry" button to reload page
- Better error styling (red border, red text)
- Empty state when no items (instead of fallback mock)

**CSF Sandboxes:**
- Errors now display user-friendly messages
- Loading spinners guaranteed to clear (try/catch/finally)
- Timeout errors show "Request timeout after 15000ms"
- Network errors show "Cannot reach backend at {URL}"

### 4. Environment Configuration

**File: `frontend/.env.local`**
```env
VITE_API_BASE=http://127.0.0.1:8000
```

This file already existed and is correctly configured. The `api.ts` wrapper now reads from it.

### 5. Backend Verification

**Already Configured:**
- ✅ CORS middleware allows all origins (safe for dev)
- ✅ Health endpoint exists at `GET /health`
- ✅ All CSF routes mounted:
  - `/csf/practitioner/evaluate` and `/submit`
  - `/csf/hospital/evaluate` and `/submit`
  - `/csf/facility/evaluate` and `/submit`
  - `/csf/ems/evaluate` and `/submit`
  - `/csf/researcher/evaluate` and `/submit`
- ✅ Console route: `/console/work-queue`
- ✅ Explain route: `/csf/explain`

## Technical Details

### API Fetch Wrapper Pattern

**Before (unreliable):**
```typescript
const response = await fetch(`http://127.0.0.1:8000/csf/practitioner/evaluate`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(payload),
});
if (!response.ok) {
  throw new Error(`Evaluation failed: ${response.status}`);
}
const data = await response.json();
```

**After (reliable):**
```typescript
const data = await apiFetch<EvaluateResponse>(`/csf/practitioner/evaluate`, {
  method: "POST",
  body: JSON.stringify(payload),
});
```

### Timeout Implementation
```typescript
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 15000);

const response = await fetch(url, {
  ...options,
  signal: controller.signal,
});

clearTimeout(timeoutId);
```

### Error Handling
```typescript
try {
  const data = await apiFetch(...);
  // success
} catch (err) {
  // apiFetch throws with:
  // - "Request timeout after 15000ms" for timeouts
  // - "API Error 404: Not Found" for HTTP errors
  // - "Network error: Cannot reach backend" for network failures
  setError(err.message);
} finally {
  setIsLoading(false); // ALWAYS clears spinner
}
```

## Files Changed

### Created:
- ✅ `frontend/src/lib/api.ts` (centralized API wrapper)

### Updated:
- ✅ `frontend/src/hooks/useCsfActions.ts` (evaluate + submit)
- ✅ `frontend/src/api/csfExplainClient.ts` (Check & Explain)
- ✅ `frontend/src/pages/ConsoleDashboard.tsx` (work queue + retry button)

### Already Existed (No changes needed):
- ✅ `frontend/.env.local` (API_BASE configured)
- ✅ `backend/src/api/main.py` (CORS configured)
- ✅ `backend/src/api/routes/health.py` (health endpoint)

## Testing Checklist

### Backend Health
- [ ] Navigate to http://localhost:8000/health
- [ ] Should return `{"status":"ok","service":"autocomply-ai",...}`

### CSF Sandboxes (All 5)
- [ ] **Practitioner**: Evaluate clears spinner, Submit returns ID
- [ ] **Hospital**: Evaluate clears spinner, Submit returns ID (new!)
- [ ] **Facility**: Evaluate clears spinner, Submit returns ID
- [ ] **EMS**: Evaluate clears spinner, Submit returns ID
- [ ] **Researcher**: Evaluate clears spinner, Submit returns ID

### Check & Explain
- [ ] Click "Explain decision" after evaluating
- [ ] Explanation loads within 15s or shows error
- [ ] Spinner clears properly

### Console Work Queue
- [ ] Navigate to `/console`
- [ ] Work queue loads items OR shows error with Retry button
- [ ] No infinite "Loading work queue..." state
- [ ] Clicking "Open trace" opens trace replay drawer

### Error Scenarios
- [ ] Stop backend → Frontend shows "Cannot reach backend" error
- [ ] Slow network → Request times out after 15s with clear message
- [ ] Invalid data → API error displays with status code

## Acceptance Criteria ✅

1. ✅ No hardcoded API URLs - all use `API_BASE`
2. ✅ All fetch calls have 15s timeout
3. ✅ All loading states reset in `finally` blocks
4. ✅ Console work queue shows errors instead of fallback mock
5. ✅ Health endpoint exists and is callable
6. ✅ CORS configured for localhost:5173
7. ✅ Dev logging enabled for debugging
8. ✅ TypeScript errors: 0

## Environment Setup

**Option Used: Frontend .env.local (Recommended)**
```env
VITE_API_BASE=http://127.0.0.1:8000
```

**No Vite proxy needed** - Direct API calls to backend.

## Debugging

If issues persist:

1. **Check backend is running:**
   ```bash
   curl http://localhost:8000/health
   ```

2. **Check browser console:**
   - Should see: `[API] POST /csf/practitioner/evaluate → 200`
   - Errors will show: `[API Error]` or `[API Timeout]`

3. **Check Network tab:**
   - Request URL should be `http://127.0.0.1:8000/csf/...`
   - Status should be 200
   - Response should have JSON body

4. **Check environment:**
   ```bash
   # In frontend directory
   cat .env.local
   # Should show: VITE_API_BASE=http://127.0.0.1:8000
   ```

## Next Steps

If you want to test immediately:
1. Restart frontend dev server (to pick up .env.local changes)
2. Ensure backend is running on port 8000
3. Open any CSF sandbox
4. Click "Evaluate" - should complete within 1-2 seconds
5. Click "Submit for verification" - should show submission ID
6. Go to Console - should load work queue (or show error)
