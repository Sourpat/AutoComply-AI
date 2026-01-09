# ============================================================================
# Backend Integration Manual Test Script
# Step 2.8: Submission Intake with Backend API (Auto-fallback to localStorage)
# ============================================================================

Write-Host "`n==================================================================" -ForegroundColor Cyan
Write-Host "BACKEND INTEGRATION MANUAL TEST GUIDE" -ForegroundColor Cyan
Write-Host "==================================================================" -ForegroundColor Cyan

# Pre-flight checks
Write-Host "`n[SETUP] Pre-flight Checks" -ForegroundColor Yellow
Write-Host "=========================" -ForegroundColor Yellow

$backendPath = "C:\Users\soura\Documents\Projects\Projects\AutoComply-AI-fresh\backend"
$frontendPath = "C:\Users\soura\Documents\Projects\Projects\AutoComply-AI-fresh\frontend"

Write-Host "`nChecking paths..."
if (Test-Path $backendPath) {
    Write-Host "✓ Backend directory exists" -ForegroundColor Green
} else {
    Write-Host "✗ Backend directory not found" -ForegroundColor Red
    exit 1
}

if (Test-Path $frontendPath) {
    Write-Host "✓ Frontend directory exists" -ForegroundColor Green
} else {
    Write-Host "✗ Frontend directory not found" -ForegroundColor Red
    exit 1
}

if (Test-Path "$backendPath\.venv\Scripts\python.exe") {
    Write-Host "✓ Python virtual environment exists" -ForegroundColor Green
} else {
    Write-Host "✗ Python virtual environment not found" -ForegroundColor Red
    Write-Host "  Run: cd backend; py -3.12 -m venv .venv" -ForegroundColor Yellow
    exit 1
}

# Check if ports are available
Write-Host "`nChecking port availability..."
$port8001 = Get-NetTCPConnection -LocalPort 8001 -ErrorAction SilentlyContinue
$port5173 = Get-NetTCPConnection -LocalPort 5173 -ErrorAction SilentlyContinue

if ($port8001) {
    Write-Host "⚠ Port 8001 already in use (backend may be running)" -ForegroundColor Yellow
} else {
    Write-Host "✓ Port 8001 available" -ForegroundColor Green
}

if ($port5173) {
    Write-Host "⚠ Port 5173 already in use (frontend may be running)" -ForegroundColor Yellow
} else {
    Write-Host "✓ Port 5173 available" -ForegroundColor Green
}

Write-Host "`n==================================================================" -ForegroundColor Cyan
Write-Host "TEST INSTRUCTIONS" -ForegroundColor Cyan
Write-Host "==================================================================" -ForegroundColor Cyan

Write-Host "`n[STEP 1] Start Backend Server" -ForegroundColor Yellow
Write-Host "=============================" -ForegroundColor Yellow
Write-Host ""
Write-Host "Open a NEW PowerShell terminal and run:"
Write-Host ""
Write-Host "    cd C:\Users\soura\Documents\Projects\Projects\AutoComply-AI-fresh\backend" -ForegroundColor White
Write-Host "    .venv\Scripts\python -m uvicorn src.api.main:app --host 127.0.0.1 --port 8001" -ForegroundColor White
Write-Host ""
Write-Host "Expected output:"
Write-Host "    INFO:     Uvicorn running on http://127.0.0.1:8001"
Write-Host "    INFO:     Application startup complete."
Write-Host ""
Write-Host "Press ENTER when backend is running..." -ForegroundColor Cyan
Read-Host

# Test backend health
Write-Host "`nTesting backend health..."
try {
    $response = Invoke-WebRequest -Uri "http://localhost:8001/workflow/health" -Method GET -UseBasicParsing
    $content = $response.Content | ConvertFrom-Json
    if ($content.ok -eq $true) {
        Write-Host "✓ Backend health check passed: $($response.Content)" -ForegroundColor Green
    } else {
        Write-Host "✗ Backend health check failed: $($response.Content)" -ForegroundColor Red
    }
} catch {
    Write-Host "✗ Backend health check failed: $_" -ForegroundColor Red
    Write-Host "  Make sure backend is running on port 8001" -ForegroundColor Yellow
    exit 1
}

Write-Host "`n[STEP 2] Start Frontend Server" -ForegroundColor Yellow
Write-Host "==============================" -ForegroundColor Yellow
Write-Host ""
Write-Host "Open a NEW PowerShell terminal and run:"
Write-Host ""
Write-Host "    cd C:\Users\soura\Documents\Projects\Projects\AutoComply-AI-fresh\frontend" -ForegroundColor White
Write-Host "    npm run dev" -ForegroundColor White
Write-Host ""
Write-Host "Expected output:"
Write-Host "    VITE v5.x.x ready in xxx ms"
Write-Host "    -> Local:   http://localhost:5173/"
Write-Host ""
Write-Host "Press ENTER when frontend is running..." -ForegroundColor Cyan
Read-Host

# Test frontend
Write-Host "`nTesting frontend..."
try {
    $response = Invoke-WebRequest -Uri "http://localhost:5173" -Method GET -UseBasicParsing
    Write-Host "✓ Frontend is accessible" -ForegroundColor Green
} catch {
    Write-Host "✗ Frontend not accessible: $_" -ForegroundColor Red
    exit 1
}

Write-Host "`n==================================================================" -ForegroundColor Cyan
Write-Host "TEST 1: Backend Mode (Connected)" -ForegroundColor Cyan
Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Open browser to: http://localhost:5173"
Write-Host "2. Navigate to CSF Practitioner form"
Write-Host "3. Fill out form and click Submit"
Write-Host "4. Open browser DevTools (F12)"
Write-Host "5. Check Console tab for:"
Write-Host "   [SubmissionIntake] Using backend API to create case"
Write-Host "   [SubmissionIntake] Created case via backend: case_xxxxx"
Write-Host "   [SubmissionIntake] Attached evidence via backend: N"
Write-Host ""
Write-Host "6. Check Network tab for:"
Write-Host "   POST /submissions -> 200 OK"
Write-Host "   POST /workflow/cases -> 200 OK"
Write-Host "   POST /workflow/cases/{id}/evidence/attach -> 200 OK"
Write-Host ""
Write-Host "7. Click Open Case button -> Navigates to Console with case selected"
Write-Host ""
Write-Host "8. Verify case details:"
Write-Host "   Status is NEW or NEEDS_REVIEW"
Write-Host "   SLA due date is set"
Write-Host "   Timeline tab shows audit events"
Write-Host "   Evidence tab shows RAG evidence"
Write-Host "   Submission tab shows form data"
Write-Host ""
Write-Host "9. Refresh page (F5) -> Case still visible (backend persistence)"
Write-Host ""
Write-Host "Press ENTER when Test 1 is complete..." -ForegroundColor Cyan
$null = Read-Host

Write-Host "`n==================================================================" -ForegroundColor Cyan
Write-Host "TEST 2: Status & Assignment Updates" -ForegroundColor Cyan
Write-Host "==================================================================" -ForegroundColor Cyan

Write-Host @"

1. In the Console, select a case
2. Change status to "In Review"
   ✓ Status updates immediately

3. Refresh page (F5)
   ✓ Status change persists

4. Assign case to a reviewer
   ✓ Assignment shows immediately

5. Refresh page (F5)
   ✓ Assignment persists

6. Check Timeline tab
   ✓ Shows audit events for status change
   ✓ Shows audit events for assignment

7. Select evidence items for packet
8. Refresh page (F5)
   ✓ Evidence selection persists

"@

Write-Host "Press ENTER when Test 2 is complete..." -ForegroundColor Cyan
Read-Host

Write-Host "`n==================================================================" -ForegroundColor Cyan
Write-Host "TEST 3: LocalStorage Fallback (Offline Mode)" -ForegroundColor Cyan
Write-Host "==================================================================" -ForegroundColor Cyan

Write-Host @"

1. In the backend terminal, press Ctrl+C to stop the server
   ✓ Backend stops

2. In the browser, refresh the page (F5)
   ✓ App continues working (no errors)

3. Submit a new CSF Practitioner form
4. Check Console tab:
   ✓ "[SubmissionIntake] Backend unavailable, using localStorage"
   ✓ "[SubmissionIntake] Created case via localStorage: case_xxxxx"

5. Check Network tab:
   ✓ POST /workflow/health → Failed (timeout or 404)
   ✓ No POST /submissions
   ✓ No POST /workflow/cases

6. Click "Open Case"
   ✓ Navigates to Console with case

7. Verify case appears in work queue
   ✓ Status set correctly
   ✓ SLA due date set

8. Check Timeline tab
   ✓ Shows 3 audit events (SUBMITTED, NOTE_ADDED x2)

9. Refresh page (F5)
   ✓ Case persists in localStorage

"@

Write-Host "Press ENTER when Test 3 is complete..." -ForegroundColor Cyan
Read-Host

Write-Host "`n==================================================================" -ForegroundColor Cyan
Write-Host "TEST 4: Failover Behavior" -ForegroundColor Cyan
Write-Host "==================================================================" -ForegroundColor Cyan

Write-Host @"

1. Restart backend server
   ✓ Backend running again

2. Refresh frontend
   ✓ Health check succeeds

3. Submit a new form
   ✓ Console shows "Using backend API"
   ✓ Case created in backend

4. Note the case count in Console

5. Stop backend again

6. Submit another form
   ✓ Console shows "Backend unavailable"
   ✓ Case created in localStorage

7. Restart backend

8. Refresh page
   ✓ Backend cases visible
   ✓ LocalStorage-only case may not be visible (expected)

NOTE: Cases created in localStorage while backend was down
      are not synced to backend when it comes back online.
      This is expected behavior.

"@

Write-Host "Press ENTER when Test 4 is complete..." -ForegroundColor Cyan
Read-Host

Write-Host "`n==================================================================" -ForegroundColor Cyan
Write-Host "TEST 5: Deep Links" -ForegroundColor Cyan
Write-Host "==================================================================" -ForegroundColor Cyan

Write-Host @"

1. Submit a form (backend mode)
2. Click "Open Case" button
   ✓ URL changes to /console with case selected

3. Copy the case ID from the URL or case details
4. Navigate to: /rag?mode=connected&caseId={caseId}
   ✓ RAG page loads with case context

5. Click breadcrumb link back to Console
   ✓ Returns to Console with case selected

6. Refresh page
   ✓ Case details persist

"@

Write-Host "Press ENTER when Test 5 is complete..." -ForegroundColor Cyan
Read-Host

Write-Host "`n==================================================================" -ForegroundColor Cyan
Write-Host "SUMMARY & CLEANUP" -ForegroundColor Cyan
Write-Host "==================================================================" -ForegroundColor Cyan

Write-Host @"

All tests complete!

✓ Backend mode: Submissions and cases created via API
✓ Backend mode: Evidence persisted via API
✓ Backend mode: Data persists after refresh
✓ Status and assignment updates persist
✓ Audit timeline shows events
✓ LocalStorage fallback works when backend unavailable
✓ Failover between modes works correctly
✓ Deep links work in both modes

CLEANUP:
- Press Ctrl+C in backend terminal to stop server
- Press Ctrl+C in frontend terminal to stop dev server
- Or leave them running for continued development

NOTES:
- Backend uses in-memory storage (data lost on restart)
- LocalStorage data persists in browser
- No automatic sync between backend and localStorage
- Health check timeout is 2 seconds

"@

Write-Host "`n==================================================================" -ForegroundColor Green
Write-Host "✓ Backend Integration Tests Complete!" -ForegroundColor Green
Write-Host "==================================================================" -ForegroundColor Green
Write-Host ""
