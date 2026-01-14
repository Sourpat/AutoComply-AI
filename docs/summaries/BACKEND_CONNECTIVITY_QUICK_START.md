# Backend Connectivity - Quick Start

## 🚀 Start Backend & Frontend (30 seconds)

### Terminal 1: Backend
```powershell
cd backend
uvicorn src.api.main:app --reload --host 127.0.0.1 --port 8001
```

**✅ Success when you see:**
```
🚀 API will be available at: http://127.0.0.1:8001
🏥 Health check: http://127.0.0.1:8001/health
📊 Workflow API: http://127.0.0.1:8001/workflow
✓ Startup complete - ready to accept requests
```

### Terminal 2: Frontend
```powershell
cd frontend
npm run dev
```

**✅ Success when you see:**
```
VITE v5.x.x ready in xxx ms
➜  Local:   http://localhost:5173/
```

## ✅ Verify (10 seconds)

### Manual Check
1. Open browser: http://localhost:5173
2. **Should see:** Cases load, no "Backend Not Reachable" toast
3. **Should NOT see:** 4 demo cases (demo-wq-1, demo-wq-2, etc.)

### Automated Test
```powershell
.\test_backend_connectivity.ps1
```

Expected: `✅ ALL TESTS PASSED!`

## ❌ Troubleshooting

### "Backend Not Reachable" persists

**Quick fix:**
```powershell
# 1. Check backend is running
curl http://127.0.0.1:8001/health

# Expected: {"ok":true,"status":"healthy"}

# 2. If fails, check port 8001
netstat -ano | findstr :8001

# 3. Kill existing process if needed
taskkill /F /PID <PID>

# 4. Restart backend
cd backend
uvicorn src.api.main:app --reload --host 127.0.0.1 --port 8001
```

### Frontend shows 0 cases

**Check backend has data:**
```powershell
curl http://127.0.0.1:8001/workflow/cases
```

If empty, seed database:
```powershell
cd backend
.venv/Scripts/python scripts/seed_kb.py
```

### CORS errors

**Add to backend/.env:**
```bash
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173,*
```

Restart backend.

## 📋 Environment Variables

### Backend (.env) - Optional
```bash
PORT=8001
APP_ENV=dev
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173,*
```

### Frontend (.env) - Optional
```bash
# Leave empty for auto-detection
VITE_API_BASE_URL=

# OR set explicitly
VITE_API_BASE_URL=http://127.0.0.1:8001
```

## 🔍 What Changed

**Backend:**
- ✅ Added root `/health` endpoint
- ✅ Enhanced startup logging with exact URLs
- ✅ Improved CORS defaults

**Frontend:**
- ✅ Removed demo fallback (now throws error if backend unreachable)
- ✅ Added error banner in CaseWorkspace
- ✅ Improved health check (2s timeout, 15s interval)

**Result:**
- **Before:** Backend down → Shows 4 demo cases (confusing)
- **After:** Backend down → Shows error banner + retry button (clear)

## 📖 Full Documentation

See [BACKEND_CONNECTIVITY_FIX.md](BACKEND_CONNECTIVITY_FIX.md) for:
- Detailed problem analysis
- Complete solution breakdown
- All files changed
- Comprehensive troubleshooting
