#!/usr/bin/env pwsh
# Test Phase 7.29 - SLA + Escalation Signals (UI Verification)

Write-Host "=== Phase 7.29: SLA + Escalation Signals - UI Test ===" -ForegroundColor Cyan
Write-Host ""

# Test 1: Backend API - Get all cases with SLA fields
Write-Host "[TEST 1] GET /workflow/cases - Verify SLA fields present" -ForegroundColor Yellow
$response1 = Invoke-RestMethod -Uri "http://127.0.0.1:8001/workflow/cases?limit=5" -Method GET
Write-Host "Retrieved $($response1.items.Count) cases" -ForegroundColor Green
if ($response1.items.Count -gt 0) {
    $firstCase = $response1.items[0]
    Write-Host "First case:" -ForegroundColor White
    Write-Host "  - ID: $($firstCase.id)" -ForegroundColor White
    Write-Host "  - Title: $($firstCase.title)" -ForegroundColor White
    Write-Host "  - Status: $($firstCase.status)" -ForegroundColor White
    Write-Host "  - age_hours: $($firstCase.age_hours)" -ForegroundColor Cyan
    Write-Host "  - sla_status: $($firstCase.sla_status)" -ForegroundColor Cyan
    
    if ($null -eq $firstCase.age_hours) {
        Write-Host "  ❌ age_hours field missing!" -ForegroundColor Red
        exit 1
    }
    if ($null -eq $firstCase.sla_status) {
        Write-Host "  ❌ sla_status field missing!" -ForegroundColor Red
        exit 1
    }
    Write-Host "  ✅ SLA fields present" -ForegroundColor Green
}
Write-Host ""

# Test 2: Filter by SLA status - Warning
Write-Host "[TEST 2] GET /workflow/cases?sla_status=warning - Filter by warning" -ForegroundColor Yellow
$response2 = Invoke-RestMethod -Uri "http://127.0.0.1:8001/workflow/cases?sla_status=warning&limit=100" -Method GET
Write-Host "Found $($response2.items.Count) cases with WARNING status" -ForegroundColor Green
$response2.items | ForEach-Object {
    Write-Host "  - [$($_.sla_status)] $($_.title) (Age: $([math]::Round($_.age_hours, 1))h)" -ForegroundColor Cyan
}
Write-Host ""

# Test 3: Filter by SLA status - Breach
Write-Host "[TEST 3] GET /workflow/cases?sla_status=breach - Filter by breach" -ForegroundColor Yellow
$response3 = Invoke-RestMethod -Uri "http://127.0.0.1:8001/workflow/cases?sla_status=breach&limit=100" -Method GET
Write-Host "Found $($response3.items.Count) cases with BREACH status" -ForegroundColor Green
$response3.items | ForEach-Object {
    Write-Host "  - [$($_.sla_status)] $($_.title) (Age: $([math]::Round($_.age_hours, 1))h)" -ForegroundColor Red
}
Write-Host ""

# Test 4: Sort by age (descending)
Write-Host "[TEST 4] GET /workflow/cases?sortBy=age&sortDir=desc - Sort by age" -ForegroundColor Yellow
$response4 = Invoke-RestMethod -Uri "http://127.0.0.1:8001/workflow/cases?sortBy=age&sortDir=desc&limit=5" -Method GET
Write-Host "Top 5 oldest cases:" -ForegroundColor Green
$response4.items | ForEach-Object {
    Write-Host "  - [$($_.sla_status)] $($_.title) - $([math]::Round($_.age_hours, 1))h old" -ForegroundColor White
}
Write-Host ""

# Test 5: Invalid SLA status should fail
Write-Host "[TEST 5] GET /workflow/cases?sla_status=invalid - Should return 400" -ForegroundColor Yellow
try {
    $response5 = Invoke-RestMethod -Uri "http://127.0.0.1:8001/workflow/cases?sla_status=invalid" -Method GET
    Write-Host "  ❌ Should have returned 400 error!" -ForegroundColor Red
    exit 1
} catch {
    if ($_.Exception.Response.StatusCode -eq 400) {
        Write-Host "  ✅ Correctly rejected invalid sla_status" -ForegroundColor Green
    } else {
        Write-Host "  ❌ Wrong status code: $($_.Exception.Response.StatusCode)" -ForegroundColor Red
        exit 1
    }
}
Write-Host ""

# Summary
Write-Host "=== All API Tests Passed ===" -ForegroundColor Green
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Cyan
Write-Host "1. Start frontend: npm run dev (in frontend/)" -ForegroundColor White
Write-Host "2. Navigate to: http://localhost:5173/console" -ForegroundColor White
Write-Host "3. Verify:" -ForegroundColor White
Write-Host "   - SLA filter pills visible (All, Aging, Breach)" -ForegroundColor White
Write-Host "   - Case cards show SLA badges (Aging, Breach)" -ForegroundColor White
Write-Host "   - Age displayed in hours (e.g. 48h)" -ForegroundColor White
Write-Host "   - Click Aging filter to see warning+breach cases" -ForegroundColor White
Write-Host "   - Click Breach filter to see only breach cases" -ForegroundColor White
Write-Host ""
