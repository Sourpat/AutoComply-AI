<#
.SYNOPSIS
Test script to verify Verifier Console shows all submissions

.DESCRIPTION
Verifies that:
1. Backend database has all submissions and cases
2. Verifier Console fetches all cases from backend (not demo data)
3. Submission count matches case count

.EXAMPLE
.\test_verifier_discrepancy_fix.ps1
#>

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "VERIFIER DISCREPANCY FIX - VERIFICATION" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# Step 1: Check backend is running
Write-Host "[1/6] Checking backend health..." -ForegroundColor Yellow
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
Write-Host "`n[2/6] Checking database statistics..." -ForegroundColor Yellow
try {
    $dbInfo = Invoke-RestMethod -Uri "http://127.0.0.1:8001/workflow/dev/db-info" -Method Get
    Write-Host "  Database Path: $($dbInfo.db_path)" -ForegroundColor Cyan
    Write-Host "  Submissions Count: $($dbInfo.submissions_count)" -ForegroundColor Cyan
    Write-Host "  Cases Count: $($dbInfo.cases_count)" -ForegroundColor Cyan
    
    if ($dbInfo.submissions_count -eq 0 -or $dbInfo.cases_count -eq 0) {
        Write-Host "  ⚠️  No data in database. Create some submissions first." -ForegroundColor Yellow
        Write-Host "     Continuing with verification anyway..." -ForegroundColor Gray
    }
    
    $expectedSubmissions = $dbInfo.submissions_count
    $expectedCases = $dbInfo.cases_count
} catch {
    Write-Host "  ❌ Failed to get database info" -ForegroundColor Red
    Write-Host "  Error: $_" -ForegroundColor Red
    exit 1
}

# Step 3: Get all submissions via API
Write-Host "`n[3/6] Fetching all submissions from API..." -ForegroundColor Yellow
try {
    $submissions = Invoke-RestMethod -Uri "http://127.0.0.1:8001/submissions" -Method Get
    $submissionsCount = $submissions.Count
    Write-Host "  ✅ Retrieved $submissionsCount submissions" -ForegroundColor Green
    
    if ($submissionsCount -ne $expectedSubmissions) {
        Write-Host "  ⚠️  Mismatch: Database has $expectedSubmissions but API returned $submissionsCount" -ForegroundColor Yellow
    }
} catch {
    Write-Host "  ❌ Failed to get submissions" -ForegroundColor Red
    Write-Host "  Error: $_" -ForegroundColor Red
    exit 1
}

# Step 4: Get all cases via API (with high limit)
Write-Host "`n[4/6] Fetching all cases from API (limit=1000)..." -ForegroundColor Yellow
try {
    $casesResponse = Invoke-RestMethod -Uri "http://127.0.0.1:8001/workflow/cases?limit=1000" -Method Get
    $casesCount = $casesResponse.items.Count
    $totalCases = $casesResponse.total
    
    Write-Host "  ✅ Retrieved $casesCount cases (total: $totalCases)" -ForegroundColor Green
    
    if ($casesCount -ne $totalCases) {
        Write-Host "  ⚠️  Pagination: Showing $casesCount of $totalCases total" -ForegroundColor Yellow
    }
    
    if ($totalCases -ne $expectedCases) {
        Write-Host "  ⚠️  Mismatch: Database has $expectedCases but API returned $totalCases" -ForegroundColor Yellow
    }
} catch {
    Write-Host "  ❌ Failed to get cases" -ForegroundColor Red
    Write-Host "  Error: $_" -ForegroundColor Red
    exit 1
}

# Step 5: Check for demo data IDs
Write-Host "`n[5/6] Checking for demo data pollution..." -ForegroundColor Yellow
$demoIds = $casesResponse.items | Where-Object { $_.id -like "demo-*" }
if ($demoIds.Count -gt 0) {
    Write-Host "  ⚠️  Found $($demoIds.Count) demo cases (IDs starting with 'demo-')" -ForegroundColor Yellow
    $demoIds | ForEach-Object { Write-Host "     - $($_.id): $($_.title)" -ForegroundColor Gray }
} else {
    Write-Host "  ✅ No demo data found - all cases are real" -ForegroundColor Green
}

# Step 6: Verify submission-case linkage
Write-Host "`n[6/6] Verifying submission-case linkage..." -ForegroundColor Yellow
$linkedCount = 0
$unlinckedCases = @()

foreach ($case in $casesResponse.items) {
    if ($case.submissionId) {
        $linkedCount++
    } else {
        $unlinkedCases += $case.id
    }
}

Write-Host "  Linked Cases: $linkedCount / $casesCount" -ForegroundColor Cyan
if ($unlinkedCases.Count -gt 0) {
    Write-Host "  ⚠️  Found $($unlinkedCases.Count) cases without submissionId:" -ForegroundColor Yellow
    $unlinkedCases | ForEach-Object { Write-Host "     - $_" -ForegroundColor Gray }
}

# Summary
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "VERIFICATION SUMMARY" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

Write-Host "`nDatabase:" -ForegroundColor White
Write-Host "  Submissions: $expectedSubmissions" -ForegroundColor Gray
Write-Host "  Cases: $expectedCases" -ForegroundColor Gray

Write-Host "`nAPI Endpoints:" -ForegroundColor White
Write-Host "  GET /submissions: $submissionsCount items" -ForegroundColor Gray
Write-Host "  GET /workflow/cases: $casesCount / $totalCases items" -ForegroundColor Gray

Write-Host "`nData Quality:" -ForegroundColor White
Write-Host "  Demo data: $($demoIds.Count) cases" -ForegroundColor Gray
Write-Host "  Linked cases: $linkedCount / $casesCount" -ForegroundColor Gray

# Final verdict
Write-Host "`nExpected Behavior:" -ForegroundColor White
if ($casesCount -eq $totalCases -and $totalCases -ge $submissionsCount -and $demoIds.Count -eq 0) {
    Write-Host "  ✅ PASS - Verifier should show all $totalCases real cases" -ForegroundColor Green
} else {
    Write-Host "  ⚠️  REVIEW NEEDED" -ForegroundColor Yellow
    if ($casesCount -ne $totalCases) {
        Write-Host "     - Pagination issue: $casesCount retrieved vs $totalCases total" -ForegroundColor Yellow
    }
    if ($demoIds.Count -gt 0) {
        Write-Host "     - Demo data present: Remove $($demoIds.Count) demo cases" -ForegroundColor Yellow
    }
    if ($totalCases -lt $submissionsCount) {
        Write-Host "     - Missing cases: $submissionsCount submissions but only $totalCases cases" -ForegroundColor Yellow
    }
}

Write-Host "`nNext Steps:" -ForegroundColor White
Write-Host "  1. Open Verifier Console UI (http://localhost:5173/console/cases)" -ForegroundColor Gray
Write-Host "  2. Verify 'All' filter shows $totalCases cases (not 4)" -ForegroundColor Gray
Write-Host "  3. Click any case - should NOT have 'demo-wq-*' ID" -ForegroundColor Gray
Write-Host "  4. Case should load real submission data" -ForegroundColor Gray
Write-Host ""
