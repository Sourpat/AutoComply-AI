#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Phase 4.1 Request Info Loop - End-to-End Test Script

.DESCRIPTION
    Tests the complete request info workflow:
    1. Create submission
    2. Find linked case
    3. Request info from verifier
    4. Fetch request details
    5. Update submission
    6. Resubmit to verifier
    
    Expected: Status transitions needs_info -> in_review with timeline events

.NOTES
    Requires backend on port 8001
    Uses PowerShell-native Invoke-RestMethod (not curl)
#>

$ErrorActionPreference = "Stop"
$BASE_URL = "http://127.0.0.1:8001"

Write-Host "==================================" -ForegroundColor Cyan
Write-Host "Phase 4.1: Request Info Loop Test" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""

# Helper function for API calls
function Invoke-Api {
    param(
        [string]$Method = "GET",
        [string]$Path,
        [object]$Body = $null,
        [string]$Description
    )
    
    Write-Host "[$Method] $Path" -ForegroundColor Yellow
    if ($Description) {
        Write-Host "    -> $Description" -ForegroundColor Gray
    }
    
    $headers = @{
        "Content-Type" = "application/json"
        "Accept" = "application/json"
    }
    
    try {
        $params = @{
            Uri = "$BASE_URL$Path"
            Method = $Method
            Headers = $headers
        }
        
        if ($Body) {
            $params.Body = ($Body | ConvertTo-Json -Depth 10)
            Write-Host "    Body: $($params.Body)" -ForegroundColor DarkGray
        }
        
        $response = Invoke-RestMethod @params
        Write-Host "    SUCCESS" -ForegroundColor Green
        return $response
    }
    catch {
        Write-Host "    FAILED: $($_.Exception.Message)" -ForegroundColor Red
        throw
    }
}

# Step 1: Create a test submission
Write-Host "`n[STEP 1] Create test submission" -ForegroundColor Magenta

$submissionData = @{
    kind = "csf_practitioner"
    decisionType = "csf_practitioner"
    submittedAt = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
    formData = @{
        firstName = "Jane"
        lastName = "Smith"
        licenseNumber = "MD-12345"
    }
    evaluatorOutput = @{
        decision = "NEEDS_REVIEW"
    }
}

$submission = Invoke-Api -Method POST -Path "/submissions" -Body $submissionData -Description "Create CSF Practitioner submission"

Write-Host "    Submission ID: $($submission.id)" -ForegroundColor Cyan
Write-Host "    Status: $($submission.status)" -ForegroundColor Cyan

# Step 2: Find the linked case
Write-Host "`n[STEP 2] Find linked case" -ForegroundColor Magenta

$cases = Invoke-Api -Method GET -Path "/workflow/cases?limit=50" -Description "List recent cases"

$linkedCase = $cases.items | Where-Object { $_.submissionId -eq $submission.id } | Select-Object -First 1

if (-not $linkedCase) {
    Write-Host "    ERROR: No case found for submission $($submission.id)" -ForegroundColor Red
    exit 1
}

Write-Host "    Case ID: $($linkedCase.id)" -ForegroundColor Cyan
Write-Host "    Status: $($linkedCase.status)" -ForegroundColor Cyan
Write-Host "    Decision Type: $($linkedCase.decisionType)" -ForegroundColor Cyan

$caseId = $linkedCase.id

# Step 3: Assign case to verifier (if not already)
if (-not $linkedCase.assignedTo) {
    Write-Host "`n[STEP 3] Assign case to verifier" -ForegroundColor Magenta
    
    $assignData = @{
        assignee = "alice@verifier.com"
    }
    
    $assignedCase = Invoke-Api -Method POST -Path "/workflow/cases/$caseId/assign" -Body $assignData -Description "Assign to Alice"
    Write-Host "    Assigned to: $($assignedCase.assignedTo)" -ForegroundColor Cyan
}

# Step 4: Request additional info from verifier
Write-Host "`n[STEP 4] Request additional information" -ForegroundColor Magenta

$requestData = @{
    message = "Please provide updated liability insurance documentation and proof of continuing education credits for 2025."
    requiredFields = @("liabilityInsurance", "continuingEducation")
    requestedBy = "alice@verifier.com"
}

$requestResult = Invoke-Api -Method POST -Path "/workflow/cases/$caseId/request-info" -Body $requestData -Description "Verifier requests missing info"

Write-Host "    Case Status: $($requestResult.case.status)" -ForegroundColor Cyan
Write-Host "    Request ID: $($requestResult.request.id)" -ForegroundColor Cyan
Write-Host "    Message: $($requestResult.request.message)" -ForegroundColor Cyan
Write-Host "    Required Fields: $($requestResult.request.requiredFields -join ', ')" -ForegroundColor Cyan

if ($requestResult.case.status -ne "needs_info") {
    Write-Host "    ERROR: Expected status 'needs_info', got '$($requestResult.case.status)'" -ForegroundColor Red
    exit 1
}

# Step 5: Fetch the open request (as submitter would)
Write-Host "`n[STEP 5] Fetch open request details" -ForegroundColor Magenta

$openRequest = Invoke-Api -Method GET -Path "/workflow/cases/$caseId/request-info" -Description "Submitter fetches request"

if ($openRequest.request) {
    Write-Host "    Request Status: $($openRequest.request.status)" -ForegroundColor Cyan
    Write-Host "    Created: $($openRequest.request.createdAt)" -ForegroundColor Cyan
    Write-Host "    Message: $($openRequest.request.message)" -ForegroundColor Cyan
} else {
    Write-Host "    ERROR: No open request found" -ForegroundColor Red
    exit 1
}

# Step 6: Update submission with requested info
Write-Host "`n[STEP 6] Update submission with requested fields" -ForegroundColor Magenta

$updateData = @{
    formData = @{
        firstName = "Jane"
        lastName = "Smith"
        licenseNumber = "MD-12345"
        licenseState = "OH"
        specialty = "Internal Medicine"
        email = "jane.smith@example.com"
        liabilityInsurance = "Policy LI-2025-98765, expires 12/31/2026"
        continuingEducation = "45 CME credits completed in 2025"
    }
}

$updatedSubmission = Invoke-Api -Method PATCH -Path "/submissions/$($submission.id)" -Body $updateData -Description "Add requested fields"

Write-Host "    Submission updated" -ForegroundColor Cyan

# Step 7: Resubmit to verifier
Write-Host "`n[STEP 7] Resubmit to verifier" -ForegroundColor Magenta

$resubmitData = @{
    submissionId = $submission.id
    note = "Added liability insurance and continuing education documentation as requested"
}

$resubmittedCase = Invoke-Api -Method POST -Path "/workflow/cases/$caseId/resubmit" -Body $resubmitData -Description "Submitter resubmits"

Write-Host "    Case Status: $($resubmittedCase.status)" -ForegroundColor Cyan

if ($resubmittedCase.status -ne "in_review") {
    Write-Host "    ERROR: Expected status 'in_review', got '$($resubmittedCase.status)'" -ForegroundColor Red
    exit 1
}

# Step 8: Verify timeline events
Write-Host "`n[STEP 8] Verify timeline events" -ForegroundColor Magenta

$events = Invoke-Api -Method GET -Path "/workflow/cases/$caseId/events" -Description "Fetch case events"

Write-Host "    Total events: $($events.Count)" -ForegroundColor Cyan

$requestInfoCreated = $events | Where-Object { $_.eventType -eq "request_info_created" } | Select-Object -First 1
$requestInfoResubmitted = $events | Where-Object { $_.eventType -eq "request_info_resubmitted" } | Select-Object -First 1

if ($requestInfoCreated) {
    Write-Host "    Found 'request_info_created' event" -ForegroundColor Green
    Write-Host "      Message: $($requestInfoCreated.message)" -ForegroundColor Gray
} else {
    Write-Host "    Missing 'request_info_created' event" -ForegroundColor Red
}

if ($requestInfoResubmitted) {
    Write-Host "    Found 'request_info_resubmitted' event" -ForegroundColor Green
    Write-Host "      Message: $($requestInfoResubmitted.message)" -ForegroundColor Gray
} else {
    Write-Host "    Missing 'request_info_resubmitted' event" -ForegroundColor Red
}

# Step 9: Verify request is now resolved
Write-Host "`n[STEP 9] Verify request is resolved" -ForegroundColor Magenta

$finalRequest = Invoke-Api -Method GET -Path "/workflow/cases/$caseId/request-info" -Description "Check request status"

if ($finalRequest.request) {
    Write-Host "    ERROR: Request should be resolved (null), but found: $($finalRequest.request.status)" -ForegroundColor Red
} else {
    Write-Host "    SUCCESS: Request is resolved (null)" -ForegroundColor Green
}

# Summary
Write-Host "`n==================================" -ForegroundColor Cyan
Write-Host "Test Summary" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
Write-Host "Submission ID: $($submission.id)" -ForegroundColor White
Write-Host "Case ID: $caseId" -ForegroundColor White
Write-Host "Final Status: $($resubmittedCase.status)" -ForegroundColor White
Write-Host ""
Write-Host "SUCCESS: Request Info loop completed successfully!" -ForegroundColor Green
Write-Host ""
