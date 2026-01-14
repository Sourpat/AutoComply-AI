# Phase 2A - Submitter/Verifier Sync Verification Test

Write-Host "`n=== PHASE 2A: Submitter/Verifier Sync Test ===" -ForegroundColor Cyan
Write-Host "This script verifies that submission/case counts match and sync correctly`n" -ForegroundColor Gray

# Test 0: Check /dev/consistency endpoint
Write-Host "[Test 0] Checking initial consistency..." -ForegroundColor Yellow
try {
    $consistency = Invoke-RestMethod -Uri "http://127.0.0.1:8001/dev/consistency" -Method GET
    Write-Host "  submissions_total: $($consistency.submissions_total)" -ForegroundColor White
    Write-Host "  submissions_active: $($consistency.submissions_active)" -ForegroundColor Green
    Write-Host "  submissions_deleted: $($consistency.submissions_deleted)" -ForegroundColor Red
    Write-Host "  cases_total: $($consistency.cases_total)" -ForegroundColor White
    Write-Host "  cases_active: $($consistency.cases_active)" -ForegroundColor Green
    Write-Host "  cases_cancelled: $($consistency.cases_cancelled)" -ForegroundColor Red
    Write-Host "  orphan_cases: $($consistency.orphan_cases_count)" -ForegroundColor Magenta
    Write-Host "  orphan_submissions: $($consistency.orphan_submissions_count)" -ForegroundColor Magenta
    
    if ($consistency.orphan_cases_count -gt 0 -or $consistency.orphan_submissions_count -gt 0) {
        Write-Host "  ⚠️  WARNING: Found orphaned records!" -ForegroundColor Red
    } else {
        Write-Host "  ✓ No orphans detected" -ForegroundColor Green
    }
} catch {
    Write-Host "  ✗ Failed to check consistency: $_" -ForegroundColor Red
    exit 1
}

Write-Host "`n[Test 1] Checking GET /submissions ordering..." -ForegroundColor Yellow
try {
    $submissions = Invoke-RestMethod -Uri "http://127.0.0.1:8001/submissions?limit=10" -Method GET
    Write-Host "  Returned: $($submissions.Count) submissions" -ForegroundColor White
    
    if ($submissions.Count -gt 1) {
        $first = [datetime]$submissions[0].createdAt
        $second = [datetime]$submissions[1].createdAt
        
        if ($first -ge $second) {
            Write-Host "  ✓ Ordering correct: newest first (DESC)" -ForegroundColor Green
        } else {
            Write-Host "  ✗ Ordering incorrect: oldest first (should be DESC)" -ForegroundColor Red
        }
    } else {
        Write-Host "  ⚠️  Only $($submissions.Count) submission(s), cannot verify ordering" -ForegroundColor Yellow
    }
} catch {
    Write-Host "  ✗ Failed: $_" -ForegroundColor Red
}

Write-Host "`n[Test 2] Checking GET /workflow/cases ordering..." -ForegroundColor Yellow
try {
    $cases = Invoke-RestMethod -Uri "http://127.0.0.1:8001/workflow/cases?limit=10" -Method GET
    Write-Host "  Returned: $($cases.items.Count) cases (total: $($cases.total))" -ForegroundColor White
    
    if ($cases.items.Count -gt 1) {
        $first = [datetime]$cases.items[0].createdAt
        $second = [datetime]$cases.items[1].createdAt
        
        if ($first -ge $second) {
            Write-Host "  ✓ Ordering correct: newest first (DESC)" -ForegroundColor Green
        } else {
            Write-Host "  ✗ Ordering incorrect: oldest first (should be DESC)" -ForegroundColor Red
        }
    } else {
        Write-Host "  ⚠️  Only $($cases.items.Count) case(s), cannot verify ordering" -ForegroundColor Yellow
    }
} catch {
    Write-Host "  ✗ Failed: $_" -ForegroundColor Red
}

Write-Host "`n[Test 3] Creating test submission..." -ForegroundColor Yellow
try {
    $submissionData = @{
        decisionType = "csf_practitioner"
        submittedBy = "test-user@example.com"
        formData = @{
            name = "Dr. Test Physician"
            licenseNumber = "TEST123"
            specialty = "Internal Medicine"
        }
        evaluatorOutput = @{
            decision = "ok_to_ship"
            confidence = 0.95
        }
    } | ConvertTo-Json -Depth 10
    
    $newSubmission = Invoke-RestMethod -Uri "http://127.0.0.1:8001/submissions" `
        -Method POST `
        -ContentType "application/json" `
        -Body $submissionData
    
    $submissionId = $newSubmission.id
    Write-Host "  ✓ Created submission: $submissionId" -ForegroundColor Green
    
    # Check consistency again
    Start-Sleep -Seconds 1
    $consistency2 = Invoke-RestMethod -Uri "http://127.0.0.1:8001/dev/consistency" -Method GET
    
    Write-Host "  New counts:" -ForegroundColor White
    Write-Host "    submissions_active: $($consistency2.submissions_active) (was $($consistency.submissions_active))" -ForegroundColor Cyan
    Write-Host "    cases_active: $($consistency2.cases_active) (was $($consistency.cases_active))" -ForegroundColor Cyan
    
    if ($consistency2.submissions_active -eq ($consistency.submissions_active + 1)) {
        Write-Host "  ✓ Submission count increased by 1" -ForegroundColor Green
    } else {
        Write-Host "  ✗ Submission count mismatch" -ForegroundColor Red
    }
    
    if ($consistency2.cases_active -eq ($consistency.cases_active + 1)) {
        Write-Host "  ✓ Case count increased by 1" -ForegroundColor Green
    } else {
        Write-Host "  ✗ Case count mismatch" -ForegroundColor Red
    }
    
} catch {
    Write-Host "  ✗ Failed to create submission: $_" -ForegroundColor Red
    Write-Host "  Response: $($_.Exception.Response)" -ForegroundColor Red
    exit 1
}

Write-Host "`n[Test 4] Deleting test submission..." -ForegroundColor Yellow
try {
    Invoke-RestMethod -Uri "http://127.0.0.1:8001/submissions/$submissionId" -Method DELETE
    Write-Host "  ✓ Deleted submission: $submissionId" -ForegroundColor Green
    
    # Check consistency after deletion
    Start-Sleep -Seconds 1
    $consistency3 = Invoke-RestMethod -Uri "http://127.0.0.1:8001/dev/consistency" -Method GET
    
    Write-Host "  Final counts:" -ForegroundColor White
    Write-Host "    submissions_active: $($consistency3.submissions_active) (was $($consistency2.submissions_active))" -ForegroundColor Cyan
    Write-Host "    submissions_deleted: $($consistency3.submissions_deleted) (was $($consistency2.submissions_deleted))" -ForegroundColor Cyan
    Write-Host "    cases_active: $($consistency3.cases_active) (was $($consistency2.cases_active))" -ForegroundColor Cyan
    Write-Host "    cases_cancelled: $($consistency3.cases_cancelled) (was $($consistency2.cases_cancelled))" -ForegroundColor Cyan
    
    $submissionCountCorrect = $consistency3.submissions_active -eq $consistency.submissions_active
    $deletedCountCorrect = $consistency3.submissions_deleted -eq ($consistency.submissions_deleted + 1)
    $caseCountCorrect = $consistency3.cases_active -eq $consistency.cases_active
    $cancelledCountCorrect = $consistency3.cases_cancelled -eq ($consistency.cases_cancelled + 1)
    
    if ($submissionCountCorrect) {
        Write-Host "  ✓ Active submission count restored" -ForegroundColor Green
    } else {
        Write-Host "  ✗ Active submission count mismatch" -ForegroundColor Red
    }
    
    if ($deletedCountCorrect) {
        Write-Host "  ✓ Deleted submission count increased by 1" -ForegroundColor Green
    } else {
        Write-Host "  ✗ Deleted submission count mismatch" -ForegroundColor Red
    }
    
    if ($caseCountCorrect) {
        Write-Host "  ✓ Active case count restored" -ForegroundColor Green
    } else {
        Write-Host "  ✗ Active case count mismatch" -ForegroundColor Red
    }
    
    if ($cancelledCountCorrect) {
        Write-Host "  ✓ Cancelled case count increased by 1" -ForegroundColor Green
    } else {
        Write-Host "  ✗ Cancelled case count mismatch" -ForegroundColor Red
    }
    
    if ($submissionCountCorrect -and $deletedCountCorrect -and $caseCountCorrect -and $cancelledCountCorrect) {
        Write-Host "`n✓✓✓ ALL TESTS PASSED ✓✓✓" -ForegroundColor Green
    } else {
        Write-Host "`n✗✗✗ SOME TESTS FAILED ✗✗✗" -ForegroundColor Red
    }
    
} catch {
    Write-Host "  ✗ Failed to delete submission: $_" -ForegroundColor Red
    exit 1
}

Write-Host "`n=== Test Complete ===" -ForegroundColor Cyan
Write-Host "Next: Open http://localhost:5173/console and verify:" -ForegroundColor Yellow
Write-Host "  1. 'My submissions' count matches GET /submissions" -ForegroundColor White
Write-Host "  2. Verifier queue count matches GET /workflow/cases" -ForegroundColor White
Write-Host "  3. Create a submission → both counts increase" -ForegroundColor White
Write-Host "  4. Delete a submission → both counts decrease" -ForegroundColor White
Write-Host "  5. Deleted submission disappears from both views`n" -ForegroundColor White
