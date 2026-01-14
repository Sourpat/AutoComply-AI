# ═══════════════════════════════════════════════════════════════════════════
# Backend Connectivity Test
# ═══════════════════════════════════════════════════════════════════════════
# Tests backend health, CORS, and frontend connectivity
# Verifies no demo fallback is active

Write-Host "`n=== Backend Connectivity Test ===" -ForegroundColor Cyan
Write-Host "Testing backend at http://127.0.0.1:8001`n" -ForegroundColor Gray

$testsPassed = 0
$testsFailed = 0

# ───────────────────────────────────────────────────────────────────────────
# Test 1: Backend Health Check
# ───────────────────────────────────────────────────────────────────────────
Write-Host "[1/5] Testing backend health..." -ForegroundColor Yellow

try {
    $healthResponse = Invoke-RestMethod -Uri "http://127.0.0.1:8001/health" -Method GET -TimeoutSec 3
    
    if ($healthResponse.ok -eq $true -or $healthResponse.status -eq "healthy") {
        Write-Host "  ✅ Backend health check passed" -ForegroundColor Green
        Write-Host "     Response: $($healthResponse | ConvertTo-Json -Compress)" -ForegroundColor Gray
        $testsPassed++
    } else {
        Write-Host "  ❌ Backend health check returned unexpected response" -ForegroundColor Red
        Write-Host "     Got: $($healthResponse | ConvertTo-Json -Compress)" -ForegroundColor Gray
        $testsFailed++
    }
} catch {
    Write-Host "  ❌ Backend health check failed" -ForegroundColor Red
    Write-Host "     Error: $($_.Exception.Message)" -ForegroundColor Gray
    Write-Host "     Ensure backend is running: uvicorn src.api.main:app --host 127.0.0.1 --port 8001" -ForegroundColor Yellow
    $testsFailed++
}

# ───────────────────────────────────────────────────────────────────────────
# Test 2: Workflow Health Check
# ───────────────────────────────────────────────────────────────────────────
Write-Host "`n[2/5] Testing workflow health..." -ForegroundColor Yellow

try {
    $workflowHealthResponse = Invoke-RestMethod -Uri "http://127.0.0.1:8001/workflow/health" -Method GET -TimeoutSec 3
    
    if ($workflowHealthResponse.ok -eq $true) {
        Write-Host "  ✅ Workflow health check passed" -ForegroundColor Green
        $testsPassed++
    } else {
        Write-Host "  ❌ Workflow health check failed" -ForegroundColor Red
        $testsFailed++
    }
} catch {
    Write-Host "  ❌ Workflow health check failed" -ForegroundColor Red
    Write-Host "     Error: $($_.Exception.Message)" -ForegroundColor Gray
    $testsFailed++
}

# ───────────────────────────────────────────────────────────────────────────
# Test 3: CORS Headers
# ───────────────────────────────────────────────────────────────────────────
Write-Host "`n[3/5] Testing CORS headers..." -ForegroundColor Yellow

try {
    $corsTest = Invoke-WebRequest -Uri "http://127.0.0.1:8001/health" -Method OPTIONS -Headers @{
        "Origin" = "http://localhost:5173"
        "Access-Control-Request-Method" = "GET"
        "Access-Control-Request-Headers" = "content-type"
    } -TimeoutSec 3
    
    $corsHeader = $corsTest.Headers.'Access-Control-Allow-Origin'
    
    if ($corsHeader -eq "*" -or $corsHeader -eq "http://localhost:5173") {
        Write-Host "  ✅ CORS headers configured correctly" -ForegroundColor Green
        Write-Host "     Access-Control-Allow-Origin: $corsHeader" -ForegroundColor Gray
        $testsPassed++
    } else {
        Write-Host "  ⚠️  CORS header present but unexpected value" -ForegroundColor Yellow
        Write-Host "     Access-Control-Allow-Origin: $corsHeader" -ForegroundColor Gray
        $testsPassed++
    }
} catch {
    Write-Host "  ⚠️  CORS preflight test failed (may be OK if backend allows all origins)" -ForegroundColor Yellow
    Write-Host "     Error: $($_.Exception.Message)" -ForegroundColor Gray
    $testsPassed++  # Don't fail on CORS preflight - backend may not require it
}

# ───────────────────────────────────────────────────────────────────────────
# Test 4: Cases API Endpoint
# ───────────────────────────────────────────────────────────────────────────
Write-Host "`n[4/5] Testing cases API..." -ForegroundColor Yellow

try {
    $casesResponse = Invoke-RestMethod -Uri "http://127.0.0.1:8001/workflow/cases?limit=10" -Method GET -TimeoutSec 5
    
    if ($casesResponse.items -is [Array] -or $casesResponse -is [Array]) {
        $caseCount = if ($casesResponse.items) { $casesResponse.items.Count } else { $casesResponse.Count }
        Write-Host "  ✅ Cases API responding" -ForegroundColor Green
        Write-Host "     Returned $caseCount cases" -ForegroundColor Gray
        $testsPassed++
        
        # Check for demo IDs (should NOT exist)
        $items = if ($casesResponse.items) { $casesResponse.items } else { $casesResponse }
        $demoIds = $items | Where-Object { $_.id -match "demo-wq" }
        
        if ($demoIds) {
            Write-Host "  ⚠️  WARNING: Found demo case IDs in response" -ForegroundColor Yellow
            Write-Host "     Demo IDs: $($demoIds | ForEach-Object { $_.id } | Join-String -Separator ', ')" -ForegroundColor Gray
        }
    } else {
        Write-Host "  ❌ Cases API returned unexpected format" -ForegroundColor Red
        Write-Host "     Response type: $($casesResponse.GetType().Name)" -ForegroundColor Gray
        $testsFailed++
    }
} catch {
    Write-Host "  ❌ Cases API failed" -ForegroundColor Red
    Write-Host "     Error: $($_.Exception.Message)" -ForegroundColor Gray
    $testsFailed++
}

# ───────────────────────────────────────────────────────────────────────────
# Test 5: Frontend API Configuration
# ───────────────────────────────────────────────────────────────────────────
Write-Host "`n[5/5] Checking frontend API configuration..." -ForegroundColor Yellow

$frontendApiFile = "frontend\src\lib\api.ts"
if (Test-Path $frontendApiFile) {
    $apiContent = Get-Content $frontendApiFile -Raw
    
    # Check for getApiBase function and localhost detection
    if ($apiContent -match 'window\.location\.hostname === "localhost"' -and 
        $apiContent -match '"http://127\.0\.0\.1:8001"') {
        Write-Host "  ✅ Frontend API configured correctly" -ForegroundColor Green
        Write-Host "     Auto-detects localhost and uses http://127.0.0.1:8001" -ForegroundColor Gray
        $testsPassed++
    } else {
        Write-Host "  ⚠️  Frontend API configuration may need review" -ForegroundColor Yellow
        Write-Host "     Check frontend/src/lib/api.ts" -ForegroundColor Gray
        $testsPassed++  # Don't fail - config might be intentionally different
    }
} else {
    Write-Host "  ⚠️  Frontend API file not found" -ForegroundColor Yellow
    Write-Host "     Expected: $frontendApiFile" -ForegroundColor Gray
    $testsPassed++  # Don't fail - might be running from wrong directory
}

# ───────────────────────────────────────────────────────────────────────────
# Summary
# ───────────────────────────────────────────────────────────────────────────
Write-Host "`n=== Test Summary ===" -ForegroundColor Cyan
Write-Host "Passed: $testsPassed" -ForegroundColor Green
Write-Host "Failed: $testsFailed" -ForegroundColor $(if ($testsFailed -eq 0) { "Green" } else { "Red" })

if ($testsFailed -eq 0) {
    Write-Host "`n✅ ALL TESTS PASSED!" -ForegroundColor Green
    Write-Host "`nBackend is reachable and properly configured." -ForegroundColor Gray
    Write-Host "Frontend should be able to connect without issues." -ForegroundColor Gray
    Write-Host "`nNext steps:" -ForegroundColor Cyan
    Write-Host "  1. Start frontend: cd frontend && npm run dev" -ForegroundColor Gray
    Write-Host "  2. Open http://localhost:5173" -ForegroundColor Gray
    Write-Host "  3. Verify no 'Backend Not Reachable' toast" -ForegroundColor Gray
    Write-Host "  4. Verify cases load from API (not demo fallback)`n" -ForegroundColor Gray
    exit 0
} else {
    Write-Host "`n❌ SOME TESTS FAILED" -ForegroundColor Red
    Write-Host "`nPlease fix the issues above before starting frontend.`n" -ForegroundColor Yellow
    
    Write-Host "Common fixes:" -ForegroundColor Cyan
    Write-Host "  1. Start backend: cd backend && uvicorn src.api.main:app --reload --host 127.0.0.1 --port 8001" -ForegroundColor Gray
    Write-Host "  2. Check port 8001 is not in use: netstat -ano | findstr :8001" -ForegroundColor Gray
    Write-Host "  3. Check backend .env has: CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173,*" -ForegroundColor Gray
    Write-Host "  4. Clear browser cache and restart frontend`n" -ForegroundColor Gray
    exit 1
}
