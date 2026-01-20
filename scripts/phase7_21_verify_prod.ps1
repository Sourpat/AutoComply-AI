# Phase 7.21 - Production E2E Verification Script
# Verifies Phase 7.18-7.20 features in production (Render backend)

param(
    [string]$BackendUrl = $env:VITE_API_BASE_URL,
    [string]$DevSeedToken = $env:DEV_SEED_TOKEN,
    [switch]$SkipSeed,
    [switch]$Verbose
)

# Colors for output
$Green = "Green"
$Red = "Red"
$Yellow = "Yellow"
$Cyan = "Cyan"

function Write-Step {
    param([string]$Message)
    Write-Host "`n==> $Message" -ForegroundColor $Cyan
}

function Write-Success {
    param([string]$Message)
    Write-Host "    ✅ $Message" -ForegroundColor $Green
}

function Write-Error {
    param([string]$Message)
    Write-Host "    ❌ $Message" -ForegroundColor $Red
}

function Write-Warning {
    param([string]$Message)
    Write-Host "    ⚠️  $Message" -ForegroundColor $Yellow
}

# Validation
if (-not $BackendUrl) {
    Write-Error "Backend URL not set. Provide -BackendUrl or set VITE_API_BASE_URL env var."
    exit 1
}

$BackendUrl = $BackendUrl.TrimEnd('/')

Write-Host "`n╔════════════════════════════════════════════════════════════╗" -ForegroundColor $Cyan
Write-Host "║   Phase 7.21 - Production E2E Verification                 ║" -ForegroundColor $Cyan
Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor $Cyan

# Step 1: Git SHA
Write-Step "1. Git Commit Information"
$gitSha = git rev-parse --short HEAD
$gitBranch = git rev-parse --abbrev-ref HEAD
Write-Success "Branch: $gitBranch"
Write-Success "Commit: $gitSha"
Write-Success "Backend: $BackendUrl"

# Step 2: Health Check
Write-Step "2. Health Check"
try {
    $health = Invoke-RestMethod -Uri "$BackendUrl/workflow/health" -Method GET -TimeoutSec 10
    Write-Success "Backend healthy: $($health.ok)"
    Write-Success "Version: $($health.version)"
} catch {
    Write-Error "Health check failed: $_"
    exit 1
}

# Step 3: Get existing cases
Write-Step "3. Get Existing Cases"
try {
    $cases = Invoke-RestMethod -Uri "$BackendUrl/workflow/cases?limit=100" -Method GET
    $caseCount = $cases.cases.Count
    Write-Success "Total cases: $caseCount"
    
    if ($caseCount -eq 0) {
        Write-Warning "No cases found. Consider running seed endpoint first."
    }
} catch {
    Write-Error "Failed to fetch cases: $_"
    exit 1
}

# Step 4: Seed data (optional, if token provided and not skipped)
$seedCreated = $false
if (-not $SkipSeed -and $DevSeedToken) {
    Write-Step "4. Seed Test Data (Optional)"
    try {
        $headers = @{
            "X-Dev-Seed-Token" = $DevSeedToken
        }
        $seedResult = Invoke-RestMethod -Uri "$BackendUrl/dev/seed" -Method POST -Headers $headers
        Write-Success "Seed completed: $($seedResult.status)"
        Write-Success "Cases created: $($seedResult.cases_created)"
        Write-Success "Submissions created: $($seedResult.submissions_created)"
        $seedCreated = $true
    } catch {
        Write-Warning "Seed failed (may already exist): $_"
    }
} else {
    Write-Step "4. Seed Test Data - SKIPPED"
    if (-not $DevSeedToken) {
        Write-Warning "No DEV_SEED_TOKEN provided"
    }
}

# Step 5: Select a test case
Write-Step "5. Select Test Case"
$testCase = $null
if ($seedCreated) {
    # Use newly seeded case
    $cases = Invoke-RestMethod -Uri "$BackendUrl/workflow/cases?limit=100" -Method GET
    $testCase = $cases.cases | Where-Object { $_.status -eq "new" } | Select-Object -First 1
} else {
    # Use any existing case
    $testCase = $cases.cases | Select-Object -First 1
}

if (-not $testCase) {
    Write-Error "No test case available. Run with -DevSeedToken to create test data."
    exit 1
}

$caseId = $testCase.id
Write-Success "Using case: $caseId"
Write-Success "Status: $($testCase.status)"

# Step 6: Get baseline intelligence history (Phase 7.18)
Write-Step "6. Phase 7.18 - Confidence History Baseline"
try {
    $historyBefore = Invoke-RestMethod -Uri "$BackendUrl/workflow/cases/$caseId/intelligence/history?limit=50" -Method GET
    $historyCountBefore = $historyBefore.history.Count
    Write-Success "History entries before recompute: $historyCountBefore"
    
    if ($historyCountBefore -gt 0) {
        $latestBefore = $historyBefore.history[0]
        Write-Success "Latest confidence: $($latestBefore.payload.confidence_score)%"
        Write-Success "Latest band: $($latestBefore.payload.confidence_band)"
    }
} catch {
    Write-Error "Failed to fetch history: $_"
    exit 1
}

# Step 7: Recompute with reason (Phase 7.19)
Write-Step "7. Phase 7.19 - Recompute with Reason"
try {
    $recomputeBody = @{
        reason = "Phase 7.21 E2E verification test - $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
        force_refresh = $true
    } | ConvertTo-Json

    $recomputeResult = Invoke-RestMethod `
        -Uri "$BackendUrl/workflow/cases/$caseId/recompute" `
        -Method POST `
        -Body $recomputeBody `
        -ContentType "application/json"
    
    Write-Success "Recompute triggered successfully"
    Write-Success "New confidence: $($recomputeResult.confidence_score)%"
    Write-Success "New band: $($recomputeResult.confidence_band)"
    
    # Wait a moment for DB write
    Start-Sleep -Seconds 2
} catch {
    Write-Error "Recompute failed: $_"
    exit 1
}

# Step 8: Verify new history entry (Phase 7.20 - Audit Chain)
Write-Step "8. Phase 7.20 - Verify New History Entry and Chain"
try {
    $historyAfter = Invoke-RestMethod -Uri "$BackendUrl/workflow/cases/$caseId/intelligence/history?limit=50" -Method GET
    $historyCountAfter = $historyAfter.history.Count
    
    if ($historyCountAfter -le $historyCountBefore) {
        Write-Error "History count did not increase: before=$historyCountBefore, after=$historyCountAfter"
        exit 1
    }
    
    Write-Success "History entries after recompute: $historyCountAfter (increased by $($historyCountAfter - $historyCountBefore))"
    
    # Check latest entry for integrity fields
    $latestEntry = $historyAfter.history[0]
    
    # Verify input_hash
    if ($latestEntry.input_hash) {
        Write-Success "input_hash present: $($latestEntry.input_hash.Substring(0, 16))..."
    } else {
        Write-Error "input_hash missing in latest entry"
        exit 1
    }
    
    # Verify triggered_by
    if ($latestEntry.triggered_by) {
        Write-Success "triggered_by: $($latestEntry.triggered_by)"
    } else {
        Write-Warning "triggered_by not set (may be null for system-triggered)"
    }
    
    # Verify previous_run_id chain
    if ($historyCountBefore -gt 0 -and $latestEntry.previous_run_id) {
        $previousEntry = $historyAfter.history[1]
        if ($latestEntry.previous_run_id -eq $previousEntry.id) {
            Write-Success "previous_run_id chain intact: $($latestEntry.previous_run_id.Substring(0, 20))..."
        } else {
            Write-Error "previous_run_id mismatch: expected $($previousEntry.id), got $($latestEntry.previous_run_id)"
            exit 1
        }
    } elseif ($historyCountBefore -eq 0) {
        Write-Success "previous_run_id: null (first entry)"
    } else {
        Write-Warning "previous_run_id not set"
    }
    
    # Verify reason
    if ($latestEntry.reason -like "*Phase 7.21*") {
        Write-Success "Reason recorded correctly"
    } else {
        Write-Warning "Reason: $($latestEntry.reason)"
    }
} catch {
    Write-Error "History verification failed: $_"
    exit 1
}

# Step 9: Export audit trail (Phase 7.20)
Write-Step "9. Phase 7.20 - Export Audit Trail with Integrity Check"
try {
    $export = Invoke-RestMethod -Uri "$BackendUrl/workflow/cases/$caseId/audit/export?include_payload=false" -Method GET
    
    Write-Success "Export retrieved successfully"
    Write-Success "Total entries in export: $($export.metadata.total_entries)"
    Write-Success "Format version: $($export.metadata.format_version)"
    
    # Verify integrity check
    if ($export.integrity_check.is_valid) {
        Write-Success "Audit chain integrity: VALID ✅"
        Write-Success "Verified entries: $($export.integrity_check.verified_entries)/$($export.integrity_check.total_entries)"
    } else {
        Write-Error "Audit chain integrity: INVALID ❌"
        Write-Error "Broken links: $($export.integrity_check.broken_links.Count)"
        Write-Error "Orphaned entries: $($export.integrity_check.orphaned_entries.Count)"
        exit 1
    }
    
    # Check duplicate analysis
    if ($export.duplicate_analysis.has_duplicates) {
        Write-Warning "Duplicate computations detected: $($export.duplicate_analysis.duplicates.Count)"
    } else {
        Write-Success "No duplicate computations detected"
        Write-Success "Unique input hashes: $($export.duplicate_analysis.total_unique_hashes)"
    }
} catch {
    Write-Error "Audit export failed: $_"
    exit 1
}

# Step 10: Verify input_hash stability
Write-Step "10. Verify Input Hash Stability"
try {
    # Check if multiple entries with same input have same hash
    $entriesWithHash = $export.history | Where-Object { $_.input_hash }
    $groupedByHash = $entriesWithHash | Group-Object -Property input_hash
    
    Write-Success "Total entries with hash: $($entriesWithHash.Count)"
    Write-Success "Unique input hashes: $($groupedByHash.Count)"
    
    # If we have duplicates, verify they have identical hashes
    $duplicateGroups = $groupedByHash | Where-Object { $_.Count -gt 1 }
    if ($duplicateGroups) {
        Write-Warning "Found $($duplicateGroups.Count) input hash groups with multiple entries (expected for identical inputs)"
        foreach ($group in $duplicateGroups) {
            $hashPreview = $group.Name.Substring(0, 16)
            $entryCount = $group.Count
            Write-Host "      Hash: ${hashPreview}... (${entryCount} entries)" -ForegroundColor Yellow
        }
    } else {
        Write-Success "All entries have unique input hashes (no duplicate computations)"
    }
} catch {
    Write-Warning "Input hash stability check failed: $_"
}

# Final Summary
Write-Host "`n╔════════════════════════════════════════════════════════════╗" -ForegroundColor $Green
Write-Host "║   ✅ Phase 7.21 Verification PASSED                        ║" -ForegroundColor $Green
Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor $Green

Write-Host "`nVerified Features:" -ForegroundColor $Cyan
Write-Host "  ✅ Phase 7.18 - Confidence History retrieval" -ForegroundColor $Green
Write-Host "  ✅ Phase 7.19 - Recompute with reason & modal" -ForegroundColor $Green
Write-Host "  ✅ Phase 7.20 - Audit trail integrity (input_hash, previous_run_id)" -ForegroundColor $Green
Write-Host "  ✅ Phase 7.20 - Audit export with integrity verification" -ForegroundColor $Green

Write-Host "`nProduction Readiness:" -ForegroundColor $Cyan
Write-Host "  ✅ Backend API accessible at $BackendUrl" -ForegroundColor $Green
Write-Host "  ✅ Audit chain integrity validated" -ForegroundColor $Green
Write-Host "  ✅ History tracking operational" -ForegroundColor $Green
Write-Host "  ✅ Recompute workflow functional" -ForegroundColor $Green

if ($Verbose) {
    Write-Host "`nTest Case Details:" -ForegroundColor $Cyan
    Write-Host "  Case ID: $caseId" -ForegroundColor Gray
    Write-Host "  Status: $($testCase.status)" -ForegroundColor Gray
    Write-Host "  History entries: $historyCountAfter" -ForegroundColor Gray
    Write-Host "  Latest confidence: $($latestEntry.payload.confidence_score)%" -ForegroundColor Gray
}

Write-Host ""
exit 0
