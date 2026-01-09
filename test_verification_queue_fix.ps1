# Quick Verification Script for Work Queue Fix
# Run this after starting the backend server on port 8001

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Verification Work Queue Fix - Quick Test" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

$baseUrl = "http://127.0.0.1:8001"

# Test 1: Submit Happy-Path Facility CSF
Write-Host "[1/4] Submitting happy-path facility CSF..." -ForegroundColor Yellow

$happyBody = @{
    facility_name = "Happy Path Test Facility"
    facility_type = "facility"
    account_number = "TEST-HAPPY-001"
    pharmacy_license_number = "PHOH-99999"
    dea_number = "BF9999999"
    pharmacist_in_charge_name = "Dr. Test Happy"
    pharmacist_contact_phone = "555-9999"
    ship_to_state = "OH"
    attestation_accepted = $true
    controlled_substances = @(
        @{
            id = "test-oxy"
            name = "Oxycodone Test"
            ndc = "99999-999-99"
            dea_schedule = "II"
            dosage_form = "tablet"
        }
    )
} | ConvertTo-Json -Depth 10

try {
    $happyResp = Invoke-RestMethod -Uri "$baseUrl/csf/facility/submit" -Method POST -Body $happyBody -ContentType "application/json"
    Write-Host "  ✓ Happy-path submission ID: $($happyResp.submission_id)" -ForegroundColor Green
    Write-Host "  ✓ Decision status: $($happyResp.decision_status)" -ForegroundColor Green
} catch {
    Write-Host "  ✗ Failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Test 2: Submit Blocked Facility CSF
Write-Host "`n[2/4] Submitting blocked facility CSF..." -ForegroundColor Yellow

$blockedBody = @{
    facility_name = ""
    facility_type = "facility"
    account_number = "TEST-BLOCKED-001"
    pharmacy_license_number = ""
    dea_number = ""
    pharmacist_in_charge_name = ""
    ship_to_state = ""
    attestation_accepted = $false
} | ConvertTo-Json

try {
    $blockedResp = Invoke-RestMethod -Uri "$baseUrl/csf/facility/submit" -Method POST -Body $blockedBody -ContentType "application/json"
    Write-Host "  ✓ Blocked submission ID: $($blockedResp.submission_id)" -ForegroundColor Green
    Write-Host "  ✓ Decision status: $($blockedResp.decision_status)" -ForegroundColor Green
} catch {
    Write-Host "  ✗ Failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Test 3: Fetch Work Queue
Write-Host "`n[3/4] Fetching work queue..." -ForegroundColor Yellow

try {
    $queue = Invoke-RestMethod -Uri "$baseUrl/console/work-queue"
    Write-Host "  ✓ Total items in queue: $($queue.total)" -ForegroundColor Green
} catch {
    Write-Host "  ✗ Failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Test 4: Verify Results
Write-Host "`n[4/4] Verifying work queue items..." -ForegroundColor Yellow

$errors = @()

foreach ($item in $queue.items) {
    if ($item.csf_type -eq "facility") {
        Write-Host "`n  Checking facility item: $($item.submission_id)" -ForegroundColor White
        
        # Check title
        if ($item.title -like "*Facility CSF*") {
            Write-Host "    ✓ Title contains 'Facility CSF': $($item.title)" -ForegroundColor Green
        } else {
            Write-Host "    ✗ Title missing 'Facility CSF': $($item.title)" -ForegroundColor Red
            $errors += "Title missing 'Facility CSF'"
        }
        
        # Check subtitle doesn't contain "Hospital CSF"
        if ($item.subtitle -like "*Hospital CSF*") {
            Write-Host "    ✗ Subtitle incorrectly contains 'Hospital CSF': $($item.subtitle)" -ForegroundColor Red
            $errors += "Subtitle contains 'Hospital CSF'"
        } else {
            Write-Host "    ✓ Subtitle does NOT contain 'Hospital CSF'" -ForegroundColor Green
        }
        
        # Check decision status
        if ($item.decision_status -in @("ok_to_ship", "blocked", "needs_review")) {
            Write-Host "    ✓ Decision status: $($item.decision_status)" -ForegroundColor Green
        } else {
            Write-Host "    ✗ Invalid decision status: $($item.decision_status)" -ForegroundColor Red
            $errors += "Invalid decision status"
        }
        
        # Show subtitle for manual verification
        Write-Host "    📝 Subtitle: $($item.subtitle)" -ForegroundColor Cyan
    }
}

# Summary
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "VERIFICATION RESULTS" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

if ($errors.Count -eq 0) {
    Write-Host "✓ All tests PASSED!" -ForegroundColor Green
    Write-Host "`nExpected behavior verified:" -ForegroundColor Green
    Write-Host "  - Facility CSF submissions show 'Facility CSF' in title" -ForegroundColor White
    Write-Host "  - Subtitles do NOT contain 'Hospital CSF'" -ForegroundColor White
    Write-Host "  - Decision statuses are valid (ok_to_ship/blocked/needs_review)" -ForegroundColor White
    exit 0
} else {
    Write-Host "✗ Tests FAILED with $($errors.Count) error(s):" -ForegroundColor Red
    $errors | ForEach-Object { Write-Host "  - $_" -ForegroundColor Red }
    exit 1
}
