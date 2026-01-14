# Phase 1 HTTP API Integration Test
# Tests submission-to-case workflow via REST API

Write-Host "`n" -NoNewline
Write-Host "=" * 80 -ForegroundColor Cyan
Write-Host "Phase 1: HTTP API Integration Test" -ForegroundColor Cyan
Write-Host "=" * 80 -ForegroundColor Cyan

# Check if backend is running
Write-Host "`n[1/6] Checking backend health..." -ForegroundColor Yellow
try {
    $health = Invoke-RestMethod -Uri "http://localhost:8001/workflow/health" -TimeoutSec 5
    if ($health.ok) {
        Write-Host "✓ Backend is running" -ForegroundColor Green
        Write-Host "  Environment: $($health.env)" -ForegroundColor Gray
    } else {
        Write-Host "✗ Backend health check failed" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "✗ Backend not reachable. Please start backend first:" -ForegroundColor Red
    Write-Host "  cd backend" -ForegroundColor Gray
    Write-Host "  .\.venv\Scripts\python.exe -m uvicorn src.api.main:app --reload --host 127.0.0.1 --port 8001" -ForegroundColor Gray
    exit 1
}

# Test 1: Create submission (should auto-create case)
Write-Host "`n[2/6] Creating submission via POST /submissions..." -ForegroundColor Yellow

$submissionData = @{
    decisionType = "csf_practitioner"
    submittedBy = "phase1-test@example.com"
    formData = @{
        name = "Dr. Phase One Test"
        licenseNumber = "PHASE1-001"
        specialty = "Cardiology"
        state = "CA"
    }
} | ConvertTo-Json

try {
    $submission = Invoke-RestMethod -Method POST -Uri "http://localhost:8001/submissions" `
        -ContentType "application/json" `
        -Body $submissionData
    
    Write-Host "✓ Submission created successfully" -ForegroundColor Green
    Write-Host "  Submission ID: $($submission.id)" -ForegroundColor Gray
    Write-Host "  Decision Type: $($submission.decisionType)" -ForegroundColor Gray
    Write-Host "  Submitted By: $($submission.submittedBy)" -ForegroundColor Gray
    
    $submissionId = $submission.id
} catch {
    Write-Host "✗ Failed to create submission" -ForegroundColor Red
    Write-Host "  Error: $_" -ForegroundColor Red
    exit 1
}

# Test 2: List cases (should include auto-created case)
Write-Host "`n[3/6] Listing cases via GET /workflow/cases..." -ForegroundColor Yellow

Start-Sleep -Seconds 1  # Give backend a moment to create case

try {
    $casesResponse = Invoke-RestMethod -Uri "http://localhost:8001/workflow/cases"
    
    Write-Host "✓ Cases retrieved successfully" -ForegroundColor Green
    Write-Host "  Total cases: $($casesResponse.total)" -ForegroundColor Gray
    
    # Find case linked to our submission
    $ourCase = $null
    foreach ($case in $casesResponse.items) {
        if ($case.submissionId -eq $submissionId) {
            $ourCase = $case
            break
        }
    }
    
    if ($ourCase) {
        Write-Host "✓ Found auto-created case!" -ForegroundColor Green
        Write-Host "  Case ID: $($ourCase.id)" -ForegroundColor Gray
        Write-Host "  Title: $($ourCase.title)" -ForegroundColor Gray
        Write-Host "  Status: $($ourCase.status)" -ForegroundColor Gray
        Write-Host "  Submission ID: $($ourCase.submissionId)" -ForegroundColor Gray
        
        $caseId = $ourCase.id
    } else {
        Write-Host "✗ Case not found for submission $submissionId" -ForegroundColor Red
        Write-Host "  Available cases:" -ForegroundColor Gray
        foreach ($c in $casesResponse.items) {
            Write-Host "    - $($c.id) (submission: $($c.submissionId))" -ForegroundColor Gray
        }
        exit 1
    }
} catch {
    Write-Host "✗ Failed to list cases" -ForegroundColor Red
    Write-Host "  Error: $_" -ForegroundColor Red
    exit 1
}

# Test 3: Get case by ID
Write-Host "`n[4/6] Getting case by ID via GET /workflow/cases/{id}..." -ForegroundColor Yellow

try {
    $case = Invoke-RestMethod -Uri "http://localhost:8001/workflow/cases/$caseId"
    
    Write-Host "✓ Case retrieved successfully" -ForegroundColor Green
    Write-Host "  Case ID: $($case.id)" -ForegroundColor Gray
    Write-Host "  Title: $($case.title)" -ForegroundColor Gray
    Write-Host "  Decision Type: $($case.decisionType)" -ForegroundColor Gray
    Write-Host "  Submission ID: $($case.submissionId)" -ForegroundColor Gray
} catch {
    Write-Host "✗ Failed to get case" -ForegroundColor Red
    Write-Host "  Error: $_" -ForegroundColor Red
    exit 1
}

# Test 4: Get linked submission (NEW ENDPOINT)
Write-Host "`n[5/6] Getting linked submission via GET /workflow/cases/{id}/submission..." -ForegroundColor Yellow

try {
    $linkedSubmission = Invoke-RestMethod -Uri "http://localhost:8001/workflow/cases/$caseId/submission"
    
    Write-Host "✓ Linked submission retrieved successfully" -ForegroundColor Green
    Write-Host "  Submission ID: $($linkedSubmission.id)" -ForegroundColor Gray
    Write-Host "  Form Data Name: $($linkedSubmission.formData.name)" -ForegroundColor Gray
    Write-Host "  Form Data License: $($linkedSubmission.formData.licenseNumber)" -ForegroundColor Gray
} catch {
    Write-Host "✗ Failed to get linked submission" -ForegroundColor Red
    Write-Host "  Error: $_" -ForegroundColor Red
    exit 1
}

# Test 5: Verify linkage
Write-Host "`n[6/6] Verifying submission ↔ case linkage..." -ForegroundColor Yellow

if ($submission.id -eq $linkedSubmission.id -and $case.submissionId -eq $submission.id) {
    Write-Host "✓ PASS: Complete linkage verified" -ForegroundColor Green
    Write-Host "  Original Submission ID:  $($submission.id)" -ForegroundColor Gray
    Write-Host "  Case submission_id:      $($case.submissionId)" -ForegroundColor Gray
    Write-Host "  Retrieved Submission ID: $($linkedSubmission.id)" -ForegroundColor Gray
} else {
    Write-Host "✗ FAIL: Linkage mismatch!" -ForegroundColor Red
    Write-Host "  Original: $($submission.id)" -ForegroundColor Red
    Write-Host "  Case: $($case.submissionId)" -ForegroundColor Red
    Write-Host "  Retrieved: $($linkedSubmission.id)" -ForegroundColor Red
    exit 1
}

# Summary
Write-Host "`n" -NoNewline
Write-Host "=" * 80 -ForegroundColor Green
Write-Host "All Tests Passed! ✓" -ForegroundColor Green
Write-Host "=" * 80 -ForegroundColor Green

Write-Host "`nPhase 1 HTTP API Integration: VERIFIED" -ForegroundColor Cyan
Write-Host "  ✓ POST /submissions → creates submission + case" -ForegroundColor Green
Write-Host "  ✓ GET /workflow/cases → returns cases" -ForegroundColor Green
Write-Host "  ✓ GET /workflow/cases/{id} → returns case details" -ForegroundColor Green
Write-Host "  ✓ GET /workflow/cases/{id}/submission → returns linked submission" -ForegroundColor Green
Write-Host "  ✓ Submission ↔ Case linkage → verified" -ForegroundColor Green

Write-Host "`nNext Steps:" -ForegroundColor Cyan
Write-Host "  1. Start frontend: cd frontend && npm run dev" -ForegroundColor Gray
Write-Host "  2. Navigate to http://localhost:5173" -ForegroundColor Gray
Write-Host "  3. Submit a CSF form" -ForegroundColor Gray
Write-Host "  4. Open Console and verify case appears" -ForegroundColor Gray
Write-Host "  5. Click case and verify Submission tab loads data" -ForegroundColor Gray

Write-Host "`n"
