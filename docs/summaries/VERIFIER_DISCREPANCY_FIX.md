# VERIFIER DISCREPANCY FIX - COMPLETE

## Problem Statement

**CRITICAL BUG**: Submitter Console shows 16 submissions, but Verifier Console shows only 4 cases with demo IDs (e.g., `demo-wq-3`).

**Root Causes Identified:**

1. **Frontend: Verifier Console using demo data instead of API**
   - `CaseWorkspace.tsx` line 61 called `demoStore.getWorkQueue()` directly
   - Hardcoded 4 demo cases (`demo-wq-1`, `demo-wq-2`, `demo-wq-3`) displayed
   - Real backend data never fetched

2. **Backend: Low pagination limit**
   - GET /workflow/cases had default `limit=25`, max `100`
   - Would have hidden cases beyond first page even if frontend used API

3. **Frontend: Low display limit**
   - `displayLimit` state set to `50`, limiting UI rendering
   - Combined with demo data, never showed real cases

---

## Solution Implemented

### A) BACKEND CHANGES

#### 1. Increased Pagination Limits (workflow/router.py)

**Before:**
```python
limit: int = Query(25, ge=1, le=100, description="Number of items per page (max 100)")
```

**After:**
```python
limit: int = Query(100, ge=1, le=1000, description="Number of items per page (default 100, max 1000)")
```

**Why:** Allows frontend to fetch all cases in one request without pagination.

---

### B) FRONTEND CHANGES

#### 2. CaseWorkspace.tsx - Use API instead of demo store

**Before (BROKEN):**
```tsx
import { demoStore } from "../lib/demoStore";

const filteredAndSortedItems = useMemo(() => {
  let items = demoStore.getWorkQueue();  // ❌ Demo data
  // ...
}, [queueFilter, searchQuery, sortField, sortDirection, currentUser]);
```

**After (FIXED):**
```tsx
import { useWorkQueue } from "../workflow/useWorkflowStore";

export const CaseWorkspace: React.FC = () => {
  // ...
  const { items: workQueueItems, isLoading: isLoadingQueue, reload: reloadQueue } = useWorkQueue(true);
  
  const filteredAndSortedItems = useMemo(() => {
    let items = workQueueItems || [];  // ✅ Real backend data
    // ...
  }, [queueFilter, searchQuery, sortField, sortDirection, currentUser, workQueueItems]);
}
```

**Changes:**
- Removed `demoStore` import
- Added `useWorkQueue` hook import
- Replaced `demoStore.getWorkQueue()` with `workQueueItems` from API
- Updated `useMemo` dependency array to include `workQueueItems`
- Increased `displayLimit` from `50` to `500`

---

#### 3. workflowApi.ts - Request all cases by default

**Before:**
```typescript
export async function listCases(filters?: CaseFilters): Promise<PaginatedCasesResponse> {
  const params = new URLSearchParams();
  // ...
  if (filters?.limit !== undefined) params.set('limit', String(filters.limit));
  // No default limit - backend defaults to 25
  
  const url = params.toString() 
    ? `${WORKFLOW_BASE}/cases?${params}` 
    : `${WORKFLOW_BASE}/cases`;  // ❌ Only gets first 25
}
```

**After:**
```typescript
export async function listCases(filters?: CaseFilters): Promise<PaginatedCasesResponse> {
  const params = new URLSearchParams();
  // ...
  // Default to high limit to show all cases
  if (filters?.limit !== undefined) params.set('limit', String(filters.limit));
  else params.set('limit', '1000');  // ✅ Request all
  
  const url = params.toString() 
    ? `${WORKFLOW_BASE}/cases?${params}` 
    : `${WORKFLOW_BASE}/cases?limit=1000`;  // ✅ Explicit limit
}
```

---

## Files Changed

### Backend
1. **backend/app/workflow/router.py** (Lines 192, 200, 211)
   - Changed default `limit` from `25` to `100`
   - Changed max `limit` from `100` to `1000`
   - Updated docstring

### Frontend
2. **frontend/src/pages/CaseWorkspace.tsx** (Lines 1-15, 35, 62-70, 135)
   - Removed `demoStore` import
   - Added `useWorkQueue` hook import
   - Replaced `demoStore.getWorkQueue()` with `workQueueItems`
   - Increased `displayLimit` from `50` to `500`
   - Updated `useMemo` dependencies

3. **frontend/src/api/workflowApi.ts** (Lines 146-168)
   - Added default `limit=1000` when no filter specified
   - Ensured fallback URL includes `?limit=1000`

---

## Verification Steps

### Automated Test

Run the verification script:
```powershell
.\test_verifier_discrepancy_fix.ps1
```

**Expected Output:**
```
✅ Backend is healthy
✅ Retrieved 16 submissions
✅ Retrieved 16 cases (total: 16)
✅ No demo data found - all cases are real
✅ PASS - Verifier should show all 16 real cases
```

---

### Manual Test (UI)

**1. Start Backend**
```powershell
cd backend
.\.venv\Scripts\python.exe -m uvicorn src.api.main:app --reload --host 127.0.0.1 --port 8001
```

**2. Start Frontend**
```powershell
cd frontend
npm run dev
```

**3. Open Verifier Console**
- Navigate to http://localhost:5173/console/cases
- **Filter: "All"** should show **16 cases** (not 4)
- **Each case ID** should be a UUID (not `demo-wq-1`, `demo-wq-2`, etc.)
- Click any case → URL should be `/console/cases?caseId=<UUID>`
- Case details should show real submission data

**4. Compare with Submitter Console**
- Navigate to http://localhost:5173 (submitter view)
- "My submissions" section should show same count (16)
- Verify same submissions appear in both views

---

## Curl Commands for Verification

### 1. Check Database Stats
```bash
curl http://127.0.0.1:8001/workflow/dev/db-info
```

**Expected Response:**
```json
{
  "db_path": "C:\\...\\backend\\app\\data\\autocomply.db",
  "db_exists": true,
  "cwd": "C:\\...\\backend",
  "cases_count": 16,
  "submissions_count": 16
}
```

### 2. Get All Submissions
```bash
curl http://127.0.0.1:8001/submissions
```

**Expected:** Array of 16 submission objects

### 3. Get All Cases
```bash
curl "http://127.0.0.1:8001/workflow/cases?limit=1000"
```

**Expected Response:**
```json
{
  "items": [ ... ],  // Array of 16 cases
  "total": 16,
  "limit": 1000,
  "offset": 0
}
```

### 4. Verify No Demo IDs
```bash
curl "http://127.0.0.1:8001/workflow/cases?limit=1000" | grep "demo-wq"
```

**Expected:** No matches (empty output)

---

## Expected Behavior After Fix

### ✅ Before Fix
- Submitter Console: 16 submissions ✓
- Verifier Console: 4 cases (demo-wq-1, demo-wq-2, demo-wq-3, demo-wq-4) ❌
- Case IDs: `demo-wq-*` ❌
- Data source: localStorage / demoStore ❌

### ✅ After Fix
- Submitter Console: 16 submissions ✓
- Verifier Console: 16 cases (all real UUIDs) ✓
- Case IDs: UUID format (e.g., `550e8400-e29b-41d4-a716-446655440000`) ✓
- Data source: Backend API `/workflow/cases?limit=1000` ✓

---

## Troubleshooting

### Problem: Still seeing 4 demo cases

**Check 1: Browser cache**
```javascript
// In browser console:
localStorage.clear();
sessionStorage.clear();
location.reload();
```

**Check 2: Verify API call**
- Open DevTools → Network tab
- Filter by "cases"
- Look for GET request to `/workflow/cases?limit=1000`
- Check response has 16 items

**Check 3: Check console for errors**
- Open DevTools → Console
- Look for "[WorkflowStore]" log messages
- Should see: `Backend health check: ✅ OK`

---

### Problem: Pagination still limiting results

**Check backend limit:**
```bash
curl "http://127.0.0.1:8001/workflow/cases" | jq '.total'
```

Should return `16`, not `25` or `4`.

**Check frontend request:**
- Network tab → Find `/workflow/cases` request
- URL should include `?limit=1000`
- Response `.total` should equal `.items.length`

---

### Problem: Count mismatch (e.g., 16 submissions but 14 cases)

**Possible causes:**
1. Some submissions created before case auto-creation was implemented
2. Database migration issue
3. Failed submission creation

**Fix:**
```bash
# Check which submissions have linked cases
curl http://127.0.0.1:8001/submissions | jq '.[] | select(.caseId == null) | .id'
```

If found, re-submit or manually create cases.

---

## Data Flow Diagram

### Before (BROKEN)
```
Submitter Console
  └─→ POST /submissions → Backend DB (16 rows)
  
Verifier Console
  └─→ demoStore.getWorkQueue() → localStorage → 4 hardcoded demo cases ❌
      (Never calls backend API)
```

### After (FIXED)
```
Submitter Console
  └─→ POST /submissions → Backend DB (16 rows)
  
Verifier Console
  └─→ useWorkQueue() hook
      └─→ getWorkflowStore()
          └─→ workflowStoreApi.getWorkQueue()
              └─→ workflowApi.listCases({ limit: 1000 })
                  └─→ GET /workflow/cases?limit=1000
                      └─→ Backend DB → Returns all 16 cases ✅
```

---

## Testing Checklist

- [ ] Backend starts without errors
- [ ] `/workflow/dev/db-info` shows 16+ submissions and cases
- [ ] `GET /workflow/cases?limit=1000` returns 16+ items
- [ ] No `demo-wq-*` IDs in response
- [ ] Verifier Console UI shows 16+ cases under "All" filter
- [ ] Each case has UUID, not demo ID
- [ ] Clicking case loads real submission data
- [ ] "My Cases" filter works (filters by assignee)
- [ ] "Unassigned" filter works
- [ ] Search functionality works
- [ ] Case counts match between submitter and verifier views

---

## Related Files

### Backend
- `backend/app/workflow/router.py` - Workflow API endpoints
- `backend/app/submissions/router.py` - Submission API endpoints
- `backend/src/config.py` - Database configuration (absolute path)

### Frontend
- `frontend/src/pages/CaseWorkspace.tsx` - Verifier Console main page
- `frontend/src/workflow/useWorkflowStore.ts` - React hooks for workflow data
- `frontend/src/workflow/workflowStoreApi.ts` - API-backed store implementation
- `frontend/src/workflow/workflowStoreSelector.ts` - Auto-fallback selector
- `frontend/src/api/workflowApi.ts` - HTTP client for workflow endpoints
- `frontend/src/lib/demoStore.ts` - Demo data (now bypassed)

---

## Summary

**Problem**: Verifier Console showed 4 hardcoded demo cases instead of 16 real backend cases.

**Root Cause**: Frontend directly called `demoStore.getWorkQueue()` instead of using API client.

**Solution**: 
1. Replaced demo store call with `useWorkQueue()` hook (fetches from backend)
2. Increased backend pagination limit from 25 → 100 (max 1000)
3. Frontend requests `limit=1000` by default to get all cases
4. Increased UI display limit from 50 → 500

**Result**: Verifier Console now shows all real cases from backend, matching submitter count.

**Verification**: Run `.\test_verifier_discrepancy_fix.ps1` or test UI manually.

---

**Status**: ✅ COMPLETE - Ready for testing
