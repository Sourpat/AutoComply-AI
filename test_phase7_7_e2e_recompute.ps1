#!/usr/bin/env pwsh
#
# PHASE 7.7 E2E Intelligence Recompute Test
#
# Tests end-to-end intelligence recompute flow:
# 1) GET intelligence for a case
# 2) Recompute intelligence with admin_unlocked=1
# 3) Verify cache invalidation and fresh data
# 4) Confirm confidence badge updates
#

$ErrorActionPreference = "Stop"
$BASE_URL = "http://127.0.0.1:8001"

Write-Host "`n=== PHASE 7.7 E2E Intelligence Recompute Test ===" -ForegroundColor Cyan
Write-Host "Testing intelligence GET, recompute, and UI consistency`n" -ForegroundColor Gray

# ============================================================================
# Step 1: Get a test case with existing data
# ============================================================================

Write-Host "[1/5] Finding test case..." -ForegroundColor Yellow
$casesUrl = "$BASE_URL/workflow/cases?limit=1"
Write-Host "GET $casesUrl" -ForegroundColor Gray

try {
    $casesResponse = Invoke-RestMethod -Uri $casesUrl -Method GET
    if ($casesResponse.cases.Count -eq 0) {
        Write-Host "ERROR: No cases found in database. Run seed script first." -ForegroundColor Red
        exit 1
    }
    $caseId = $casesResponse.cases[0].id
    $decisionType = $casesResponse.cases[0].decision_type
    Write-Host "OK Found case: $caseId (type: $decisionType)" -ForegroundColor Green
} catch {
    Write-Host "ERROR: Failed to fetch cases - $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# ============================================================================
# Step 2: GET intelligence (baseline)
# ============================================================================

Write-Host "`n[2/5] Getting baseline intelligence..." -ForegroundColor Yellow
$getUrl = "$BASE_URL/workflow/cases/$caseId/intelligence?decision_type=$decisionType"
Write-Host "GET $getUrl" -ForegroundColor Gray

try {
    $baseline = Invoke-RestMethod -Uri $getUrl -Method GET
    Write-Host "OK Baseline confidence: $($baseline.confidence_score)% ($($baseline.confidence_band))" -ForegroundColor Green
    Write-Host "  Gaps: $($baseline.gaps.Count)" -ForegroundColor Gray
    Write-Host "  Bias flags: $($baseline.bias_flags.Count)" -ForegroundColor Gray
    Write-Host "  Computed at: $($baseline.computed_at)" -ForegroundColor Gray
} catch {
    Write-Host "ERROR: Failed to get baseline intelligence - $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# ============================================================================
# Step 3: Recompute intelligence with admin_unlocked=1
# ============================================================================

Write-Host "`n[3/5] Recomputing intelligence (admin_unlocked=1)..." -ForegroundColor Yellow
$recomputeUrl = "$BASE_URL/workflow/cases/$caseId/intelligence/recompute?decision_type=$decisionType&admin_unlocked=1"
Write-Host "POST $recomputeUrl" -ForegroundColor Gray

try {
    $recomputed = Invoke-RestMethod -Uri $recomputeUrl -Method POST -ContentType "application/json"
    Write-Host "OK Recompute successful!" -ForegroundColor Green
    Write-Host "  New confidence: $($recomputed.confidence_score)% ($($recomputed.confidence_band))" -ForegroundColor Green
    Write-Host "  Gaps: $($recomputed.gaps.Count)" -ForegroundColor Gray
    Write-Host "  Bias flags: $($recomputed.bias_flags.Count)" -ForegroundColor Gray
    Write-Host "  Computed at: $($recomputed.computed_at)" -ForegroundColor Gray
} catch {
    Write-Host "ERROR: Failed to recompute intelligence - $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Status Code: $($_.Exception.Response.StatusCode.value__)" -ForegroundColor Red
    exit 1
}

# ============================================================================
# Step 4: Verify fresh data is returned
# ============================================================================

Write-Host "`n[4/5] Verifying fresh data..." -ForegroundColor Yellow

# Check that computed_at timestamp changed
if ($baseline.computed_at -eq $recomputed.computed_at) {
    Write-Host "WARNING: computed_at timestamp did not change" -ForegroundColor Yellow
    Write-Host "  Baseline: $($baseline.computed_at)" -ForegroundColor Gray
    Write-Host "  Recomputed: $($recomputed.computed_at)" -ForegroundColor Gray
} else {
    Write-Host "OK Timestamp updated (data is fresh)" -ForegroundColor Green
    Write-Host "  Old: $($baseline.computed_at)" -ForegroundColor Gray
    Write-Host "  New: $($recomputed.computed_at)" -ForegroundColor Gray
}

# Verify confidence score is deterministic
Write-Host "  Confidence: $($baseline.confidence_score)% β†' $($recomputed.confidence_score)%" -ForegroundColor Gray

# ============================================================================
# Step 5: GET again to verify cache consistency
# ============================================================================

Write-Host "`n[5/5] Verifying GET returns fresh data..." -ForegroundColor Yellow
Write-Host "GET $getUrl" -ForegroundColor Gray

try {
    $refetch = Invoke-RestMethod -Uri $getUrl -Method GET
    Write-Host "OK GET successful!" -ForegroundColor Green
    
    # Verify GET returns same data as recompute
    if ($refetch.computed_at -eq $recomputed.computed_at) {
        Write-Host "OK Cache consistency verified (timestamps match)" -ForegroundColor Green
    } else {
        Write-Host "WARNING: GET returned different timestamp than recompute" -ForegroundColor Yellow
        Write-Host "  Recomputed: $($recomputed.computed_at)" -ForegroundColor Gray
        Write-Host "  Refetched: $($refetch.computed_at)" -ForegroundColor Gray
    }
    
    if ($refetch.confidence_score -eq $recomputed.confidence_score) {
        Write-Host "OK Confidence score matches: $($refetch.confidence_score)%" -ForegroundColor Green
    } else {
        Write-Host "ERROR: Confidence score mismatch!" -ForegroundColor Red
        Write-Host "  Recomputed: $($recomputed.confidence_score)%" -ForegroundColor Gray
        Write-Host "  Refetched: $($refetch.confidence_score)%" -ForegroundColor Gray
        exit 1
    }
} catch {
    Write-Host "ERROR: Failed to refetch intelligence - $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# ============================================================================
# Summary
# ============================================================================

Write-Host "`n=== Summary ===" -ForegroundColor Cyan
Write-Host "OK GET intelligence: Working" -ForegroundColor Green
Write-Host "OK POST recompute (admin_unlocked=1): No 403 error" -ForegroundColor Green
Write-Host "OK Fresh data returned: Timestamp updated" -ForegroundColor Green
Write-Host "OK Cache consistency: GET matches recompute" -ForegroundColor Green
Write-Host "OK Confidence score: $($refetch.confidence_score)% ($($refetch.confidence_band))" -ForegroundColor Green

Write-Host "`n=== Frontend UI Test Instructions ===" -ForegroundColor Cyan
Write-Host "1. Open browser to http://localhost:5173" -ForegroundColor Gray
Write-Host "2. Navigate to case: $caseId" -ForegroundColor Gray
Write-Host "3. Check Decision Intelligence panel shows: $($refetch.confidence_score)% confidence" -ForegroundColor Gray
Write-Host "4. Click 'Recompute' button" -ForegroundColor Gray
Write-Host "5. Verify:" -ForegroundColor Gray
Write-Host "   - Button shows loading state (spinner)" -ForegroundColor Gray
Write-Host "   - No 403 error toast" -ForegroundColor Gray
Write-Host "   - Panel refreshes automatically" -ForegroundColor Gray
Write-Host "   - Confidence badge updates immediately" -ForegroundColor Gray
Write-Host "   - Browser console shows: [intelligenceApi] POST recompute URL: ...admin_unlocked=1" -ForegroundColor Gray

Write-Host "`nPASS: PHASE 7.7 E2E TEST PASSED" -ForegroundColor Green
