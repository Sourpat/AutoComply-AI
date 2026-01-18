#!/usr/bin/env pwsh
<#!
.SYNOPSIS
    Phase 6.1 Attachments - End-to-End Test Script

.DESCRIPTION
    1. Create submission
    2. Find linked case
    3. Upload attachment
    4. List attachments
    5. Download attachment

.NOTES
    Requires backend on port 8001
#>

$ErrorActionPreference = "Stop"
$BASE_URL = "http://127.0.0.1:8001"

Write-Host "==================================" -ForegroundColor Cyan
Write-Host "Phase 6.1: Attachments Test" -ForegroundColor Cyan
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
        firstName = "Jamie"
        lastName = "Lee"
        licenseNumber = "MD-77777"
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

# Step 3: Upload attachment
Write-Host "`n[STEP 3] Upload attachment" -ForegroundColor Magenta

$tempFile = Join-Path $env:TEMP "attachment-test.pdf"
"%PDF-1.4`n%Attachment test file" | Out-File -FilePath $tempFile -Encoding ascii

$form = @{
    file = Get-Item $tempFile
    uploaded_by = "submitter@example.com"
    description = "Test attachment"
}

$uploadResponse = Invoke-RestMethod -Uri "$BASE_URL/workflow/cases/$caseId/attachments" -Method Post -Form $form
Write-Host "    Attachment ID: $($uploadResponse.id)" -ForegroundColor Cyan
$attachmentId = $uploadResponse.id

# Step 4: List attachments
Write-Host "`n[STEP 4] List attachments" -ForegroundColor Magenta

$listResponse = Invoke-Api -Method GET -Path "/workflow/cases/$caseId/attachments" -Description "List attachments"
if ($listResponse.items.Count -lt 1) {
    Write-Host "    ERROR: No attachments found" -ForegroundColor Red
    exit 1
}

# Step 5: Download attachment
Write-Host "`n[STEP 5] Download attachment" -ForegroundColor Magenta

$downloadPath = Join-Path $env:TEMP "attachment-download.txt"
Invoke-WebRequest -Uri "$BASE_URL/workflow/cases/$caseId/attachments/$attachmentId/download" -OutFile $downloadPath

$downloadBytes = [System.IO.File]::ReadAllBytes($downloadPath)
$originalBytes = [System.IO.File]::ReadAllBytes($tempFile)

if ($downloadBytes.Length -ne $originalBytes.Length) {
    Write-Host "    ERROR: Downloaded file size does not match" -ForegroundColor Red
    exit 1
}

Write-Host "    Download verified" -ForegroundColor Green
Write-Host "`n✅ Phase 6.1 Attachments test passed" -ForegroundColor Green
