# Phase 1.4 - Connected Decision Source Validation Script
# Test both backend endpoints and frontend integration

Write-Host "=== Phase 1.4 Connected Decision Source - Validation ===" -ForegroundColor Cyan
Write-Host ""

$baseUrl = "http://127.0.0.1:8001"
$getLastUrl = "{0}/rag/decisions/last?engine_family=csf&decision_type=csf_practitioner" -f $baseUrl

# Test 1: Check if decision store is empty initially
Write-Host "Test 1: Check last decision (should not exist initially)..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri $getLastUrl -Method GET
    if ($response.exists -eq $false) {
        Write-Host "✓ PASS: No decision exists initially (exists=$($response.exists))" -ForegroundColor Green
    } else {
        Write-Host "✓ FOUND: Decision already exists from previous submission" -ForegroundColor Green
        Write-Host "  Saved at: $($response.saved_at)" -ForegroundColor Gray
    }
} catch {
    Write-Host "✗ FAIL: Could not fetch last decision" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
}

Write-Host ""

# Test 2: Submit a CSF practitioner form
Write-Host "Test 2: Submit a CSF practitioner form..." -ForegroundColor Yellow
$csfPayload = @{
    facility_name = "Test Clinic - Phase 1.4"
    facility_type = "clinic"
    account_number = "ACCT-PHASE-1-4"
    prescriber_name = "Dr. Test Connected Mode"
    state_license_number = "OH-LIC-123456"
    dea_number = "AT1234567"
    ship_to_state = "OH"
    attestation_accepted = $true
    controlled_substances = @(
        @{
            name = "Hydrocodone 10mg"
            quantity = 100
            schedule = "III"
            ndc = "12345-678-90"
        }
    )
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "$baseUrl/csf/practitioner/submit" -Method POST -Body $csfPayload -ContentType "application/json"
    Write-Host "✓ PASS: CSF submitted successfully" -ForegroundColor Green
    Write-Host "  Submission ID: $($response.submission_id)" -ForegroundColor Gray
    Write-Host "  Trace ID: $($response.trace_id)" -ForegroundColor Gray
    Write-Host "  Status: $($response.decision_status)" -ForegroundColor Gray
} catch {
    Write-Host "✗ FAIL: Could not submit CSF" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
}

Write-Host ""

# Test 3: Check if decision was saved to DecisionStore
Write-Host "Test 3: Check if decision was saved to DecisionStore..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri $getLastUrl -Method GET
    if ($response.exists -eq $true) {
        Write-Host "✓ PASS: Decision saved successfully (exists=$($response.exists))" -ForegroundColor Green
        Write-Host "  Saved at: $($response.saved_at)" -ForegroundColor Gray
        Write-Host "  Engine family: $($response.engine_family)" -ForegroundColor Gray
        Write-Host "  Decision type: $($response.decision_type)" -ForegroundColor Gray
        Write-Host "  Evidence keys: $($response.evidence.PSObject.Properties.Name -join ', ')" -ForegroundColor Gray
    } else {
        Write-Host "✗ FAIL: Decision was not saved (exists=$($response.exists))" -ForegroundColor Red
    }
} catch {
    Write-Host "✗ FAIL: Could not fetch last decision after submission" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
}

Write-Host ""
Write-Host "=== Validation Complete ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host "1. Start frontend: cd frontend; npm run dev" -ForegroundColor Gray
Write-Host "2. Navigate to RAG Explorer in Compliance Console" -ForegroundColor Gray
Write-Host "3. In section 2 (Decision explainability):" -ForegroundColor Gray
Write-Host "   - Switch Decision Source to 'From last CSF submission'" -ForegroundColor Gray
Write-Host "   - Click 'Load last CSF submission'" -ForegroundColor Gray
Write-Host "   - Click 'Explain Decision' to see the connected mode in action" -ForegroundColor Gray
Write-Host ""
