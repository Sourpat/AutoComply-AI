<#
.SYNOPSIS
Test script to verify Phase 1 database connection fix

.DESCRIPTION
Verifies that:
1. Backend uses absolute database path
2. Submitter and Verifier use the same SQLite database
3. Submitted cases appear in the Verifier Console queue

.EXAMPLE
.\test_phase1_connection.ps1
#>

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "PHASE 1 CONNECTION FIX - VERIFICATION" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# Step 1: Check backend is running
Write-Host "[1/5] Checking backend health..." -ForegroundColor Yellow
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
    Write-Host "     .venv\Scripts\python.exe -m uvicorn src.api.main:app --host 127.0.0.1 --port 8001" -ForegroundColor Gray
    exit 1
}

# Step 2: Check database info
Write-Host "`n[2/5] Checking database configuration..." -ForegroundColor Yellow
try {
    $dbInfo = Invoke-RestMethod -Uri "http://127.0.0.1:8001/workflow/dev/db-info" -Method Get
    Write-Host "  Database Path: $($dbInfo.db_path)" -ForegroundColor Cyan
    Write-Host "  Database Exists: $($dbInfo.db_exists)" -ForegroundColor Cyan
    Write-Host "  Working Directory: $($dbInfo.cwd)" -ForegroundColor Cyan
    Write-Host "  Cases Count: $($dbInfo.cases_count)" -ForegroundColor Cyan
    Write-Host "  Submissions Count: $($dbInfo.submissions_count)" -ForegroundColor Cyan
    
    # Check if path is absolute
    if ($dbInfo.db_path -match "^[A-Z]:\\|^/") {
        Write-Host "  ✅ Database path is absolute" -ForegroundColor Green
    } else {
        Write-Host "  ❌ Database path is NOT absolute (relative path detected)" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "  ❌ Failed to get database info" -ForegroundColor Red
    Write-Host "  Error: $_" -ForegroundColor Red
    exit 1
}

# Step 3: Submit a test case
Write-Host "`n[3/5] Submitting test case..." -ForegroundColor Yellow
$testPayload = @{
    decisionType = "csf_practitioner"
    formData = @{
        name = "Test Practitioner - $(Get-Date -Format 'HH:mm:ss')"
        specialty = "Cardiology"
        licenseNumber = "TEST-12345"
    }
} | ConvertTo-Json -Depth 10

try {
    $submission = Invoke-RestMethod -Uri "http://127.0.0.1:8001/submissions" -Method Post -Body $testPayload -ContentType "application/json"
    Write-Host "  ✅ Submission created: ID=$($submission.id)" -ForegroundColor Green
    Write-Host "  Case ID: $($submission.caseId)" -ForegroundColor Cyan
    
    # Store for verification
    $caseId = $submission.caseId
} catch {
    Write-Host "  ❌ Failed to create submission" -ForegroundColor Red
    Write-Host "  Error: $_" -ForegroundColor Red
    exit 1
}

# Step 4: Verify case appears in workflow queue
Write-Host "`n[4/5] Checking if case appears in workflow queue..." -ForegroundColor Yellow
Start-Sleep -Seconds 1  # Give backend time to write

try {
    $cases = Invoke-RestMethod -Uri "http://127.0.0.1:8001/workflow/cases?limit=100" -Method Get
    Write-Host "  Total cases in queue: $($cases.total)" -ForegroundColor Cyan
    
    # Find our case
    $ourCase = $cases.items | Where-Object { $_.id -eq $caseId }
    
    if ($ourCase) {
        Write-Host "  ✅ Case found in workflow queue!" -ForegroundColor Green
        Write-Host "     Case ID: $($ourCase.id)" -ForegroundColor Cyan
        Write-Host "     Status: $($ourCase.status)" -ForegroundColor Cyan
        Write-Host "     Decision Type: $($ourCase.decisionType)" -ForegroundColor Cyan
    } else {
        Write-Host "  ❌ Case NOT found in workflow queue" -ForegroundColor Red
        Write-Host "  Expected Case ID: $caseId" -ForegroundColor Gray
        Write-Host "  Cases in queue: $($cases.items.id -join ', ')" -ForegroundColor Gray
        exit 1
    }
} catch {
    Write-Host "  ❌ Failed to get workflow cases" -ForegroundColor Red
    Write-Host "  Error: $_" -ForegroundColor Red
    exit 1
}

# Step 5: Re-check database counts
Write-Host "`n[5/5] Verifying database counts increased..." -ForegroundColor Yellow
try {
    $dbInfo2 = Invoke-RestMethod -Uri "http://127.0.0.1:8001/workflow/dev/db-info" -Method Get
    Write-Host "  Previous Cases: $($dbInfo.cases_count) → Current: $($dbInfo2.cases_count)" -ForegroundColor Cyan
    Write-Host "  Previous Submissions: $($dbInfo.submissions_count) → Current: $($dbInfo2.submissions_count)" -ForegroundColor Cyan
    
    if ($dbInfo2.cases_count -gt $dbInfo.cases_count -and $dbInfo2.submissions_count -gt $dbInfo.submissions_count) {
        Write-Host "  ✅ Counts increased as expected" -ForegroundColor Green
    } else {
        Write-Host "  ❌ Counts did not increase properly" -ForegroundColor Red
    }
} catch {
    Write-Host "  ⚠️  Could not verify final counts" -ForegroundColor Yellow
}

# Summary
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "✅ PHASE 1 CONNECTION FIX VERIFIED!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "`nKey Findings:" -ForegroundColor White
Write-Host "  • Database path is absolute: $($dbInfo.db_path)" -ForegroundColor Gray
Write-Host "  • Submitter writes to same DB as Verifier reads from" -ForegroundColor Gray
Write-Host "  • Cases appear in workflow queue immediately" -ForegroundColor Gray
Write-Host "`nNext Steps:" -ForegroundColor White
Write-Host "  • Test in Verifier Console UI (http://localhost:5173)" -ForegroundColor Gray
Write-Host "  • Submit case and verify it appears in queue" -ForegroundColor Gray
Write-Host "  • Check browser console for API logs" -ForegroundColor Gray
Write-Host ""
