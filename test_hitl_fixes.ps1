# Test Script - HITL Production Fixes
# Run this to verify all fixes are working correctly

Write-Host "=" * 80 -ForegroundColor Cyan
Write-Host "HITL Production Fixes - Test Script" -ForegroundColor Cyan
Write-Host "=" * 80 -ForegroundColor Cyan
Write-Host ""

# Check if we're in the right directory
if (-not (Test-Path "backend")) {
    Write-Host "ERROR: Please run this script from the AutoComply-AI-fresh root directory" -ForegroundColor Red
    exit 1
}

Write-Host "Step 1: Checking backend virtual environment..." -ForegroundColor Yellow
if (-not (Test-Path "backend\.venv")) {
    Write-Host "ERROR: Backend virtual environment not found. Run setup first." -ForegroundColor Red
    exit 1
}
Write-Host "✓ Backend venv found" -ForegroundColor Green

Write-Host ""
Write-Host "Step 2: Running migration for new reason codes..." -ForegroundColor Yellow
Push-Location backend
& .\.venv\Scripts\python.exe scripts\migrate_add_reason_codes.py
if ($LASTEXITCODE -ne 0) {
    Write-Host "WARNING: Migration had issues, but continuing..." -ForegroundColor Yellow
}
Pop-Location

Write-Host ""
Write-Host "Step 3: Seeding KB with state-specific questions..." -ForegroundColor Yellow
Push-Location backend
& .\.venv\Scripts\python.exe scripts\seed_kb.py
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Failed to seed KB" -ForegroundColor Red
    Pop-Location
    exit 1
}
Pop-Location

Write-Host ""
Write-Host "=" * 80 -ForegroundColor Cyan
Write-Host "Setup Complete! Now start the servers:" -ForegroundColor Green
Write-Host "=" * 80 -ForegroundColor Cyan
Write-Host ""

Write-Host "Terminal 1 - Backend:" -ForegroundColor Yellow
Write-Host "  cd backend" -ForegroundColor White
Write-Host "  .venv\Scripts\python -m uvicorn src.api.main:app --reload --host 127.0.0.1 --port 8001" -ForegroundColor White
Write-Host ""

Write-Host "Terminal 2 - Frontend:" -ForegroundColor Yellow
Write-Host "  cd frontend" -ForegroundColor White
Write-Host "  npm run dev" -ForegroundColor White
Write-Host ""

Write-Host "=" * 80 -ForegroundColor Cyan
Write-Host "Test Cases (copy and paste into chat)" -ForegroundColor Green
Write-Host "=" * 80 -ForegroundColor Cyan
Write-Host ""

Write-Host "Test 1 - Should ANSWER (NJ specific):" -ForegroundColor Yellow
Write-Host "  What are Schedule IV shipping rules for New Jersey?" -ForegroundColor White
Write-Host ""

Write-Host "Test 2 - Should NEEDS_REVIEW (RI unknown - THE BUG FIX!):" -ForegroundColor Yellow
Write-Host "  What are Schedule IV shipping rules for Rhode Island?" -ForegroundColor White
Write-Host "  Expected: NEEDS_REVIEW with reason 'jurisdiction_mismatch'" -ForegroundColor Cyan
Write-Host "  Expected: Does NOT reuse NJ answer" -ForegroundColor Cyan
Write-Host ""

Write-Host "Test 3 - Should ANSWER (CA specific):" -ForegroundColor Yellow
Write-Host "  What are Schedule IV shipping rules for California?" -ForegroundColor White
Write-Host ""

Write-Host "Test 4 - Should ANSWER (generic, no state):" -ForegroundColor Yellow
Write-Host "  What is a Schedule II drug?" -ForegroundColor White
Write-Host ""

Write-Host "Test 5 - Should NEEDS_REVIEW (new topic):" -ForegroundColor Yellow
Write-Host "  How do I get a DEA license in Texas?" -ForegroundColor White
Write-Host ""

Write-Host "=" * 80 -ForegroundColor Cyan
Write-Host "Navigation URLs" -ForegroundColor Green
Write-Host "=" * 80 -ForegroundColor Cyan
Write-Host ""
Write-Host "  Chat:         http://localhost:5173/chat" -ForegroundColor White
Write-Host "  Admin Review: http://localhost:5173/admin/review" -ForegroundColor White
Write-Host "  Backend API:  http://localhost:8001/docs" -ForegroundColor White
Write-Host ""

Write-Host "=" * 80 -ForegroundColor Cyan
Write-Host "Success Criteria" -ForegroundColor Green
Write-Host "=" * 80 -ForegroundColor Cyan
Write-Host ""
Write-Host "  [✓] NJ question returns NJ-specific answer" -ForegroundColor White
Write-Host "  [✓] RI question returns NEEDS_REVIEW (NOT NJ answer!)" -ForegroundColor White
Write-Host "  [✓] CA question returns CA-specific answer" -ForegroundColor White
Write-Host "  [✓] Generic question works fine" -ForegroundColor White
Write-Host "  [✓] Unknown questions create review items" -ForegroundColor White
Write-Host "  [✓] No 500 errors appear" -ForegroundColor White
Write-Host "  [✓] Decision traces visible" -ForegroundColor White
Write-Host "  [✓] Reset Demo button works" -ForegroundColor White
Write-Host ""

Write-Host "Ready to test! 🚀" -ForegroundColor Green
Write-Host ""
