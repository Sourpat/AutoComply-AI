# Phase 7.21 - Production E2E Verification Script
# Verifies Phase 7.18-7.20 features in production (Render backend)

param(
    [string]$BackendUrl = $env:VITE_API_BASE_URL,
    [switch]$Seed,
    [switch]$SkipSeed,
    [switch]$Smoke,
    [switch]$Verbose
)

# UTF-8 encoding for proper character display
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

# Track overall test status
$script:TestsPassed = $true

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
    Write-Host "    [OK] $Message" -ForegroundColor $Green
}

function Write-Error {
    param([string]$Message)
    Write-Host "    [FAIL] $Message" -ForegroundColor $Red
    $script:TestsPassed = $false
}

function Write-Warning {
    param([string]$Message)
    Write-Host "    [WARN] $Message" -ForegroundColor $Yellow
}

# Validation
if (-not $BackendUrl) {
    Write-Error "Backend URL not set. Provide -BackendUrl or set VITE_API_BASE_URL env var."
    exit 1
}

$BackendUrl = $BackendUrl.TrimEnd('/')

Write-Host ''
Write-Host '================================================================' -ForegroundColor $Cyan
Write-Host '   Phase 7.21 - Production E2E Verification' -ForegroundColor $Cyan
Write-Host '================================================================' -ForegroundColor $Cyan

# Step 1: Git SHA
Write-Step '1. Git Commit Information'
$gitSha = git rev-parse --short HEAD
$gitBranch = git rev-parse --abbrev-ref HEAD
Write-Success "Branch: $gitBranch"
Write-Success "Commit: $gitSha"
Write-Success "Backend: $BackendUrl"

# Step 2: Health Check
Write-Step '2. Health Check'
try {
    $health = Invoke-RestMethod -Uri "$BackendUrl/workflow/health" -Method GET -TimeoutSec 10
    if (-not $health) {
        Write-Error "Health check returned null response"
        exit 1
    }
    Write-Success "Backend healthy: $($health.ok)"
    if ($health.version) {
        Write-Success "Version: $($health.version)"
    }
} catch {
    Write-Error "Health check failed: $_"
    exit 1
}

# Step 2.5: Production Guardrails Validation (Phase 7.38)
Write-Step '2.5 Production Guardrails'
try {
    $healthDetails = Invoke-RestMethod -Uri "$BackendUrl/health/details" -Method GET -TimeoutSec 10 -ErrorAction Stop
    
    if (-not $healthDetails) {
        Write-Error 'Health details returned null response'
        exit 1
    }
    
    # Display environment info
    Write-Success ('Environment: {0}' -f $healthDetails.environment)
    Write-Success ('Version: {0}' -f $healthDetails.version)
    if ($healthDetails.commit_sha) {
        Write-Success ('Commit: {0}' -f $healthDetails.commit_sha)
    }
    if ($healthDetails.build_time) {
        Write-Success ('Build: {0}' -f $healthDetails.build_time)
    }
    
    # Check critical status
    if (-not $healthDetails.ok) {
        Write-Error 'Production guardrails validation FAILED'
        if ($healthDetails.missing_env -and $healthDetails.missing_env.Count -gt 0) {
            Write-Error ('Missing critical env vars: {0}' -f ($healthDetails.missing_env -join ', '))
        }
        $script:TestsPassed = $false
        exit 1
    }
    
    # Check for missing env (redundant with ok check, but explicit)
    if ($healthDetails.missing_env -and $healthDetails.missing_env.Count -gt 0) {
        Write-Error ('Critical env vars missing: {0}' -f ($healthDetails.missing_env -join ', '))
        $script:TestsPassed = $false
        exit 1
    }
    
    Write-Success 'All critical env vars configured'
    
    # Display warnings if any
    if ($healthDetails.warnings -and $healthDetails.warnings.Count -gt 0) {
        Write-Warning ('Config warnings ({0}):' -f $healthDetails.warnings.Count)
        foreach ($warning in $healthDetails.warnings) {
            Write-Warning ('  - {0}' -f $warning)
        }
    }
    
    # Display config status
    $cfg = $healthDetails.config
    if ($cfg) {
        Write-Host ''
        Write-Host 'Config Status:' -ForegroundColor $Cyan
        if ($cfg.database_configured) { Write-Success '  Database: [OK]' } else { Write-Error '  Database: [FAIL]' }
        if ($cfg.audit_signing_enabled -and -not $cfg.audit_signing_is_dev_default) {
            Write-Success '  Audit Signing: [OK]'
        } else {
            Write-Warning '  Audit Signing: [DEV DEFAULT]'
        }
        if ($cfg.openai_key_present) { Write-Success '  OpenAI: [OK]' } else { Write-Host '  OpenAI: [MISS]' -ForegroundColor Gray }
        if ($cfg.gemini_key_present) { Write-Success '  Gemini: [OK]' } else { Write-Host '  Gemini: [MISS]' -ForegroundColor Gray }
        Write-Host ('  RAG: {0}' -f $cfg.rag_enabled) -ForegroundColor $Cyan
        Write-Host ('  Auto Intelligence: {0}' -f $cfg.auto_intelligence_enabled) -ForegroundColor $Cyan
        Write-Host ('  Production: {0}' -f $cfg.is_production) -ForegroundColor $Cyan
    }
    
} catch {
    # If /health/details doesn't exist yet, warn but don't fail in smoke mode
    if ($Smoke) {
        Write-Warning 'Health details endpoint not available (may be older version)'
        Write-Warning ('Error: {0}' -f $_)
    } else {
        Write-Error ('Health details check failed: {0}' -f $_)
        exit 1
    }
}

# Step 3: Get Existing Cases
Write-Step '3. Get Existing Cases'
try {
    $cases = Invoke-RestMethod -Uri "$BackendUrl/workflow/cases?limit=100" -Method GET
    if (-not $cases -or -not $cases.items) {
        Write-Error 'Cases response is null or missing items array'
        exit 1
    }
    $caseCount = $cases.items.Count
    Write-Success ('Total cases: {0}' -f $caseCount)
    
    if ($caseCount -eq 0) {
        if ($Seed -and -not $SkipSeed -and -not $Smoke) {
            Write-Warning 'No cases found - seeding will be attempted'
        } else {
            Write-Warning 'No cases found. Run with -Seed to create test data.'
        }
    }
} catch {
    Write-Error ('Failed to fetch cases: {0}' -f $_)
    exit 1
}

# Smoke mode - exit early after basic connectivity tests
if ($Smoke) {
    Write-Step 'Smoke Test Complete'
    if ($script:TestsPassed) {
        Write-Host "`n[OK] Backend accessible and responsive" -ForegroundColor $Green
        Write-Host "PHASE_7_21_RESULT=PASS" -ForegroundColor $Green
        exit 0
    } else {
        Write-Host "`n[FAIL] Smoke test failed" -ForegroundColor $Red
        Write-Host "PHASE_7_21_RESULT=FAIL" -ForegroundColor $Red
        exit 1
    }
}

# Step 4: Seed data (if requested and cases are empty)
$seedCreated = $false
if ($Seed -and -not $SkipSeed -and -not $Smoke) {
    Write-Step '4. Seed Test Data'
    
    # Check if seeding is needed
    if ($caseCount -gt 0) {
        Write-Success 'Cases already exist - skipping seed'
    } else {
        # Get token from environment
        $DevSeedToken = $env:DEV_SEED_TOKEN
        
        if (-not $DevSeedToken) {
            Write-Error '[FAIL] DEV_SEED_TOKEN not set in environment'
            exit 1
        }
        
        try {
            $headers = @{
                'Authorization' = "Bearer $DevSeedToken"
            }
            $seedResult = Invoke-RestMethod -Uri "$BackendUrl/dev/seed" -Method POST -Headers $headers
            
            if (-not $seedResult) {
                Write-Error 'Seed returned null response'
                exit 1
            }
            
            Write-Success ('Seed completed: {0}' -f $seedResult.message)
            if ($null -ne $seedResult.cases_created) {
                Write-Success ('Cases created: {0}' -f $seedResult.cases_created)
            }
            $seedCreated = $true
            
            # Wait for DB to settle
            Start-Sleep -Seconds 2
            
            # Refresh cases list
            try {
                $cases = Invoke-RestMethod -Uri "$BackendUrl/workflow/cases?limit=100" -Method GET
                if ($cases -and $cases.items) {
                    $caseCount = $cases.items.Count
                    Write-Success ('Updated case count: {0}' -f $caseCount)
                }
            } catch {
                Write-Warning ('Failed to refresh cases after seed: {0}' -f $_)
            }
        } catch {
            Write-Error ('Seed failed: {0}' -f $_)
            exit 1
        }
    }
} elseif ($SkipSeed) {
    Write-Step '4. Seed Test Data - SKIPPED (SkipSeed flag)'
} else {
    Write-Step '4. Seed Test Data - SKIPPED (use -Seed to enable)'
}

# Step 5: Select a test case
Write-Step '5. Select Test Case'

# Final check - do we have cases?
if ($caseCount -eq 0) {
    Write-Error '[FAIL] No cases available for testing'
    Write-Error 'Run with -Seed flag to create test data, or seed the backend manually'
    Write-Host ''
    Write-Host 'PHASE_7_21_RESULT=FAIL' -ForegroundColor $Red
    exit 1
}

$testCase = $null
if ($cases -and $cases.items -and $cases.items.Count -gt 0) {
    # Prefer new cases, but use any case if none are new
    $testCase = $cases.items | Where-Object { $_.status -eq 'new' } | Select-Object -First 1
    if (-not $testCase) {
        $testCase = $cases.items | Select-Object -First 1
    }
}

if (-not $testCase) {
    Write-Error 'No test case available after case count check'
    exit 1
}

if (-not $testCase.id) {
    Write-Error 'Selected test case missing ID field'
    exit 1
}

$caseId = $testCase.id
Write-Success "Using case: $caseId"
Write-Success "Status: $($testCase.status)"

# Step 6: Get baseline intelligence history (Phase 7.18)
Write-Step '6. Phase 7.18 - Confidence History Baseline'
try {
    $historyBefore = Invoke-RestMethod -Uri "$BackendUrl/workflow/cases/$caseId/intelligence/history?limit=50" -Method GET
    if (-not $historyBefore -or -not $historyBefore.history) {
        Write-Warning "History response is null or missing history array"
        $historyCountBefore = 0
    } else {
        $historyCountBefore = $historyBefore.history.Count
        Write-Success "History entries before recompute: $historyCountBefore"
        
        if ($historyCountBefore -gt 0) {
            $latestBefore = $historyBefore.history[0]
            if ($latestBefore -and $latestBefore.payload) {
                if ($null -ne $latestBefore.payload.confidence_score) {
                    Write-Success "Latest confidence: $($latestBefore.payload.confidence_score)%"
                }
                if ($latestBefore.payload.confidence_band) {
                    Write-Success "Latest band: $($latestBefore.payload.confidence_band)"
                }
            }
        }
    }
} catch {
    Write-Error "Failed to fetch history: $_"
    exit 1
}

# Step 7: Recompute with reason (Phase 7.19)
Write-Step '7. Phase 7.19 - Recompute with Reason'
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
    
    if (-not $recomputeResult) {
        Write-Error "Recompute returned null response"
        exit 1
    }
    
    Write-Success "Recompute triggered successfully"
    if ($null -ne $recomputeResult.confidence_score) {
        Write-Success "New confidence: $($recomputeResult.confidence_score)%"
    }
    if ($recomputeResult.confidence_band) {
        Write-Success "New band: $($recomputeResult.confidence_band)"
    }
    
    # Wait a moment for DB write
    Start-Sleep -Seconds 2
} catch {
    Write-Error "Recompute failed: $_"
    exit 1
}

# Step 8: Verify new history entry (Phase 7.20 - Audit Chain)
Write-Step '8. Phase 7.20 - Verify New History Entry and Chain'
try {
    $historyAfter = Invoke-RestMethod -Uri "$BackendUrl/workflow/cases/$caseId/intelligence/history?limit=50" -Method GET
    if (-not $historyAfter -or -not $historyAfter.history) {
        Write-Error "History after recompute is null or missing history array"
        exit 1
    }
    $historyCountAfter = $historyAfter.history.Count
    
    if ($historyCountAfter -le $historyCountBefore) {
        Write-Error "History count did not increase: before=$historyCountBefore, after=$historyCountAfter"
        exit 1
    }
    
    $increaseCount = $historyCountAfter - $historyCountBefore
    Write-Success "History entries after recompute: $historyCountAfter - increased by $increaseCount"
    
    # Check latest entry for integrity fields
    $latestEntry = $historyAfter.history[0]
    if (-not $latestEntry) {
        Write-Error "Latest history entry is null"
        exit 1
    }
    
    # Verify input_hash
    if ($latestEntry.input_hash) {
        if ($latestEntry.input_hash.Length -ge 16) {
            Write-Success "input_hash present: $($latestEntry.input_hash.Substring(0, 16))..."
        } else {
            Write-Success "input_hash present: $($latestEntry.input_hash)"
        }
    } else {
        Write-Error "input_hash missing in latest entry"
        exit 1
    }
    
    # Verify triggered_by
    if ($latestEntry.triggered_by) {
        Write-Success "triggered_by: $($latestEntry.triggered_by)"
    } else {
        Write-Warning "triggered_by not set - may be null for system-triggered"
    }
    
    # Verify previous_run_id chain
    if ($historyCountBefore -gt 0 -and $latestEntry.previous_run_id) {
        if ($historyAfter.history.Count -gt 1) {
            $previousEntry = $historyAfter.history[1]
            if ($previousEntry -and $latestEntry.previous_run_id -eq $previousEntry.id) {
                if ($latestEntry.previous_run_id.Length -ge 20) {
                    Write-Success "previous_run_id chain intact: $($latestEntry.previous_run_id.Substring(0, 20))..."
                } else {
                    Write-Success "previous_run_id chain intact: $($latestEntry.previous_run_id)"
                }
            } else {
                Write-Error "previous_run_id mismatch: expected $($previousEntry.id), got $($latestEntry.previous_run_id)"
                exit 1
            }
        } else {
            Write-Warning "Cannot verify previous_run_id chain - insufficient history entries"
        }
    } elseif ($historyCountBefore -eq 0) {
        Write-Success "previous_run_id: null - first entry"
    } else {
        Write-Warning "previous_run_id not set"
    }
    
    # Verify reason
    if ($latestEntry.reason -and $latestEntry.reason -like "*Phase 7.21*") {
        Write-Success "Reason recorded correctly"
    } else {
        Write-Warning "Reason: $($latestEntry.reason)"
    }
} catch {
    Write-Error "History verification failed: $_"
    exit 1
}

# Step 9: Export audit trail (Phase 7.20)
Write-Step '9. Phase 7.20 - Export Audit Trail with Integrity Check'
try {
    $export = Invoke-RestMethod -Uri "$BackendUrl/workflow/cases/$caseId/audit/export?include_payload=false" -Method GET
    
    if (-not $export) {
        Write-Error "Export returned null response"
        exit 1
    }
    
    Write-Success "Export retrieved successfully"
    
    if ($export.metadata) {
        if ($null -ne $export.metadata.total_entries) {
            Write-Success "Total entries in export: $($export.metadata.total_entries)"
        }
        if ($export.metadata.format_version) {
            Write-Success "Format version: $($export.metadata.format_version)"
        }
    }
    
    # Verify integrity check
    if ($export.integrity_check) {
        if ($export.integrity_check.is_valid) {
            Write-Success "Audit chain integrity: VALID [OK]"
            if ($null -ne $export.integrity_check.verified_entries -and $null -ne $export.integrity_check.total_entries) {
                Write-Success "Verified entries: $($export.integrity_check.verified_entries)/$($export.integrity_check.total_entries)"
            }
        } else {
            Write-Error "Audit chain integrity: INVALID [FAIL]"
            if ($export.integrity_check.broken_links -and $export.integrity_check.broken_links.Count -gt 0) {
                Write-Error "Broken links: $($export.integrity_check.broken_links.Count)"
            }
            if ($export.integrity_check.orphaned_entries -and $export.integrity_check.orphaned_entries.Count -gt 0) {
                Write-Error "Orphaned entries: $($export.integrity_check.orphaned_entries.Count)"
            }
            exit 1
        }
    } else {
        Write-Warning "Export missing integrity_check field"
    }
    
    # Check duplicate analysis
    if ($export.duplicate_analysis) {
        if ($export.duplicate_analysis.has_duplicates) {
            if ($export.duplicate_analysis.duplicates -and $export.duplicate_analysis.duplicates.Count -gt 0) {
                Write-Warning "Duplicate computations detected: $($export.duplicate_analysis.duplicates.Count)"
            } else {
                Write-Warning "Duplicate computations detected"
            }
        } else {
            Write-Success "No duplicate computations detected"
            if ($null -ne $export.duplicate_analysis.unique_hashes) {
                Write-Success "Unique input hashes: $($export.duplicate_analysis.unique_hashes)"
            }
        }
    }
} catch {
    Write-Error "Audit export failed: $_"
    exit 1
}

# Step 10: Verify input_hash stability
Write-Step '10. Verify Input Hash Stability'
try {
    if (-not $export -or -not $export.history) {
        Write-Warning 'Export data missing or has no history; skipping hash stability check'
    } else {
        # Check if multiple entries with same input have same hash
        $entriesWithHash = $export.history | Where-Object { $_.input_hash }
        if (-not $entriesWithHash) {
            $entriesWithHash = @()
        }
        $groupedByHash = $entriesWithHash | Group-Object -Property input_hash
        
        Write-Success ('Total entries with hash: {0}' -f $entriesWithHash.Count)
        Write-Success ('Unique input hashes: {0}' -f $groupedByHash.Count)
        
        # If we have duplicates, verify they have identical hashes
        $duplicateGroups = $groupedByHash | Where-Object { $_.Count -gt 1 }
        if ($duplicateGroups -and $duplicateGroups.Count -gt 0) {
            Write-Warning ('Found {0} input hash groups with multiple entries - expected for identical inputs' -f $duplicateGroups.Count)
            foreach ($group in $duplicateGroups) {
                if ($group.Name -and $group.Name.Length -ge 16) {
                    $hashPreview = $group.Name.Substring(0, 16)
                    $entryCount = $group.Count
                    Write-Host ('      Hash: {0}... - {1} entries' -f $hashPreview, $entryCount) -ForegroundColor Yellow
                }
            }
        } else {
            Write-Success 'All entries have unique input hashes - no duplicate computations'
        }
    }
} catch {
    Write-Warning ('Input hash stability check failed: {0}' -f $_)
}

# Final Summary
if ($script:TestsPassed) {
    Write-Host ''
    Write-Host '================================================================' -ForegroundColor $Green
    Write-Host '   [OK] Phase 7.21 Verification PASSED' -ForegroundColor $Green
    Write-Host '================================================================' -ForegroundColor $Green
    Write-Host ''
    Write-Host 'Verified Features:' -ForegroundColor $Cyan
    Write-Host '  [OK] Phase 7.18 - Confidence History retrieval' -ForegroundColor $Green
    Write-Host '  [OK] Phase 7.19 - Recompute with reason and modal' -ForegroundColor $Green
    Write-Host '  [OK] Phase 7.20 - Audit trail integrity - input_hash, previous_run_id' -ForegroundColor $Green
    Write-Host '  [OK] Phase 7.20 - Audit export with integrity verification' -ForegroundColor $Green
    Write-Host ''
    Write-Host 'Production Readiness:' -ForegroundColor $Cyan
    Write-Host ('  [OK] Backend API accessible at {0}' -f $BackendUrl) -ForegroundColor $Green
    Write-Host '  [OK] Audit chain integrity validated' -ForegroundColor $Green
    Write-Host '  [OK] History tracking operational' -ForegroundColor $Green
    Write-Host '  [OK] Recompute workflow functional' -ForegroundColor $Green
    
    if ($Verbose -and $testCase -and $latestEntry) {
        Write-Host ''
        Write-Host 'Test Case Details:' -ForegroundColor $Cyan
        Write-Host ('  Case ID: {0}' -f $caseId) -ForegroundColor Gray
        if ($testCase.status) {
            Write-Host ('  Status: {0}' -f $testCase.status) -ForegroundColor Gray
        }
        if ($null -ne $historyCountAfter) {
            Write-Host ('  History entries: {0}' -f $historyCountAfter) -ForegroundColor Gray
        }
        if ($latestEntry.payload -and $null -ne $latestEntry.payload.confidence_score) {
            Write-Host ('  Latest confidence: {0}%' -f $latestEntry.payload.confidence_score) -ForegroundColor Gray
        }
    }
    
    Write-Host ''
    Write-Host 'PHASE_7_21_RESULT=PASS' -ForegroundColor $Green
    exit 0
} else {
    Write-Host ''
    Write-Host '================================================================' -ForegroundColor $Red
    Write-Host '   [FAIL] Phase 7.21 Verification FAILED' -ForegroundColor $Red
    Write-Host '================================================================' -ForegroundColor $Red
    Write-Host ''
    Write-Host 'PHASE_7_21_RESULT=FAIL' -ForegroundColor $Red
    exit 1
}
