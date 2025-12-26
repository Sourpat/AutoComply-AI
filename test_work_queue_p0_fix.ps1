# Verification Work Queue P0 Fix - Quick Test
# Run this script to verify all fixes are working

Write-Host "=== Verification Work Queue P0 Fix - Test Suite ===" -ForegroundColor Cyan
Write-Host ""

# Test 1: Backend Tests
Write-Host "[1/3] Running backend work queue tests..." -ForegroundColor Yellow
Push-Location backend
$testResult = & .venv/Scripts/python.exe -m pytest tests/test_console_work_queue.py -v --tb=short
if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Backend work queue tests PASSED" -ForegroundColor Green
} else {
    Write-Host "✗ Backend work queue tests FAILED" -ForegroundColor Red
    Pop-Location
    exit 1
}
Pop-Location
Write-Host ""

# Test 2: Full Backend Suite
Write-Host "[2/3] Running full backend test suite..." -ForegroundColor Yellow
Push-Location backend
$allTests = & .venv/Scripts/python.exe -m pytest -q
if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ All backend tests PASSED" -ForegroundColor Green
} else {
    Write-Host "✗ Some backend tests FAILED" -ForegroundColor Red
    Pop-Location
    exit 1
}
Pop-Location
Write-Host ""

# Test 3: Frontend Build
Write-Host "[3/3] Building frontend..." -ForegroundColor Yellow
Push-Location frontend
$buildResult = npm run build 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Frontend build SUCCESSFUL" -ForegroundColor Green
} else {
    Write-Host "✗ Frontend build FAILED" -ForegroundColor Red
    Pop-Location
    exit 1
}
Pop-Location
Write-Host ""

# Summary
Write-Host "=== All Tests Passed! ===" -ForegroundColor Green
Write-Host ""
Write-Host "Changes verified:" -ForegroundColor Cyan
Write-Host "  ✓ Status mapping bug fixed (ok_to_ship → OPEN, not RESOLVED)"
Write-Host "  ✓ Console endpoint integrated (/console/work-queue)"
Write-Host "  ✓ Trace linking enabled (/console?trace={trace_id})"
Write-Host "  ✓ Regression tests added (trace_id validation, decision_status mapping)"
Write-Host ""
Write-Host "To start servers:" -ForegroundColor Yellow
Write-Host "  Backend:  cd backend; .\.venv\Scripts\python.exe -m uvicorn src.api.main:app --reload --host 127.0.0.1 --port 8001"
Write-Host "  Frontend: cd frontend; npm run dev"
