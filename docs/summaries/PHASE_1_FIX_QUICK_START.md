# PHASE 1 FIX - QUICK START

## Problem Fixed
✅ Submitted cases now appear in Verifier Console queue

## What Was Wrong
Database path was relative → submitter and verifier used different SQLite files

## What Was Fixed
Database path is now absolute → both use the same file

---

## Quick Test (30 seconds)

### 1. Start Backend
```powershell
cd backend
.venv\Scripts\python.exe -m uvicorn src.api.main:app --reload --host 127.0.0.1 --port 8001
```

### 2. Run Test Script
```powershell
.\test_phase1_connection.ps1
```

**Expected Output:**
```
✅ Backend is healthy
✅ Database path is absolute
✅ Submission created
✅ Case found in workflow queue!
✅ PHASE 1 CONNECTION FIX VERIFIED!
```

---

## Manual UI Test

### 1. Start Frontend
```powershell
cd frontend
npm run dev
```

### 2. Submit Case
- Open http://localhost:5173
- Go to CSF Practitioner form
- Fill and submit

### 3. Check Verifier Console
- Go to Verifier Console → Work Queue
- **Case should appear immediately** ✅

---

## Debug Commands

### Check Database Path
```powershell
curl http://127.0.0.1:8001/workflow/dev/db-info
```

**Should show:**
```json
{
  "db_path": "C:\\...\\backend\\app\\data\\autocomply.db",  ← Absolute path
  "db_exists": true,
  "cases_count": 5,
  "submissions_count": 5
}
```

### Check Backend Logs
After submitting a case, you should see:
```
INFO: ✓ Created submission abc... + case def... in DB: C:\...\backend\app\data\autocomply.db
INFO: ✓ GET /workflow/cases: Retrieved 1/1 cases from DB: C:\...\backend\app\data\autocomply.db
                                                          ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
                                                          Same path = working correctly!
```

---

## Files Changed
- `backend/src/config.py` - Absolute database path
- `backend/app/submissions/router.py` - Added logging
- `backend/app/workflow/router.py` - Added logging + debug endpoint

---

## If It Still Doesn't Work

1. **Restart backend** (to reload config)
2. **Clear browser cache** (`localStorage.clear()` in console)
3. **Check logs** show same DB path
4. **Run test script** to verify programmatically

---

## Next Steps
- ✅ Phase 1 fixed (submission → queue)
- 🚧 Phase 2 pending (verifier actions UI)

See [PHASE_1_CONNECTION_FIX.md](PHASE_1_CONNECTION_FIX.md) for full details.
