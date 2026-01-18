#!/usr/bin/env pwsh
<#!
.SYNOPSIS
    Phase 5.1 Verifier Decision Loop - End-to-End Test Script

.DESCRIPTION
    Tests the approve/reject flow:
    1. Create submission
    2. Find linked case
    3. Assign case
    4. Approve case (decision endpoint)
    5. Verify case status + decision + timeline events

.NOTES
    Requires backend on port 8001
#>

$ErrorActionPreference = "Stop"
$BASE_URL = "http://127.0.0.1:8001"

Write-Host "==================================" -ForegroundColor Cyan
Write-Host "Phase 5.1: Decision Loop Test" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""

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

    $params = @{
        Uri = "$BASE_URL$Path"
        Method = $Method
        Headers = $headers
    }

    if ($Body) {
        $params.Body = ($Body | ConvertTo-Json -Depth 10)
        Write-Host "    Body: $($params.Body)" -ForegroundColor DarkGray
    }

    try {
        $response = Invoke-RestMethod @params
        Write-Host "    SUCCESS" -ForegroundColor Green
        return $response
    } catch {
        Write-Host "    FAILED: $($_.Exception.Message)" -ForegroundColor Red
        throw
    }
}

# Step 1: Create submission
Write-Host "`n[STEP 1] Create test submission" -ForegroundColor Magenta

$submissionData = @{
    kind = "csf_practitioner"
    decisionType = "csf_practitioner"
    submittedAt = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
    formData = @{
        firstName = "Alex"
        lastName = "Morgan"
        licenseNumber = "MD-55555"
    }
    evaluatorOutput = @{
        decision = "NEEDS_REVIEW"
    }
}

$submission = Invoke-Api -Method POST -Path "/submissions" -Body $submissionData -Description "Create submission"
Write-Host "    Submission ID: $($submission.id)" -ForegroundColor Cyan

# Step 2: Find linked case
Write-Host "`n[STEP 2] Find linked case" -ForegroundColor Magenta

$cases = Invoke-Api -Method GET -Path "/workflow/cases?limit=50" -Description "List recent cases"
$linkedCase = $cases.items | Where-Object { $_.submissionId -eq $submission.id } | Select-Object -First 1

if (-not $linkedCase) {
    Write-Host "    ERROR: No case found for submission $($submission.id)" -ForegroundColor Red
    exit 1
}

Write-Host "    Case ID: $($linkedCase.id)" -ForegroundColor Cyan
$caseId = $linkedCase.id

# Step 3: Assign case
Write-Host "`n[STEP 3] Assign case" -ForegroundColor Magenta

$assignData = @{
    assignee = "verifier@acme.com"
}

$assignedCase = Invoke-Api -Method POST -Path "/workflow/cases/$caseId/assign" -Body $assignData -Description "Assign to verifier"
Write-Host "    Assigned to: $($assignedCase.assignedTo)" -ForegroundColor Cyan

# Step 4: Approve decision
Write-Host "`n[STEP 4] Approve case (decision endpoint)" -ForegroundColor Magenta

$decisionData = @{
    decision = "APPROVED"
    reason = "All requirements met"
    decidedByRole = "verifier"
    decidedByName = "verifier@acme.com"
}

$decision = Invoke-Api -Method POST -Path "/workflow/cases/$caseId/decision" -Body $decisionData -Description "Approve decision"
Write-Host "    Decision: $($decision.decision)" -ForegroundColor Cyan

# Step 5: Verify case status + decision + timeline events
Write-Host "`n[STEP 5] Verify status + decision + timeline" -ForegroundColor Magenta

$case = Invoke-Api -Method GET -Path "/workflow/cases/$caseId" -Description "Fetch case"
Write-Host "    Case Status: $($case.status)" -ForegroundColor Cyan

if ($case.status -ne "approved") {
    Write-Host "    ERROR: Expected case status 'approved', got '$($case.status)'" -ForegroundColor Red
    exit 1
}

$currentDecision = Invoke-Api -Method GET -Path "/workflow/cases/$caseId/decision" -Description "Fetch decision"
if ($currentDecision.decision -ne "APPROVED") {
    Write-Host "    ERROR: Expected decision 'APPROVED', got '$($currentDecision.decision)'" -ForegroundColor Red
    exit 1
}

$events = Invoke-Api -Method GET -Path "/workflow/cases/$caseId/events" -Description "Fetch case events"
$eventTypes = $events | ForEach-Object { $_.eventType }

if (-not ($eventTypes -contains "case_decision_created")) {
    Write-Host "    ERROR: Missing case_decision_created event" -ForegroundColor Red
    exit 1
}
if (-not ($eventTypes -contains "case_status_changed")) {
    Write-Host "    ERROR: Missing case_status_changed event" -ForegroundColor Red
    exit 1
}

Write-Host "    Timeline events verified" -ForegroundColor Green

Write-Host "`n✅ Phase 5.1 Decision Loop test passed" -ForegroundColor Green
