# Dev Server Quick Start Guide

## ✅ SERVERS ARE NOW RUNNING

### Current Status
- **Backend (FastAPI):** http://127.0.0.1:8001 ✅
- **Frontend (Vite):** http://localhost:5173 ✅

---

## Quick Start (Next Time)

### Option 1: Manual Startup (Separate Terminals)

**Terminal 1 - Backend:**
```powershell
cd backend
.venv\Scripts\python -m uvicorn src.api.main:app --reload --host 127.0.0.1 --port 8001
```

**Terminal 2 - Frontend:**
```powershell
cd frontend
npm run dev -- --host --port 5173
```

### Option 2: Using Root Scripts

From project root:

```powershell
# Start backend (Terminal 1)
npm run dev:backend

# Start frontend (Terminal 2)
npm run dev:frontend

# Check if ports are in use
npm run ports:check

# Kill processes on ports 5173/8001
npm run ports:kill
```

---

## Troubleshooting

### ERR_CONNECTION_REFUSED

**Problem:** http://localhost:5173 or http://localhost:8001 not accessible

**Solution:**
```powershell
# 1. Check what's using the ports
netstat -ano | findstr :5173
netstat -ano | findstr :8001

# 2. Kill processes if needed
taskkill /F /PID <PID>

# OR kill all python/node processes
Stop-Process -Name python,node -Force -ErrorAction SilentlyContinue

# 3. Restart servers (see Quick Start above)
```

### Port Already in Use

**Problem:** "Address already in use" error when starting servers

**Solution:**
```powershell
# Quick cleanup
npm run ports:kill

# Then restart servers
```

### Backend Import Errors

**Problem:** `ModuleNotFoundError` or import errors

**Solution:**
```powershell
cd backend
.venv\Scripts\python -m pip install -r requirements.txt
```

### Frontend Dependencies Missing

**Problem:** Vite fails to start or shows module errors

**Solution:**
```powershell
cd frontend
npm install
npm run dev -- --host --port 5173
```

---

## API Configuration

**Frontend API Base URL:** [frontend/src/lib/apiBase.ts](frontend/src/lib/apiBase.ts#L68)

```typescript
// Development: http://localhost:8001 (auto-configured)
// Production: Set VITE_API_BASE_URL environment variable
```

**Backend Entry Point:** [backend/src/api/main.py](backend/src/api/main.py)

---

## Health Checks

### Backend Health
```powershell
curl http://localhost:8001/health
```

**Expected Response:**
```json
{
  "status": "ok",
  "service": "autocomply-ai",
  "version": "0.1.0",
  "checks": {
    "fastapi": "ok",
    "csf_suite": "ok",
    "license_suite": "ok",
    "rag_layer": "ok"
  }
}
```

### Frontend Health
```powershell
curl http://localhost:5173
```

**Expected:** HTML response with Vite app

---

## Browser Access

- **Main App:** http://localhost:5173
- **Console Page:** http://localhost:5173/console
- **CSF Suite:** http://localhost:5173/csf
- **Backend API Docs:** http://localhost:8001/docs
- **Backend Health:** http://localhost:8001/health

---

## Root Package.json Scripts

Location: [package.json](package.json)

```json
{
  "scripts": {
    "dev:frontend": "cd frontend && npm run dev -- --host --port 5173",
    "dev:backend": "cd backend && .venv/Scripts/python -m uvicorn src.api.main:app --reload --host 127.0.0.1 --port 8001",
    "dev": "echo Run 'npm run dev:backend' in one terminal and 'npm run dev:frontend' in another",
    "typecheck:frontend": "cd frontend && npm run typecheck",
    "ports:check": "netstat -ano | findstr \":5173 :8001\"",
    "ports:kill": "powershell -Command \"Stop-Process -Name python,node -Force -ErrorAction SilentlyContinue; Write-Host 'Ports cleared'\""
  }
}
```

---

## Common Commands

```powershell
# Check running processes on ports
npm run ports:check

# Kill all processes on dev ports
npm run ports:kill

# Start backend only
npm run dev:backend

# Start frontend only
npm run dev:frontend

# Frontend typecheck
npm run typecheck:frontend

# Backend tests
cd backend
.venv\Scripts\python -m pytest

# Frontend tests
cd frontend
npm test
```

---

## File Structure

```
AutoComply-AI-fresh/
├── package.json              # Root scripts (NEW)
├── backend/
│   ├── .venv/                # Python virtual environment
│   ├── src/
│   │   └── api/
│   │       └── main.py       # FastAPI app entry point
│   └── requirements.txt      # Python dependencies
└── frontend/
    ├── package.json          # Frontend scripts
    ├── tsconfig.json         # TypeScript config
    ├── vite.config.ts        # Vite config
    └── src/
        ├── lib/
        │   └── apiBase.ts    # API base URL config
        └── pages/            # React pages
```

---

## Next Steps After Startup

1. ✅ **Verify Servers Are Running**
   - Backend: http://localhost:8001/health
   - Frontend: http://localhost:5173

2. ✅ **Open Frontend in Browser**
   - Navigate to http://localhost:5173/console

3. ⏳ **Test Submission Tab** (if testing removeChild fix)
   - Open any case in Console
   - Click "Submission" tab
   - Check browser DevTools console for errors
   - Verify no "removeChild" crash

4. ⏳ **Fix TypeScript Errors** (265 errors found)
   - Run: `npm run typecheck:frontend`
   - Review errors and fix systematically
   - See [SUBMISSION_TAB_CRASH_FIX.md](SUBMISSION_TAB_CRASH_FIX.md) for context

---

**Last Updated:** 2026-01-13  
**Status:** ✅ Both servers running successfully
