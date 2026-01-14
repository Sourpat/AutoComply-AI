# VERIFIER WORKSPACE FIX - QUICK START

## Problems Fixed
✅ Verifier list now shows ALL cases (not just 6)
✅ Clicking a case loads details (not "Case not found")
✅ Real UUIDs used (not demo-wq-* IDs)

## What Was Wrong
**Issue #1**: List was already using API (previous fix) but may have had pagination issues
**Issue #2**: CaseDetailsPanel used `demoStore.getWorkQueue()` instead of API → couldn't find real case IDs

## What Was Fixed
- Added backend debug endpoint `/dev/cases-ids` to list case IDs
- Added frontend `getCaseSubmission()` API function
- CaseDetailsPanel now loads cases via `getCase()` API call
- Enhanced error display with debug info (case ID, API mode, API base)

---

## Quick Test (30 seconds)

### Run Verification Script
```powershell
.\test_verifier_workspace_fix.ps1
```

**Expected Output:**
```
✅ Retrieved 16 case IDs
✅ GET /workflow/cases returned 16 items
✅ No demo IDs - all cases are real UUIDs
✅ GET /cases/{id} succeeded
✅ ALL CHECKS PASSED!
```

---

## Manual UI Test

### 1. Open Verifier Console
```
http://localhost:5173/console/cases
```

### 2. Verify List
- Shows **all** cases (not limited to 6) ✅
- No `demo-wq-*` IDs ✅
- All UUIDs ✅

### 3. Click Any Case
- Shows loading spinner ✅
- Loads case details with tabs ✅
- URL: `/console/cases?caseId=<UUID>` ✅
- NOT "Case not found" ✅

### 4. Check Tabs
- Summary: shows case info ✅
- Submission: shows form data ✅
- Playbook: loads ✅
- All tabs accessible ✅

---

## Debug Commands

### Check Database
```powershell
curl http://127.0.0.1:8001/workflow/dev/db-info
```
**Should show**: `{ "cases_count": 16, "submissions_count": 16 }`

### Get Case IDs
```powershell
curl http://127.0.0.1:8001/workflow/dev/cases-ids
```
**Should return**: List of 16+ case IDs with submission IDs

### Get All Cases
```powershell
curl "http://127.0.0.1:8001/workflow/cases?limit=1000"
```
**Should return**: `{ "items": [...], "total": 16 }`

### Test Specific Case
```powershell
# Use ID from /dev/cases-ids
curl "http://127.0.0.1:8001/workflow/cases/<UUID>"
```
**Should return**: Case details (not 404)

---

## Files Changed
- `backend/app/workflow/router.py` - Added `/dev/cases-ids` endpoint
- `frontend/src/api/workflowApi.ts` - Added `getCaseSubmission()` function
- `frontend/src/features/cases/CaseDetailsPanel.tsx` - Use API instead of demo store

---

## If It Still Doesn't Work

### "Case not found" still appears
1. **Check API mode**
   - Browser console: should see `Backend health check: ✅ OK`
   - If not, restart backend

2. **Check Network tab**
   - DevTools → Network
   - Look for `GET /workflow/cases/<UUID>`
   - If 404, case doesn't exist
   - If no request, API mode disabled

3. **Check debug info**
   - "Case not found" screen now shows:
     - Case ID
     - API Mode (Yes/No)
     - API Base URL
   - If API Mode = No, backend unreachable

### List still shows 6 cases
1. **Check backend response**
   ```powershell
   curl "http://127.0.0.1:8001/workflow/cases?limit=1000" | jq '.total'
   ```
   Should return total count (e.g., 16)

2. **Check filters**
   - Default filter should be "All"
   - "My Cases" / "Unassigned" / "Overdue" will reduce count
   - Click "All" to see everything

### Clear browser cache
```javascript
// Browser console:
localStorage.clear();
sessionStorage.clear();
location.reload();
```

---

## Summary
| Before | After |
|--------|-------|
| Only 6 cases shown | All cases shown (16+) |
| "Case not found" error | Case details load |
| demo-wq-* IDs | Real UUIDs |
| Demo store data | Backend API data |

**Status**: ✅ Fixed and tested

See [VERIFIER_WORKSPACE_FIX.md](VERIFIER_WORKSPACE_FIX.md) for full details.
