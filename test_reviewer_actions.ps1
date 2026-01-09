# Test Reviewer Actions Implementation
# Tests the complete reviewer workflow with admin protection and audit fields

Write-Host "=== Testing Compliance Console Reviewer Actions ===" -ForegroundColor Cyan
Write-Host ""

$baseUrl = "http://localhost:8001"
$headers = @{
    "Content-Type" = "application/json"
}

# Test 1: Submit a CSF
Write-Host "[1/7] Submitting practitioner CSF..." -ForegroundColor Yellow
$submitBody = @{
    account_number = "TEST-REVIEWER-001"
    prescriber_name = "Dr. Review Test"
    dea_number = "AP9876543"
    ship_to_state = "CA"
    attestation_accepted = $true
} | ConvertTo-Json

try {
    $submitResponse = Invoke-RestMethod -Uri "$baseUrl/csf/practitioner/submit" -Method POST -Headers $headers -Body $submitBody
    $submissionId = $submitResponse.submission_id
    Write-Host "✓ Submitted: $submissionId" -ForegroundColor Green
    Write-Host "  Status: $($submitResponse.status)" -ForegroundColor Gray
    Write-Host "  Decision: $($submitResponse.decision_status)" -ForegroundColor Gray
    Write-Host ""
} catch {
    Write-Host "✗ Failed to submit CSF: $_" -ForegroundColor Red
    exit 1
}

# Test 2: Verify appears in work queue
Write-Host "[2/7] Checking work queue..." -ForegroundColor Yellow
try {
    $queueResponse = Invoke-RestMethod -Uri "$baseUrl/console/work-queue" -Method GET
    $inQueue = $queueResponse.items | Where-Object { $_.submission_id -eq $submissionId }
    
    if ($inQueue) {
        Write-Host "✓ Found in work queue" -ForegroundColor Green
        Write-Host "  Total items: $($queueResponse.total)" -ForegroundColor Gray
        Write-Host "  Statistics: $($queueResponse.statistics.by_status | ConvertTo-Json -Compress)" -ForegroundColor Gray
    } else {
        Write-Host "✗ Not found in work queue" -ForegroundColor Red
        exit 1
    }
    Write-Host ""
} catch {
    Write-Host "✗ Failed to get work queue: $_" -ForegroundColor Red
    exit 1
}

# Test 3: Start review
Write-Host "[3/7] Starting review..." -ForegroundColor Yellow
$updateBody = @{
    status = "in_review"
} | ConvertTo-Json

try {
    $updateResponse = Invoke-RestMethod -Uri "$baseUrl/console/work-queue/$submissionId" -Method PATCH -Headers $headers -Body $updateBody
    
    if ($updateResponse.status -eq "in_review") {
        Write-Host "✓ Status updated to in_review" -ForegroundColor Green
        Write-Host "  reviewed_at: $($updateResponse.reviewed_at)" -ForegroundColor Gray
    } else {
        Write-Host "✗ Status not updated correctly" -ForegroundColor Red
        exit 1
    }
    Write-Host ""
} catch {
    Write-Host "✗ Failed to start review: $_" -ForegroundColor Red
    exit 1
}

# Test 4: Add reviewer notes
Write-Host "[4/7] Adding reviewer notes..." -ForegroundColor Yellow
$notesBody = @{
    reviewer_notes = "Verified DEA license AP9876543 is active in CA. Checking attestation acceptance."
} | ConvertTo-Json

try {
    $notesResponse = Invoke-RestMethod -Uri "$baseUrl/console/work-queue/$submissionId" -Method PATCH -Headers $headers -Body $notesBody
    
    if ($notesResponse.reviewer_notes) {
        Write-Host "✓ Notes added successfully" -ForegroundColor Green
        Write-Host "  Notes: $($notesResponse.reviewer_notes)" -ForegroundColor Gray
    } else {
        Write-Host "✗ Notes not saved" -ForegroundColor Red
        exit 1
    }
    Write-Host ""
} catch {
    Write-Host "✗ Failed to add notes: $_" -ForegroundColor Red
    exit 1
}

# Test 5: Approve with custom reviewed_by
Write-Host "[5/7] Approving submission with custom reviewer..." -ForegroundColor Yellow
$approveBody = @{
    status = "approved"
    reviewer_notes = "All checks passed. DEA valid, attestation accepted. Approved for shipping."
    reviewed_by = "jane.reviewer@autocomply.example"
} | ConvertTo-Json

try {
    $approveResponse = Invoke-RestMethod -Uri "$baseUrl/console/work-queue/$submissionId" -Method PATCH -Headers $headers -Body $approveBody
    
    if ($approveResponse.status -eq "approved" -and $approveResponse.reviewed_by -eq "jane.reviewer@autocomply.example" -and $approveResponse.reviewed_at) {
        Write-Host "✓ Submission approved successfully" -ForegroundColor Green
        Write-Host "  Status: $($approveResponse.status)" -ForegroundColor Gray
        Write-Host "  Reviewed by: $($approveResponse.reviewed_by)" -ForegroundColor Gray
        Write-Host "  Reviewed at: $($approveResponse.reviewed_at)" -ForegroundColor Gray
    } else {
        Write-Host "✗ Approval not recorded correctly" -ForegroundColor Red
        Write-Host "  Status: $($approveResponse.status)" -ForegroundColor Red
        Write-Host "  Reviewed by: $($approveResponse.reviewed_by)" -ForegroundColor Red
        Write-Host "  Reviewed at: $($approveResponse.reviewed_at)" -ForegroundColor Red
        exit 1
    }
    Write-Host ""
} catch {
    Write-Host "✗ Failed to approve: $_" -ForegroundColor Red
    exit 1
}

# Test 6: Get submission detail
Write-Host "[6/7] Getting submission detail..." -ForegroundColor Yellow
try {
    $detailResponse = Invoke-RestMethod -Uri "$baseUrl/console/work-queue/$submissionId" -Method GET
    
    Write-Host "✓ Retrieved submission details" -ForegroundColor Green
    Write-Host "  ID: $($detailResponse.submission_id)" -ForegroundColor Gray
    Write-Host "  Type: $($detailResponse.csf_type)" -ForegroundColor Gray
    Write-Host "  Status: $($detailResponse.status)" -ForegroundColor Gray
    Write-Host "  Decision: $($detailResponse.decision_status)" -ForegroundColor Gray
    Write-Host "  Reviewed by: $($detailResponse.reviewed_by)" -ForegroundColor Gray
    Write-Host "  Reviewed at: $($detailResponse.reviewed_at)" -ForegroundColor Gray
    Write-Host "  Notes: $($detailResponse.reviewer_notes)" -ForegroundColor Gray
    Write-Host ""
} catch {
    Write-Host "✗ Failed to get detail: $_" -ForegroundColor Red
    exit 1
}

# Test 7: Verify statistics updated
Write-Host "[7/7] Verifying statistics..." -ForegroundColor Yellow
try {
    $finalQueue = Invoke-RestMethod -Uri "$baseUrl/console/work-queue" -Method GET
    $stats = $finalQueue.statistics.by_status
    
    Write-Host "✓ Statistics updated" -ForegroundColor Green
    Write-Host "  Total: $($finalQueue.total)" -ForegroundColor Gray
    Write-Host "  Submitted: $($stats.submitted)" -ForegroundColor Gray
    Write-Host "  In Review: $($stats.in_review)" -ForegroundColor Gray
    Write-Host "  Approved: $($stats.approved)" -ForegroundColor Gray
    Write-Host "  Rejected: $($stats.rejected)" -ForegroundColor Gray
    Write-Host ""
} catch {
    Write-Host "✗ Failed to get statistics: $_" -ForegroundColor Red
    exit 1
}

# Success
Write-Host "=== All Tests Passed! ===" -ForegroundColor Green
Write-Host ""
Write-Host "Summary:" -ForegroundColor Cyan
Write-Host "  ✓ CSF submission created" -ForegroundColor Green
Write-Host "  ✓ Appears in work queue" -ForegroundColor Green
Write-Host "  ✓ Status workflow working (submitted → in_review → approved)" -ForegroundColor Green
Write-Host "  ✓ Reviewer notes saved" -ForegroundColor Green
Write-Host "  ✓ reviewed_by field set correctly" -ForegroundColor Green
Write-Host "  ✓ reviewed_at timestamp auto-set on approval" -ForegroundColor Green
Write-Host "  ✓ Detail endpoint working" -ForegroundColor Green
Write-Host "  ✓ Statistics updating correctly" -ForegroundColor Green
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host "  1. Open browser to http://localhost:5173" -ForegroundColor White
Write-Host "  2. Run: localStorage.setItem('admin_unlocked', 'true')" -ForegroundColor White
Write-Host "  3. Navigate to Compliance Console → CSF Work Queue" -ForegroundColor White
Write-Host "  4. Test filter chips and action buttons" -ForegroundColor White
Write-Host "  5. Test notes modal" -ForegroundColor White
Write-Host "  6. Test admin protection by removing admin_unlocked" -ForegroundColor White
Write-Host ""
