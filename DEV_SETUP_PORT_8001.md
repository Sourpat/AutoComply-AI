# AutoComply-AI Development Setup (Windows Port 8001 Workaround)

## 🔧 Port Configuration

Due to Windows permission restrictions (WinError 10013), the backend runs on **port 8001** instead of the standard port 8000.

### Quick Start

**Terminal 1 - Backend:**
```powershell
cd backend
.\.venv\Scripts\Activate.ps1
uvicorn src.api.main:app --host 127.0.0.1 --port 8001 --reload
```

**Terminal 2 - Frontend:**
```powershell
cd frontend
npm run dev
```

**Access:**
- Frontend: http://localhost:5173
- Backend API: http://127.0.0.1:8001
- Health Check: http://127.0.0.1:8001/health
- API Docs: http://127.0.0.1:8001/docs

## 📋 Environment Configuration

### Frontend (.env.local - ALREADY CONFIGURED)
```bash
VITE_API_BASE=http://127.0.0.1:8001
```

**⚠️ DO NOT CHANGE .env.local** - It's already set correctly for port 8001.

### Backend (No changes needed)
Backend automatically binds to port 8001 via command-line flag.

## ✅ Verification Checklist

### 1. Backend Health Check
```powershell
Invoke-WebRequest -Uri "http://127.0.0.1:8001/health"
```

Expected output:
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

### 2. Test CSF Endpoints

**Hospital CSF Evaluate:**
```powershell
$payload = @{
    facility_name = "Test Hospital"
    facility_type = "hospital"
    account_number = "TEST123"
    pharmacy_license_number = "PH12345"
    dea_number = "AB1234567"
    pharmacist_in_charge_name = "Dr. Test"
    ship_to_state = "NY"
    attestation_accepted = $true
    controlled_substances = @()
} | ConvertTo-Json

Invoke-WebRequest -Uri "http://127.0.0.1:8001/csf/hospital/evaluate" `
    -Method POST `
    -Body $payload `
    -ContentType "application/json"
```

Expected: HTTP 200 with decision response

**Practitioner CSF Evaluate:**
```powershell
$payload = @{
    facility_name = "Test Clinic"
    facility_type = "group_practice"
    account_number = "TEST456"
    practitioner_name = "Dr. Smith"
    state_license_number = "NY-12345"
    dea_number = "BS1234567"
    ship_to_state = "NY"
    attestation_accepted = $true
} | ConvertTo-Json

Invoke-WebRequest -Uri "http://127.0.0.1:8001/csf/practitioner/evaluate" `
    -Method POST `
    -Body $payload `
    -ContentType "application/json"
```

Expected: HTTP 200 with decision response

### 3. Frontend Connectivity

1. Open http://localhost:5173
2. Check **bottom-right corner** for backend connection indicator:
   - 🟢 Green = Connected
   - 🔴 Red = Disconnected (check backend is running)
3. Navigate to any CSF sandbox
4. Click "Evaluate" - should complete without "Evaluating..." stuck state
5. Check browser console for API requests to `http://127.0.0.1:8001`

## 🐛 Troubleshooting

### Blank Screen on Frontend

**Symptom:** White/blank page with no errors in console

**Solution:**
1. Check ErrorBoundary is rendering (should show error UI if something breaks)
2. Check backend connection indicator (bottom-right)
3. Open browser DevTools → Console for JavaScript errors
4. Verify backend is running: `curl http://127.0.0.1:8001/health`

### "Evaluating..." Stuck Forever

**Symptom:** Evaluate button shows "Evaluating..." and never completes

**Root Causes:**
1. Backend not running on port 8001
2. CORS issues
3. Network timeout (default 15s)
4. API endpoint error not handled properly

**Debug Steps:**
```powershell
# 1. Check backend is running
Invoke-WebRequest -Uri "http://127.0.0.1:8001/health"

# 2. Check browser console for:
# - CORS errors
# - Network timeouts
# - 422 validation errors
# - 500 server errors

# 3. Check backend logs for exceptions
```

### "Request timeout after 15000ms"

**Symptom:** Error message about timeout after 15 seconds

**Solution:**
1. Backend might not be running
2. Backend might be running on wrong port (check 8000 vs 8001)
3. Firewall blocking localhost connections
4. Backend crashed during request processing

**Fix:**
```powershell
# Kill all Python processes
Get-Process python | Stop-Process -Force

# Restart backend
cd backend
.\.venv\Scripts\Activate.ps1
uvicorn src.api.main:app --host 127.0.0.1 --port 8001 --reload
```

### Port 8001 Already in Use

**Symptom:** `ERROR: [Errno 10048] error while attempting to bind on address`

**Solution:**
```powershell
# Find process using port 8001
Get-NetTCPConnection -LocalPort 8001 | Select-Object OwningProcess

# Kill it
Stop-Process -Id <PID> -Force

# Or use different port
uvicorn src.api.main:app --host 127.0.0.1 --port 8002 --reload
# (Don't forget to update VITE_API_BASE if you change port)
```

## 🔍 Code Changes Made

### API Base Configuration
All hardcoded `http://127.0.0.1:8000` references updated to `8001`:

1. **frontend/src/lib/api.ts** - Default API_BASE for local dev
2. **frontend/src/lib/apiBase.ts** - Backup API_BASE configuration
3. **frontend/src/services/api.js** - Legacy API base

### New Components

1. **ErrorBoundary** (`frontend/src/components/ErrorBoundary.tsx`)
   - Catches React errors
   - Shows user-friendly error UI instead of blank screen
   - Provides reload and navigation options

2. **BackendConnectionIndicator** (`frontend/src/components/BackendConnectionIndicator.tsx`)
   - Real-time backend health monitoring
   - Shows connection status in bottom-right corner
   - Auto-checks every 30 seconds
   - Displays helpful troubleshooting tips when disconnected

### App.jsx Updates
- Wrapped entire app in `<ErrorBoundary>`
- Added `<BackendConnectionIndicator />` to layout

## 📊 Testing All CSF Types

### Complete Test Suite

```powershell
# Set common headers
$headers = @{ "Content-Type" = "application/json" }
$baseUrl = "http://127.0.0.1:8001"

# Test Hospital CSF
Write-Host "Testing Hospital CSF..." -ForegroundColor Cyan
$hospitalPayload = '{"facility_name":"Test Hospital","facility_type":"hospital","account_number":"T1","pharmacy_license_number":"P1","dea_number":"D1","pharmacist_in_charge_name":"Dr","ship_to_state":"NY","attestation_accepted":true,"controlled_substances":[]}'
Invoke-WebRequest -Uri "$baseUrl/csf/hospital/evaluate" -Method POST -Body $hospitalPayload -Headers $headers

# Test Practitioner CSF
Write-Host "Testing Practitioner CSF..." -ForegroundColor Cyan
$practPayload = '{"facility_name":"Clinic","facility_type":"group_practice","account_number":"T2","practitioner_name":"Dr. Smith","state_license_number":"NY-123","dea_number":"BS123","ship_to_state":"NY","attestation_accepted":true}'
Invoke-WebRequest -Uri "$baseUrl/csf/practitioner/evaluate" -Method POST -Body $practPayload -Headers $headers

# Test Facility CSF
Write-Host "Testing Facility CSF..." -ForegroundColor Cyan
$facilityPayload = '{"facility_name":"Facility","facility_type":"facility","account_number":"T3","pharmacy_license_number":"P2","dea_number":"D2","pharmacist_in_charge_name":"Dr","ship_to_state":"NY","attestation_accepted":true,"controlled_substances":[]}'
Invoke-WebRequest -Uri "$baseUrl/csf/facility/evaluate" -Method POST -Body $facilityPayload -Headers $headers

# Test EMS CSF
Write-Host "Testing EMS CSF..." -ForegroundColor Cyan
$emsPayload = '{"facility_name":"EMS Service","facility_type":"facility","account_number":"T4","pharmacy_license_number":"P3","dea_number":"D3","pharmacist_in_charge_name":"Dr","ship_to_state":"NY","attestation_accepted":true,"controlled_substances":[]}'
Invoke-WebRequest -Uri "$baseUrl/csf/ems/evaluate" -Method POST -Body $emsPayload -Headers $headers

# Test Researcher CSF
Write-Host "Testing Researcher CSF..." -ForegroundColor Cyan
$researcherPayload = '{"facility_name":"Research Lab","facility_type":"researcher","account_number":"T5","pharmacy_license_number":"P4","dea_number":"D4","pharmacist_in_charge_name":"Dr","ship_to_state":"MA","attestation_accepted":true,"controlled_substances":[]}'
Invoke-WebRequest -Uri "$baseUrl/csf/researcher/evaluate" -Method POST -Body $researcherPayload -Headers $headers

Write-Host "All CSF tests complete!" -ForegroundColor Green
```

## 🎯 Expected Results

### All Endpoints Should Return:
- **HTTP 200** status code
- JSON response with decision data
- `trace_id` in response for trace replay
- No CORS errors
- Response time < 3 seconds

### Compliance Console Trace Replay
1. Submit a CSF form (any type)
2. Navigate to Compliance Console at http://localhost:5173/console
3. Find submission in work queue
4. Click "Open trace" button
5. Should see trace timeline with evaluation steps

## 🚀 Production Deployment

For production, set `VITE_API_BASE` to your actual backend URL:

```bash
# .env.production
VITE_API_BASE=https://api.autocomply.example.com
```

The app will automatically use the correct backend URL based on environment.

## 📝 Notes

- **Port 8001** is specific to Windows development environment
- On Linux/Mac, you can use port 8000 without issues
- All CSF clients now use centralized `apiFetch` with 15s timeout
- Error messages are parsed from FastAPI validation responses
- Trace recording works consistently across all CSF types
- Backend health is monitored in real-time via UI indicator
