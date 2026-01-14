# PHASE 1 CONNECTION FIX - COMPLETE

## Problem Statement

**CRITICAL BUG**: Submitted cases not appearing in Verifier Console queue.

**Root Cause**: Backend used relative SQLite database path (`./app/data/autocomply.db`), causing different DB files to be read/written depending on the working directory where the backend was started.

```
# Example of the problem:
# Started from backend/
python -m uvicorn src.api.main:app
→ Uses: backend/app/data/autocomply.db

# Started from project root
python -m uvicorn backend.src.api.main:app  
→ Uses: autocomply-ai-fresh/app/data/autocomply.db  ❌ DIFFERENT FILE!
```

---

## Solution Implemented

### 1. Absolute Database Path (config.py)

**Changed from relative to absolute path:**

```python
# BEFORE - Broken (relative path)
class Settings(BaseSettings):
    DB_PATH: str = Field(default="app/data/autocomply.db")
    DATABASE_URL: str = Field(default="sqlite:///./app/data/autocomply.db")

# AFTER - Fixed (absolute path)
from pathlib import Path

# Module-level constants computed once at import
_BACKEND_ROOT = Path(__file__).resolve().parent.parent  # /path/to/backend/
_DEFAULT_DB_PATH = _BACKEND_ROOT / "app" / "data" / "autocomply.db"
_DEFAULT_EXPORT_DIR = _BACKEND_ROOT / "exports"

class Settings(BaseSettings):
    DB_PATH: str = Field(default=str(_DEFAULT_DB_PATH))
    DATABASE_URL: str = Field(default=f"sqlite:///{_DEFAULT_DB_PATH}")
    EXPORT_DIR: str = Field(default=str(_DEFAULT_EXPORT_DIR))
```

**Why this works:**
- `Path(__file__).resolve()` returns absolute path to config.py file
- `.parent.parent` navigates up to backend/ directory
- Path is computed once at module import, not at runtime
- Same path used regardless of where backend process starts

---

### 2. Debug Endpoint (workflow/router.py)

**Added `/workflow/dev/db-info` endpoint for runtime verification:**

```python
@router.get("/dev/db-info")
def get_db_info():
    """Debug endpoint to verify database path and connection."""
    from src.config import get_settings
    from src.core.db import execute_sql
    import os
    
    settings = get_settings()
    db_path = settings.DB_PATH
    cwd = os.getcwd()
    
    # Count records
    cases_result = execute_sql("SELECT COUNT(*) as count FROM cases", {})
    cases_count = cases_result[0]["count"] if cases_result else 0
    
    submissions_result = execute_sql("SELECT COUNT(*) as count FROM submissions", {})
    submissions_count = submissions_result[0]["count"] if submissions_result else 0
    
    return {
        "db_path": db_path,              # Absolute path to database
        "db_exists": os.path.exists(db_path),  # File existence check
        "cwd": cwd,                      # Current working directory
        "cases_count": cases_count,      # Total cases in DB
        "submissions_count": submissions_count,  # Total submissions in DB
    }
```

**Usage:**
```powershell
curl http://127.0.0.1:8001/workflow/dev/db-info
```

**Example Response:**
```json
{
  "db_path": "C:\\Users\\soura\\Documents\\Projects\\Projects\\AutoComply-AI-fresh\\backend\\app\\data\\autocomply.db",
  "db_exists": true,
  "cwd": "C:\\Users\\soura\\Documents\\Projects\\Projects\\AutoComply-AI-fresh\\backend",
  "cases_count": 5,
  "submissions_count": 5
}
```

---

### 3. Logging (submissions/router.py + workflow/router.py)

**Added logging to track database operations:**

#### POST /submissions Logging
```python
import logging
logger = logging.getLogger(__name__)

@router.post("/submissions", ...)
def create_submission(...):
    # ... submission creation logic ...
    
    case = create_case(case_input)
    
    # Log for debugging
    from src.config import get_settings
    db_path = get_settings().DB_PATH
    logger.info(f"✓ Created submission {submission.id} + case {case.id} in DB: {db_path}")
    
    return submission
```

#### GET /workflow/cases Logging
```python
import logging
logger = logging.getLogger(__name__)

@router.get("/cases", ...)
def get_workflow_cases(...):
    # ... query logic ...
    
    items, total = list_cases(filters, limit, offset, sort_by, sort_dir)
    
    # Log for debugging
    from src.config import get_settings
    db_path = get_settings().DB_PATH
    logger.info(f"✓ GET /workflow/cases: Retrieved {len(items)}/{total} cases from DB: {db_path}")
    
    return PaginatedCasesResponse(...)
```

**Log Output Example:**
```
INFO:     ✓ Created submission 550e8400-e29b-41d4-a716-446655440000 + case 550e8400-e29b-41d4-a716-446655440001 in DB: C:\...\backend\app\data\autocomply.db
INFO:     ✓ GET /workflow/cases: Retrieved 5/5 cases from DB: C:\...\backend\app\data\autocomply.db
```

---

## Files Changed

### Backend Files Modified

1. **backend/src/config.py** (Lines 1-60)
   - Changed DB_PATH from relative to absolute
   - Changed DATABASE_URL to use absolute path
   - Added `_BACKEND_ROOT`, `_DEFAULT_DB_PATH`, `_DEFAULT_EXPORT_DIR` module constants

2. **backend/app/submissions/router.py** (Lines 1-20, 138-148)
   - Added logging import
   - Added log statement after case creation with DB path

3. **backend/app/workflow/router.py** (Lines 1-100, 257-270)
   - Added logging import
   - Added `/dev/db-info` debug endpoint
   - Added log statement in GET /cases endpoint

### Frontend Files (No Changes Needed)

Frontend already correctly configured:
- ✅ API base URL resolves to `http://127.0.0.1:8001` for localhost
- ✅ Store selector checks backend health and prefers API over demo data
- ✅ No hardcoded mock data interference when backend is available

---

## Verification Steps

### Quick Test (Automated)

Run the provided test script:
```powershell
.\test_phase1_connection.ps1
```

**This script:**
1. Checks backend health
2. Verifies database path is absolute
3. Submits a test case
4. Verifies case appears in workflow queue
5. Checks database counts increased

---

### Manual Test (UI)

**1. Start Backend**
```powershell
cd backend
.venv\Scripts\python.exe -m uvicorn src.api.main:app --reload --host 127.0.0.1 --port 8001
```

**2. Check Database Info**
```powershell
curl http://127.0.0.1:8001/workflow/dev/db-info
```

**Expected Output:**
```json
{
  "db_path": "C:\\...\\AutoComply-AI-fresh\\backend\\app\\data\\autocomply.db",
  "db_exists": true,
  "cwd": "C:\\...\\AutoComply-AI-fresh\\backend",
  "cases_count": 0,
  "submissions_count": 0
}
```

**3. Start Frontend**
```powershell
cd frontend
npm run dev
```

**4. Submit Case via UI**
- Open http://localhost:5173
- Navigate to CSF Practitioner submission form
- Fill out form and submit
- **Watch backend logs** for:
  ```
  ✓ Created submission <id> + case <id> in DB: C:\...\backend\app\data\autocomply.db
  ```

**5. Check Verifier Console**
- Navigate to Verifier Console / Work Queue
- **Case should appear immediately**
- **Watch backend logs** for:
  ```
  ✓ GET /workflow/cases: Retrieved 1/1 cases from DB: C:\...\backend\app\data\autocomply.db
  ```

**6. Verify Same DB Path**
Both log statements should show **identical database paths**.

---

## Curl Commands for Manual Testing

### 1. Check Backend Health
```bash
curl http://127.0.0.1:8001/workflow/health
```

### 2. Get Database Info
```bash
curl http://127.0.0.1:8001/workflow/dev/db-info
```

### 3. Submit Test Case
```bash
curl -X POST http://127.0.0.1:8001/submissions \
  -H "Content-Type: application/json" \
  -d '{
    "decisionType": "csf_practitioner",
    "formData": {
      "name": "Dr. Test",
      "specialty": "Cardiology",
      "licenseNumber": "TEST-12345"
    }
  }'
```

### 4. Get Workflow Cases
```bash
curl "http://127.0.0.1:8001/workflow/cases?limit=100"
```

### 5. Get Specific Case
```bash
curl "http://127.0.0.1:8001/workflow/cases/{case-id}"
```

---

## Expected Behavior After Fix

### ✅ Before Submission
```powershell
curl http://127.0.0.1:8001/workflow/dev/db-info
# Response: { "cases_count": 0, "submissions_count": 0 }
```

### ✅ After Submission
```powershell
# Submit case
curl -X POST http://127.0.0.1:8001/submissions -H "Content-Type: application/json" -d '{...}'

# Check counts again
curl http://127.0.0.1:8001/workflow/dev/db-info
# Response: { "cases_count": 1, "submissions_count": 1 }  ← Increased!

# Get workflow queue
curl http://127.0.0.1:8001/workflow/cases
# Response: { "items": [...], "total": 1 }  ← Case appears!
```

### ✅ Backend Logs Show Same DB
```
INFO: ✓ Created submission abc123... + case def456... in DB: C:\...\backend\app\data\autocomply.db
INFO: ✓ GET /workflow/cases: Retrieved 1/1 cases from DB: C:\...\backend\app\data\autocomply.db
                                                           ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
                                                           Same path = same database!
```

---

## Troubleshooting

### Problem: Case still not appearing in queue

**Check 1: Verify absolute path**
```powershell
curl http://127.0.0.1:8001/workflow/dev/db-info
```
- `db_path` should start with `C:\` (Windows) or `/` (Unix)
- Should NOT contain `./` or be relative

**Check 2: Check backend logs**
- Look for submission creation log
- Look for GET cases log
- Verify both show **identical** database paths

**Check 3: Verify frontend API base**
- Open browser DevTools → Console
- Should see: `[API] Using base URL: http://127.0.0.1:8001`
- Should NOT see: `[WorkflowStore] Backend unavailable, using localStorage fallback`

**Check 4: Clear demo data**
If browser cached demo data:
```javascript
// In browser console:
localStorage.clear();
location.reload();
```

---

### Problem: Database path still relative

**Solution:** Restart backend to reload config module:
```powershell
# Stop backend (Ctrl+C)
# Restart
cd backend
.venv\Scripts\python.exe -m uvicorn src.api.main:app --reload --host 127.0.0.1 --port 8001
```

---

### Problem: Different paths in logs

**Example of INCORRECT behavior:**
```
✓ Created submission ... in DB: C:\Projects\backend\app\data\autocomply.db
✓ GET /workflow/cases ... in DB: C:\Projects\app\data\autocomply.db
                                              ^^^^^ Missing "backend" folder!
```

**Solution:** Check how backend was started. Ensure started from `backend/` directory:
```powershell
cd backend  # ← Important!
.venv\Scripts\python.exe -m uvicorn src.api.main:app ...
```

---

## Testing Checklist

- [ ] Backend starts without errors
- [ ] `/workflow/dev/db-info` returns absolute path
- [ ] Database path starts with drive letter or `/`
- [ ] Submit case via UI creates submission
- [ ] Backend logs show case creation with DB path
- [ ] Case appears in Verifier Console queue
- [ ] Backend logs show GET cases with SAME DB path
- [ ] Case details are correct in queue
- [ ] Counts in `/dev/db-info` increase after submission

---

## Related Files

- `backend/src/config.py` - Configuration with absolute paths
- `backend/src/core/db.py` - Database engine initialization
- `backend/app/submissions/router.py` - Submission endpoint with logging
- `backend/app/workflow/router.py` - Workflow endpoints with logging
- `frontend/src/lib/api.ts` - API base URL resolution
- `frontend/src/workflow/workflowStoreSelector.ts` - Backend health check

---

## Summary

**Problem**: Relative database path caused submitter and verifier to use different SQLite files.

**Solution**: 
1. Changed database path to absolute using `Path(__file__).resolve()`
2. Added debug endpoint to verify runtime database path
3. Added logging to track which database is used for each operation

**Result**: Submitter and verifier now ALWAYS use the same database file, regardless of where backend is started.

**Verification**: Run `.\test_phase1_connection.ps1` or submit via UI and check queue.

---

**Status**: ✅ COMPLETE - Ready for testing
