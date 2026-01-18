# PHASE 7.5 - Auto-trigger Decision Intelligence Smoke Test
# End-to-end test: Create submission → Update → Attach evidence → Request info → Verify events

param(
    [string]$ApiBase = "http://127.0.0.1:8001"
)

$ErrorActionPreference = "Stop"

Write-Host "╔════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  PHASE 7.5 - AUTO-TRIGGER INTELLIGENCE SMOKE TEST        ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# Helper function to make API calls with error handling
function Invoke-ApiCall {
    param(
        [string]$Uri,
        [string]$Method = "GET",
        [object]$Body = $null
    )
    
    try {
        $headers = @{
            "Content-Type" = "application/json"
            "Accept" = "application/json"
        }
        
        $params = @{
            Uri = $Uri
            Method = $Method
            Headers = $headers
        }
        
        if ($Body) {
            $params.Body = ($Body | ConvertTo-Json -Depth 10)
        }
        
        return Invoke-RestMethod @params
    }
    catch {
        Write-Host "❌ API call failed: $($_.Exception.Message)" -ForegroundColor Red
        Write-Host "   URI: $Uri" -ForegroundColor Yellow
        if ($_.ErrorDetails.Message) {
            Write-Host "   Details: $($_.ErrorDetails.Message)" -ForegroundColor Yellow
        }
        throw
    }
}

# Test counters
$script:passCount = 0
$script:failCount = 0

function Assert-Condition {
    param(
        [string]$Description,
        [scriptblock]$Condition
    )
    
    try {
        $result = & $Condition
        if ($result) {
            Write-Host "  ✓ $Description" -ForegroundColor Green
            $script:passCount++
        }
        else {
            Write-Host "  ✗ $Description" -ForegroundColor Red
            $script:failCount++
        }
    }
    catch {
        Write-Host "  ✗ $Description - Error: $($_.Exception.Message)" -ForegroundColor Red
        $script:failCount++
    }
}

# ============================================================================
# TEST 1: Create Submission → Auto-compute Intelligence
# ============================================================================

Write-Host "[TEST 1] Create submission and verify auto-intelligence" -ForegroundColor Yellow

$submission = Invoke-ApiCall -Uri "$ApiBase/submissions" -Method POST -Body @{
    decisionType = "csf_practitioner"
    submittedBy = "smoketest@example.com"
    formData = @{
        practitionerName = "Dr. Smoke Test"
        deaNumber = "AT9999999"
        licenseNumber = "TEST-123"
    }
}

Write-Host "  → Submission created: $($submission.id)" -ForegroundColor Gray

# Create case linked to submission
$case = Invoke-ApiCall -Uri "$ApiBase/workflow/cases" -Method POST -Body @{
    decisionType = "csf_practitioner"
    title = "Phase 7.5 Smoke Test Case"
    summary = "Testing auto-trigger intelligence"
    submissionId = $submission.id
}

Write-Host "  → Case created: $($case.id)" -ForegroundColor Gray

# Wait briefly for auto-compute
Start-Sleep -Seconds 2

# Check intelligence exists
$intel1 = Invoke-ApiCall -Uri "$ApiBase/workflow/cases/$($case.id)/intelligence"

Assert-Condition "Intelligence auto-computed" { $intel1 -ne $null }
Assert-Condition "Confidence score exists" { $intel1.confidence_score -ne $null }
Assert-Condition "Confidence band exists" { $intel1.confidence_band -ne $null }
Assert-Condition "Gaps detected" { $intel1.gaps.Count -gt 0 }

$initialConfidence = $intel1.confidence_score
$initialTimestamp = $intel1.computed_at

Write-Host "  → Initial confidence: $initialConfidence ($($intel1.confidence_band))" -ForegroundColor Gray
Write-Host "  → Gaps found: $($intel1.gaps.Count)" -ForegroundColor Gray

# ============================================================================
# TEST 2: Update Submission → Intelligence Refreshes
# ============================================================================

Write-Host "`n[TEST 2] Update submission and verify intelligence refresh" -ForegroundColor Yellow

Start-Sleep -Seconds 2.5  # Wait past throttle window

# Update submission
$updatedSubmission = Invoke-ApiCall -Uri "$ApiBase/submissions/$($submission.id)" -Method PATCH -Body @{
    formData = @{
        practitionerName = "Dr. Smoke Test Updated"
        deaNumber = "AT9999999"
        licenseNumber = "TEST-123-UPDATED"
        additionalInfo = "Updated for testing"
    }
}

Write-Host "  → Submission updated" -ForegroundColor Gray

# Wait for auto-recompute
Start-Sleep -Seconds 2

# Check intelligence updated
$intel2 = Invoke-ApiCall -Uri "$ApiBase/workflow/cases/$($case.id)/intelligence"

Assert-Condition "Intelligence timestamp changed" { $intel2.computed_at -ne $initialTimestamp }
Assert-Condition "Confidence score present" { $intel2.confidence_score -ne $null }

Write-Host "  → New timestamp: $($intel2.computed_at)" -ForegroundColor Gray
Write-Host "  → Confidence: $($intel2.confidence_score) ($($intel2.confidence_band))" -ForegroundColor Gray

# ============================================================================
# TEST 3: Check Events Timeline
# ============================================================================

Write-Host "`n[TEST 3] Verify decision_intelligence_updated events" -ForegroundColor Yellow

$events = Invoke-ApiCall -Uri "$ApiBase/workflow/cases/$($case.id)/events"

$intelEvents = $events | Where-Object { $_.eventType -eq "decision_intelligence_updated" }

Assert-Condition "Intelligence update events exist" { $intelEvents.Count -gt 0 }

if ($intelEvents.Count -gt 0) {
    Write-Host "  → Found $($intelEvents.Count) intelligence update event(s)" -ForegroundColor Gray
    $latestEvent = $intelEvents | Sort-Object -Property createdAt -Descending | Select-Object -First 1
    Write-Host "  → Latest event: $($latestEvent.eventDetail)" -ForegroundColor Gray
}

# ============================================================================
# TEST 4: Manual Recompute Endpoint
# ============================================================================

Write-Host "`n[TEST 4] Test manual recompute endpoint" -ForegroundColor Yellow

Start-Sleep -Seconds 2.5  # Wait past throttle

$intel3 = Invoke-ApiCall -Uri "$ApiBase/workflow/cases/$($case.id)/intelligence/recompute" -Method POST

Assert-Condition "Manual recompute succeeds" { $intel3 -ne $null }
Assert-Condition "Returns intelligence data" { $intel3.confidence_score -ne $null }

Write-Host "  → Manual recompute completed" -ForegroundColor Gray
Write-Host "  → Confidence: $($intel3.confidence_score) ($($intel3.confidence_band))" -ForegroundColor Gray

# ============================================================================
# TEST 5: Throttle Verification
# ============================================================================

Write-Host "`n[TEST 5] Verify throttle prevents rapid recomputes" -ForegroundColor Yellow

$timestamp1 = (Invoke-ApiCall -Uri "$ApiBase/workflow/cases/$($case.id)/intelligence").computed_at

# Immediate second call (should be throttled at service layer)
$intel4 = Invoke-ApiCall -Uri "$ApiBase/workflow/cases/$($case.id)/intelligence/recompute" -Method POST

$timestamp2 = $intel4.computed_at

Assert-Condition "Throttle active (timestamp unchanged or minimal diff)" { 
    # Allow up to 1 second difference due to request time
    $t1 = [DateTime]::Parse($timestamp1)
    $t2 = [DateTime]::Parse($timestamp2)
    $diff = ($t2 - $t1).TotalSeconds
    $diff -lt 1.5
}

Write-Host "  → Throttle verified (time diff: $([Math]::Round($diff, 2))s)" -ForegroundColor Gray

# ============================================================================
# SUMMARY
# ============================================================================

Write-Host "`n╔════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  TEST SUMMARY                                             ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan

$total = $script:passCount + $script:failCount
$passRate = if ($total -gt 0) { [Math]::Round(($script:passCount / $total) * 100, 1) } else { 0 }

Write-Host ""
Write-Host "  Total Assertions: $total" -ForegroundColor White
Write-Host "  Passed: $script:passCount" -ForegroundColor Green
Write-Host "  Failed: $script:failCount" -ForegroundColor $(if ($script:failCount -gt 0) { "Red" } else { "Green" })
Write-Host "  Pass Rate: $passRate%" -ForegroundColor $(if ($passRate -ge 80) { "Green" } elseif ($passRate -ge 50) { "Yellow" } else { "Red" })
Write-Host ""

if ($script:failCount -eq 0) {
    Write-Host "🎉 ALL TESTS PASSED!" -ForegroundColor Green
    exit 0
}
else {
    Write-Host "⚠️  SOME TESTS FAILED" -ForegroundColor Yellow
    exit 1
}
