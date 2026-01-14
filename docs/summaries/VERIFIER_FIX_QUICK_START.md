# VERIFIER FIX - QUICK START

## Problem Fixed
✅ Verifier Console now shows ALL real backend cases (was showing only 4 demo cases)

## What Was Wrong
- Verifier Console called `demoStore.getWorkQueue()` → 4 hardcoded demo cases
- Backend limit too low (25) → would hide cases beyond first page
- Never fetched real data from API

## What Was Fixed
- CaseWorkspace.tsx now uses `useWorkQueue()` hook → fetches from backend API
- Backend limit increased to 100 (max 1000)
- Frontend requests limit=1000 by default

---

## Quick Test (30 seconds)

### 1. Run Verification Script
```powershell
.\test_verifier_discrepancy_fix.ps1
```

**Expected Output:**
```
✅ Retrieved 16 submissions
✅ Retrieved 16 cases (total: 16)
✅ No demo data found
✅ PASS - Verifier should show all 16 real cases
```

---

## Manual UI Test

### 1. Open Verifier Console
```
http://localhost:5173/console/cases
```

### 2. Check "All" Filter
- Should show **16 cases** (not 4) ✅
- No `demo-wq-*` IDs ✅
- All UUIDs (e.g., `550e8400-...`) ✅

### 3. Click Any Case
- URL: `/console/cases?caseId=<UUID>` (not `demo-wq-3`) ✅
- Loads real submission data ✅

---

## Debug Commands

### Check Backend Data
```powershell
curl http://127.0.0.1:8001/workflow/dev/db-info
```

**Should show:**
```json
{
  "submissions_count": 16,
  "cases_count": 16
}
```

### Check API Returns All
```powershell
curl "http://127.0.0.1:8001/workflow/cases?limit=1000"
```

**Should return:**
```json
{
  "items": [ ... ],  // 16 items
  "total": 16
}
```

### Verify No Demo Data
```powershell
curl "http://127.0.0.1:8001/workflow/cases?limit=1000" | Select-String "demo-wq"
```

**Should return:** No matches

---

## Files Changed
- `backend/app/workflow/router.py` - Increased limit (25→100, max 1000)
- `frontend/src/pages/CaseWorkspace.tsx` - Use API instead of demo store
- `frontend/src/api/workflowApi.ts` - Request limit=1000 by default

---

## If It Still Doesn't Work

1. **Clear browser cache**
   ```javascript
   localStorage.clear();
   location.reload();
   ```

2. **Check Network tab**
   - DevTools → Network
   - Look for `GET /workflow/cases?limit=1000`
   - Response should have 16 items

3. **Check Console logs**
   - Should see: `[WorkflowStore] Backend health check: ✅ OK`
   - Should NOT see: `Backend unavailable, using localStorage fallback`

---

## Expected Counts
| View | Count |
|------|-------|
| Submitter Console ("My submissions") | 16 |
| Verifier Console ("All" filter) | 16 |
| GET /submissions | 16 |
| GET /workflow/cases | 16 |
| Database submissions table | 16 |
| Database cases table | 16 |

**All should match!** ✅

---

## Next Steps
- ✅ Verifier discrepancy fixed (16 = 16)
- 🚧 Phase 2 pending (verifier actions UI)

See [VERIFIER_DISCREPANCY_FIX.md](VERIFIER_DISCREPANCY_FIX.md) for full details.
