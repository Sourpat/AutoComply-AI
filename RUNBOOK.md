# AutoComply AI - Developer Runbook

## Quick Start Guide

This runbook provides step-by-step instructions to start the AutoComply AI application (backend + frontend) on Windows.

---

## Prerequisites

- Python 3.12 (backend virtual environment already configured)
- Node.js (frontend dependencies already installed)
- Ports 8001 (backend) and 5173 (frontend) available

---

## Starting the Application

### Option 1: Using VS Code Tasks (Recommended)

The easiest way to start both servers:

1. Open VS Code in the workspace: `c:\Users\soura\Documents\Projects\Projects\AutoComply-AI-fresh`

2. Run the backend task:
   - Press `Ctrl+Shift+P`
   - Type "Tasks: Run Task"
   - Select `HITL: Backend API (8001)`
   
3. Run the frontend task:
   - Press `Ctrl+Shift+P`
   - Type "Tasks: Run Task"
   - Select `HITL: Frontend Dev`

4. Access the application:
   - Frontend: http://localhost:5173/
   - Console: http://localhost:5173/console
   - Backend API: http://127.0.0.1:8001/
   - API Health: http://127.0.0.1:8001/health

### Option 2: Manual PowerShell Commands

#### Start Backend (Port 8001)

```powershell
# Open PowerShell terminal 1 (Backend)
cd c:\Users\soura\Documents\Projects\Projects\AutoComply-AI-fresh\backend
Set-Location c:\Users\soura\Documents\Projects\Projects\AutoComply-AI-fresh\backend
& .\.venv\Scripts\uvicorn.exe src.api.main:app --reload --host 127.0.0.1 --port 8001
```

Expected output:
```
INFO:     Uvicorn running on http://127.0.0.1:8001 (Press CTRL+C to quit)
INFO:     Started server process
✓ Database initialized successfully
INFO:     Application startup complete.
```

#### Start Frontend (Port 5173)

```powershell
# Open PowerShell terminal 2 (Frontend)
cd c:\Users\soura\Documents\Projects\Projects\AutoComply-AI-fresh\frontend
npm run dev
```

Expected output:
```
VITE v5.4.21  ready in 256 ms
➜  Local:   http://localhost:5173/
➜  Network: use --host to expose
```

---

## Verifying the Servers

### Check Backend Health

```powershell
curl.exe http://127.0.0.1:8001/health
```

Expected response:
```json
{"ok":true,"status":"ok","service":"autocomply-ai","version":"0.1.0","checks":{"fastapi":"ok","csf_suite":"ok","license_suite":"ok","rag_layer":"ok"}}
```

### Check Frontend

```powershell
curl.exe http://localhost:5173/
```

Should return HTML content with React app.

### Check Active Ports

```powershell
netstat -ano | Select-String "8001|5173" | Select-String "LISTENING"
```

Expected output:
```
TCP    127.0.0.1:8001         0.0.0.0:0              LISTENING       <PID>
TCP    [::1]:5173             [::]:0                 LISTENING       <PID>
```

---

## Stopping the Servers

### If using VS Code Tasks:
- Click the trash icon in the terminal panel for each task

### If using manual PowerShell:
- Press `Ctrl+C` in each terminal

### Force kill (if needed):

```powershell
# Find processes
netstat -ano | Select-String "8001|5173" | Select-String "LISTENING"

# Kill backend (replace <PID> with actual PID)
taskkill /PID <backend_pid> /F

# Kill frontend (replace <PID> with actual PID)
taskkill /PID <frontend_pid> /F
```

---

## Troubleshooting

### Port Already in Use

**Symptom:** `Error: listen EADDRINUSE: address already in use`

**Solution:**
```powershell
# Find which process is using the port
netstat -ano | findstr :8001
netstat -ano | findstr :5173

# Kill the process
taskkill /PID <process_id> /F
```

### Backend Module Not Found

**Symptom:** `ModuleNotFoundError: No module named 'src'`

**Solution:** Make sure you're running uvicorn from the `backend` directory:
```powershell
cd c:\Users\soura\Documents\Projects\Projects\AutoComply-AI-fresh\backend
Set-Location c:\Users\soura\Documents\Projects\Projects\AutoComply-AI-fresh\backend
& .\.venv\Scripts\uvicorn.exe src.api.main:app --reload --host 127.0.0.1 --port 8001
```

### Frontend ERR_CONNECTION_REFUSED

**Symptom:** Browser shows "ERR_CONNECTION_REFUSED" on http://localhost:5173/

**Possible causes:**
1. Frontend not started - verify with: `netstat -ano | findstr :5173`
2. Using `127.0.0.1` instead of `localhost` - Vite binds to IPv6 `[::1]` by default
3. Windows firewall blocking - temporarily disable or add exception

**Solution:** Use `http://localhost:5173/` (not `http://127.0.0.1:5173/`)

### Frontend Cannot Connect to Backend

**Symptom:** Frontend loads but API calls fail

**Solution:**
1. Verify backend is running: `curl.exe http://127.0.0.1:8001/health`
2. Check frontend `.env` or `vite.config.js` for correct backend URL
3. Ensure CORS is configured in backend (`src/api/main.py`)

---

## Development URLs

| Service | URL | Purpose |
|---------|-----|---------|
| **Frontend Home** | http://localhost:5173/ | Main application entry |
| **Console** | http://localhost:5173/console | Admin console |
| **Backend API** | http://127.0.0.1:8001/ | REST API endpoints |
| **API Health** | http://127.0.0.1:8001/health | Backend health check |
| **API Docs** | http://127.0.0.1:8001/docs | Interactive API documentation (Swagger) |
| **OpenAPI Schema** | http://127.0.0.1:8001/openapi.json | OpenAPI specification |

---

## Important Notes

### Localhost vs 127.0.0.1

- **Backend:** Uses `127.0.0.1` (IPv4)
- **Frontend:** Uses `localhost` which resolves to `[::1]` (IPv6 on Windows)
- Always use `http://localhost:5173/` for frontend, not `http://127.0.0.1:5173/`

### Auto-Reload

Both servers support hot reload:
- **Backend:** Uvicorn watches Python files and reloads on changes
- **Frontend:** Vite watches React components and triggers HMR (Hot Module Replacement)

### First-Time Setup

If running for the first time:

```powershell
# Backend - Install dependencies
cd backend
.\.venv\Scripts\python.exe -m pip install -r requirements.txt

# Frontend - Install dependencies
cd frontend
npm install
```

---

## Quick Reference Commands

```powershell
# Start backend (from backend directory)
& .\.venv\Scripts\uvicorn.exe src.api.main:app --reload --host 127.0.0.1 --port 8001

# Start frontend (from frontend directory)
npm run dev

# Test backend health
curl.exe http://127.0.0.1:8001/health

# Test frontend
curl.exe http://localhost:5173/

# Check running ports
netstat -ano | Select-String "8001|5173" | Select-String "LISTENING"

# Kill process by PID
taskkill /PID <process_id> /F
```

---

## Success Criteria

✅ Backend running: `curl.exe http://127.0.0.1:8001/health` returns JSON with `"ok":true`  
✅ Frontend running: `curl.exe http://localhost:5173/` returns HTML  
✅ Console accessible: Browser opens http://localhost:5173/console without errors  
✅ Both ports listening: `netstat` shows 8001 and 5173 in LISTENING state

---

**Last Updated:** 2026-01-15  
**Environment:** Windows, Python 3.12, Node.js, VS Code
