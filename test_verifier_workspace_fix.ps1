<#
.SYNOPSIS
Test script to verify Verifier Workspace fixes

.DESCRIPTION
Verifies that:
1. Verifier list shows ALL cases from backend (not just 6)
2. Clicking a case loads details without "Case not found" error
3. Case IDs are real UUIDs (not demo-wq-*)

.EXAMPLE
.\test_verifier_workspace_fix.ps1
#>

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "VERIFIER WORKSPACE FIX - VERIFICATION" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# Step 1: Check backend is running
Write-Host "[1/7] Checking backend health..." -ForegroundColor Yellow
try {
    $health = Invoke-RestMethod -Uri "http://127.0.0.1:8001/workflow/health" -Method Get -TimeoutSec 5
    if ($health.ok) {
        Write-Host "  ✅ Backend is healthy" -ForegroundColor Green
    } else {
        Write-Host "  ❌ Backend health check failed" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "  ❌ Backend not running. Start with:" -ForegroundColor Red
    Write-Host "     cd backend" -ForegroundColor Gray
    Write-Host "     .\.venv\Scripts\python.exe -m uvicorn src.api.main:app --host 127.0.0.1 --port 8001" -ForegroundColor Gray
    exit 1
}

# Step 2: Get database info
Write-Host "`n[2/7] Checking database statistics..." -ForegroundColor Yellow
try {
    $dbInfo = Invoke-RestMethod -Uri "http://127.0.0.1:8001/workflow/dev/db-info" -Method Get
    Write-Host "  Database Path: $($dbInfo.db_path)" -ForegroundColor Cyan
    Write-Host "  Submissions Count: $($dbInfo.submissions_count)" -ForegroundColor Cyan
    Write-Host "  Cases Count: $($dbInfo.cases_count)" -ForegroundColor Cyan
    
    $totalCases = $dbInfo.cases_count
    
    if ($totalCases -eq 0) {
        Write-Host "  ⚠️  No cases in database. Create some submissions first." -ForegroundColor Yellow
    }
} catch {
    Write-Host "  ❌ Failed to get database info" -ForegroundColor Red
    exit 1
}

# Step 3: Get case IDs list
Write-Host "`n[3/7] Fetching case IDs from debug endpoint..." -ForegroundColor Yellow
try {
    $casesIds = Invoke-RestMethod -Uri "http://127.0.0.1:8001/workflow/dev/cases-ids" -Method Get
    Write-Host "  ✅ Retrieved $($casesIds.count) case IDs" -ForegroundColor Green
    
    if ($casesIds.count -gt 0) {
        Write-Host "`n  First 5 cases:" -ForegroundColor Cyan
        $casesIds.cases | Select-Object -First 5 | ForEach-Object {
            Write-Host "    - ID: $($_.id.Substring(0, 8))... | Submission: $($_.submission_id.Substring(0, 8))... | $($_.title)" -ForegroundColor Gray
        }
    }
} catch {
    Write-Host "  ❌ Failed to get case IDs" -ForegroundColor Red
    exit 1
}

# Step 4: Get all cases via API (with high limit)
Write-Host "`n[4/7] Fetching cases list (limit=1000)..." -ForegroundColor Yellow
try {
    $casesResponse = Invoke-RestMethod -Uri "http://127.0.0.1:8001/workflow/cases?limit=1000" -Method Get
    $returnedCount = $casesResponse.items.Count
    $apiTotal = $casesResponse.total
    
    Write-Host "  ✅ GET /workflow/cases returned $returnedCount items (total: $apiTotal)" -ForegroundColor Green
    
    if ($returnedCount -ne $apiTotal) {
        Write-Host "  ⚠️  Pagination issue: returned $returnedCount but total is $apiTotal" -ForegroundColor Yellow
    }
    
    if ($returnedCount -ne $totalCases) {
        Write-Host "  ⚠️  Mismatch: Database has $totalCases but API returned $returnedCount" -ForegroundColor Yellow
    }
    
    # Check for demo IDs
    $demoIds = $casesResponse.items | Where-Object { $_.id -like "demo-*" }
    if ($demoIds.Count -gt 0) {
        Write-Host "  ⚠️  Found $($demoIds.Count) demo case IDs" -ForegroundColor Yellow
    } else {
        Write-Host "  ✅ No demo IDs - all cases are real UUIDs" -ForegroundColor Green
    }
} catch {
    Write-Host "  ❌ Failed to get cases list" -ForegroundColor Red
    Write-Host "  Error: $_" -ForegroundColor Red
    exit 1
}

# Step 5: Test individual case fetch
Write-Host "`n[5/7] Testing individual case fetch..." -ForegroundColor Yellow
if ($casesResponse.items.Count -gt 0) {
    $testCase = $casesResponse.items[0]
    $testCaseId = $testCase.id
    
    Write-Host "  Testing case ID: $($testCaseId.Substring(0, 16))..." -ForegroundColor Cyan
    
    try {
        $caseDetails = Invoke-RestMethod -Uri "http://127.0.0.1:8001/workflow/cases/$testCaseId" -Method Get
        Write-Host "  ✅ GET /cases/{id} succeeded" -ForegroundColor Green
        Write-Host "    Title: $($caseDetails.title)" -ForegroundColor Gray
        Write-Host "    Status: $($caseDetails.status)" -ForegroundColor Gray
        Write-Host "    Submission ID: $($caseDetails.submissionId)" -ForegroundColor Gray
    } catch {
        Write-Host "  ❌ GET /cases/{id} failed with 404 or error" -ForegroundColor Red
        Write-Host "  Error: $_" -ForegroundColor Red
    }
    
    # Test submission fetch if linked
    if ($testCase.submissionId) {
        try {
            $submission = Invoke-RestMethod -Uri "http://127.0.0.1:8001/workflow/cases/$testCaseId/submission" -Method Get
            Write-Host "  ✅ GET /cases/{id}/submission succeeded" -ForegroundColor Green
            Write-Host "    Submission ID: $($submission.id.Substring(0, 16))..." -ForegroundColor Gray
        } catch {
            Write-Host "  ⚠️  GET /cases/{id}/submission failed (might be expected if no submission)" -ForegroundColor Yellow
        }
    }
} else {
    Write-Host "  ⚠️  No cases to test" -ForegroundColor Yellow
}

# Step 6: Check frontend accessible
Write-Host "`n[6/7] Checking frontend accessibility..." -ForegroundColor Yellow
try {
    $frontendCheck = Invoke-WebRequest -Uri "http://localhost:5173" -UseBasicParsing -TimeoutSec 5
    Write-Host "  ✅ Frontend is accessible at http://localhost:5173" -ForegroundColor Green
} catch {
    Write-Host "  ⚠️  Frontend not accessible. Start with:" -ForegroundColor Yellow
    Write-Host "     cd frontend && npm run dev" -ForegroundColor Gray
}

# Step 7: Summary
Write-Host "`n[7/7] Summary..." -ForegroundColor Yellow

$issues = @()

if ($returnedCount -lt $totalCases) {
    $issues += "❌ List showing $returnedCount cases but DB has $totalCases"
} else {
    Write-Host "  ✅ List count matches database ($returnedCount cases)" -ForegroundColor Green
}

if ($returnedCount -eq 6) {
    $issues += "❌ CRITICAL: Still limited to 6 cases (fix not applied or limit still exists)"
} elseif ($returnedCount -gt 6) {
    Write-Host "  ✅ Showing more than 6 cases ($returnedCount total)" -ForegroundColor Green
}

if ($demoIds.Count -gt 0) {
    $issues += "⚠️  Demo data present: $($demoIds.Count) cases with demo IDs"
} else {
    Write-Host "  ✅ No demo data - all real case IDs" -ForegroundColor Green
}

# Final verdict
Write-Host "`n========================================" -ForegroundColor Cyan
if ($issues.Count -eq 0) {
    Write-Host "✅ ALL CHECKS PASSED!" -ForegroundColor Green
} else {
    Write-Host "⚠️  ISSUES FOUND:" -ForegroundColor Yellow
    $issues | ForEach-Object { Write-Host "  $_" -ForegroundColor Yellow }
}
Write-Host "========================================`n" -ForegroundColor Cyan

Write-Host "Manual UI Test Steps:" -ForegroundColor White
Write-Host "  1. Open http://localhost:5173/console/cases" -ForegroundColor Gray
Write-Host "  2. Verify list shows $totalCases cases (not just 6)" -ForegroundColor Gray
Write-Host "  3. Click any case" -ForegroundColor Gray
Write-Host "  4. Should see case details with tabs (NOT 'Case not found')" -ForegroundColor Gray
Write-Host "  5. URL should be /console/cases?caseId=<UUID> (not demo-wq-*)" -ForegroundColor Gray
Write-Host ""

Write-Host "Debug Info (if needed):" -ForegroundColor White
Write-Host "  Database: $($dbInfo.db_path)" -ForegroundColor Gray
Write-Host "  Backend: http://127.0.0.1:8001" -ForegroundColor Gray
Write-Host "  Frontend: http://localhost:5173" -ForegroundColor Gray
Write-Host "  Debug endpoints:" -ForegroundColor Gray
Write-Host "    - http://127.0.0.1:8001/workflow/dev/db-info" -ForegroundColor Gray
Write-Host "    - http://127.0.0.1:8001/workflow/dev/cases-ids" -ForegroundColor Gray
Write-Host ""
