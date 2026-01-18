#!/usr/bin/env pwsh
<#!
.SYNOPSIS
    Phase 6.2 Attachment Lifecycle Test Script

.DESCRIPTION
    1. Create submission + case
    2. Upload attachment and redact -> download blocked
    3. Upload second attachment and delete -> list excludes, download 410

.NOTES
    Requires backend on port 8001
#>

$ErrorActionPreference = "Stop"
$BASE_URL = "http://127.0.0.1:8001"

Write-Host "==================================" -ForegroundColor Cyan
Write-Host "Phase 6.2: Attachment Lifecycle" -ForegroundColor Cyan
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
        firstName = "Taylor"
        lastName = "Jordan"
        licenseNumber = "MD-88888"
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

# Step 3: Upload + redact
Write-Host "`n[STEP 3] Upload and redact attachment" -ForegroundColor Magenta

$tempFile1 = Join-Path $env:TEMP "attachment-redact.pdf"
"%PDF-1.4`n%Redact test file" | Out-File -FilePath $tempFile1 -Encoding ascii

$form1 = @{
    file = Get-Item $tempFile1
    uploaded_by = "verifier@example.com"
    description = "Redaction test"
}

$upload1 = Invoke-RestMethod -Uri "$BASE_URL/workflow/cases/$caseId/attachments" -Method Post -Form $form1
$attachmentRedactId = $upload1.id
Write-Host "    Attachment ID: $attachmentRedactId" -ForegroundColor Cyan

$redact = Invoke-Api -Method POST -Path "/workflow/cases/$caseId/attachments/$attachmentRedactId/redact" -Body @{ reason = "Sensitive" } -Description "Redact attachment"

try {
    Invoke-WebRequest -Uri "$BASE_URL/workflow/cases/$caseId/attachments/$attachmentRedactId/download" -OutFile (Join-Path $env:TEMP "redact-download.pdf")
    Write-Host "    ERROR: Redacted download should be blocked" -ForegroundColor Red
    exit 1
} catch {
    Write-Host "    Download blocked (expected)" -ForegroundColor Green
}

# Step 4: Upload + delete
Write-Host "`n[STEP 4] Upload and delete attachment" -ForegroundColor Magenta

$tempFile2 = Join-Path $env:TEMP "attachment-delete.pdf"
"%PDF-1.4`n%Delete test file" | Out-File -FilePath $tempFile2 -Encoding ascii

$form2 = @{
    file = Get-Item $tempFile2
    uploaded_by = "verifier@example.com"
    description = "Delete test"
}

$upload2 = Invoke-RestMethod -Uri "$BASE_URL/workflow/cases/$caseId/attachments" -Method Post -Form $form2
$attachmentDeleteId = $upload2.id
Write-Host "    Attachment ID: $attachmentDeleteId" -ForegroundColor Cyan

$delete = Invoke-Api -Method DELETE -Path "/workflow/cases/$caseId/attachments/$attachmentDeleteId" -Body @{ reason = "No longer needed" } -Description "Delete attachment"

$list = Invoke-Api -Method GET -Path "/workflow/cases/$caseId/attachments" -Description "List attachments"
if ($list.items | Where-Object { $_.id -eq $attachmentDeleteId }) {
    Write-Host "    ERROR: Deleted attachment should not be listed" -ForegroundColor Red
    exit 1
}

try {
    Invoke-WebRequest -Uri "$BASE_URL/workflow/cases/$caseId/attachments/$attachmentDeleteId/download" -OutFile (Join-Path $env:TEMP "delete-download.pdf")
    Write-Host "    ERROR: Deleted download should be blocked" -ForegroundColor Red
    exit 1
} catch {
    Write-Host "    Download blocked (expected)" -ForegroundColor Green
}

Write-Host "`n✅ Phase 6.2 Attachment lifecycle test passed" -ForegroundColor Green
