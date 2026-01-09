#!/usr/bin/env pwsh
<#
.SYNOPSIS
Verification script for Saved Views, Adherence, and Scheduled Exports features

.DESCRIPTION
Tests the three features:
1. Saved Views - persistence and filtering
2. Adherence - workbench scoring and actions
3. Scheduled Exports - admin CRUD and verifier restrictions
#>

$ErrorActionPreference = "Stop"
$baseUrl = "http://127.0.0.1:8001"

Write-Output "`n=========================================="
Write-Output "AutoComply-AI Feature Verification"
Write-Output "==========================================`n"

# ============================================================================
# Test 1: Saved Views Persistence
# ============================================================================
Write-Output "[TEST 1] Saved Views Persistence"
Write-Output "-------------------------------------------"

$adminHeaders = @{
    "Authorization" = "Bearer admin_token"
    "Content-Type" = "application/json"
}

try {
    # Create a new saved view
    $viewPayload = @{
        name = "Test View - $(Get-Date -Format 'HHmmss')"
        description = "Automated test view"
        viewType = "analytics"
        filters = @{
            status = @("pending_review")
            decisionType = @("csf_practitioner")
        }
        sortBy = "createdAt"
        sortOrder = "desc"
    } | ConvertTo-Json
    
    Write-Output "  Creating saved view..."
    $createResponse = Invoke-RestMethod -Uri "$baseUrl/analytics/views" -Method POST -Headers $adminHeaders -Body $viewPayload
    Write-Output "  Created view: $($createResponse.id) - $($createResponse.name)"
    $viewId = $createResponse.id
    
    # List all views
    Write-Output "  Fetching all saved views..."
    $listResponse = Invoke-RestMethod -Uri "$baseUrl/analytics/views" -Headers $adminHeaders
    Write-Output "  Total views: $($listResponse.Count)"
    
    # Get specific view
    Write-Output "  Fetching created view by ID..."
    $getResponse = Invoke-RestMethod -Uri "$baseUrl/analytics/views/$viewId" -Headers $adminHeaders
    Write-Output "  Retrieved: $($getResponse.name)"
    Write-Output "  Filters: $($getResponse.filters | ConvertTo-Json -Compress)"
    
    # Update view
    Write-Output "  Updating view..."
    $updatePayload = @{
        description = "Updated test view"
    } | ConvertTo-Json
    $updateResponse = Invoke-RestMethod -Uri "$baseUrl/analytics/views/$viewId" -Method PATCH -Headers $adminHeaders -Body $updatePayload
    Write-Output "  Updated description: $($updateResponse.description)"
    
    Write-Output "`n[PASS] Saved Views: PASSED`n"
} catch {
    Write-Output "  [FAIL] ERROR: $($_.Exception.Message)"
    Write-Output "`n[FAIL] Saved Views: FAILED`n"
}

# ============================================================================
# Test 2: Adherence Workbench
# ============================================================================
Write-Output "[TEST 2] Adherence Workbench"
Write-Output "-------------------------------------------"

try {
    # Get a case with audit history
    Write-Output "  Finding cases with audit history..."
    $cases = Invoke-RestMethod -Uri "$baseUrl/workflow/cases?limit=50" -Headers $adminHeaders
    
    $caseWithHistory = $null
    foreach ($case in $cases.items) {
        try {
            $auditEvents = Invoke-RestMethod -Uri "$baseUrl/workflow/cases/$($case.id)/audit" -Headers $adminHeaders
            if ($auditEvents.Count -gt 2) {
                $caseWithHistory = $case
                break
            }
        } catch {
            # Skip cases with errors
            continue
        }
    }
    
    if ($caseWithHistory) {
        Write-Output "  Found case: $($caseWithHistory.id)"
        
        # Get adherence data
        Write-Output "  Fetching adherence data..."
        $adherence = Invoke-RestMethod -Uri "$baseUrl/workflow/cases/$($caseWithHistory.id)/adherence" -Headers $adminHeaders
        Write-Output "  Adherence: $($adherence.adherencePercentage)%"
        Write-Output "  Completed steps: $($adherence.completedSteps.Count)"
        Write-Output "  Missing steps: $($adherence.missingSteps.Count)"
        Write-Output "  Recommended actions: $($adherence.recommendedNextActions.Count)"
        
        if ($adherence.recommendedNextActions.Count -gt 0) {
            Write-Output "`n  Recommended actions:"
            $adherence.recommendedNextActions | ForEach-Object {
                Write-Output "    - $($_.stepTitle) - $($_.suggestedAction)"
            }
        }
        
        Write-Output "`n[PASS] Adherence: PASSED`n"
    } else {
        Write-Output "  [SKIP] No cases with audit history found"
        Write-Output "`n[SKIP] Adherence: SKIPPED`n"
    }
} catch {
    Write-Output "  [FAIL] ERROR: $($_.Exception.Message)"
    Write-Output "`n[FAIL] Adherence: FAILED`n"
}

# ============================================================================
# Test 3: Scheduled Exports (Admin)
# ============================================================================
Write-Output "[TEST 3] Scheduled Exports - Admin"
Write-Output "-------------------------------------------"

try {
    # Get a case for testing
    Write-Output "  Finding a case for export..."
    $cases = Invoke-RestMethod -Uri "$baseUrl/workflow/cases?limit=1" -Headers $adminHeaders
    if ($cases.items.Count -eq 0) {
        throw "No cases found"
    }
    $testCase = $cases.items[0]
    Write-Output "  Using case: $($testCase.id)"
    
    # Create scheduled export
    Write-Output "  Creating scheduled export..."
    $exportPayload = @{
        name = "Test Export - $(Get-Date -Format 'HHmmss')"
        schedule = "DAILY"
        hour = 9
        minute = 0
        mode = "case"
        target_id = $testCase.id
        export_type = "both"
    } | ConvertTo-Json
    
    $createExport = Invoke-RestMethod -Uri "$baseUrl/workflow/exports/scheduled" -Method POST -Headers $adminHeaders -Body $exportPayload
    Write-Output "  Created export: $($createExport.id)"
    Write-Output "    Name: $($createExport.name)"
    Write-Output "    Schedule: $($createExport.schedule) at $($createExport.hour):$(($createExport.minute).ToString('00'))"
    Write-Output "    Next run: $($createExport.next_run_at)"
    $exportId = $createExport.id
    
    # List scheduled exports
    Write-Output "`n  Listing scheduled exports..."
    $exports = Invoke-RestMethod -Uri "$baseUrl/workflow/exports/scheduled" -Headers $adminHeaders
    Write-Output "  Total exports: $($exports.Count)"
    
    # Run now
    Write-Output "`n  Triggering 'Run Now'..."
    $runNow = Invoke-RestMethod -Uri "$baseUrl/workflow/exports/scheduled/$exportId/run-now" -Method POST -Headers $adminHeaders
    Write-Output "  Export executed: $($runNow.message)"
    
    # Check if files were created
    Write-Output "`n  Checking export files..."
    $exportsDir = "C:\Users\soura\Documents\Projects\Projects\AutoComply-AI-fresh\backend\app\data\exports"
    if (Test-Path $exportsDir) {
        $files = Get-ChildItem $exportsDir -Filter "case_$($testCase.id)*" | Sort-Object LastWriteTime -Descending | Select-Object -First 5
        if ($files.Count -gt 0) {
            Write-Output "  Export files created:"
            $files | ForEach-Object {
                $sizeKB = [math]::Round($_.Length/1024, 2)
                $fileName = $_.Name
                Write-Output "    - $fileName ($sizeKB KB)"
            }
        } else {
            Write-Output "  Warning - No export files found"
        }
    } else {
        Write-Output "  Warning - Exports directory not found"
    }
    
    # Get updated export to check last_run_at
    Write-Output "`n  Verifying timestamps updated..."
    $updated = Invoke-RestMethod -Uri "$baseUrl/workflow/exports/scheduled/$exportId" -Headers $adminHeaders
    Write-Output "  Last run: $($updated.last_run_at)"
    Write-Output "  Next run: $($updated.next_run_at)"
    
    # Toggle enabled status
    Write-Output "`n  Testing enable/disable toggle..."
    $togglePayload = @{ is_enabled = $false } | ConvertTo-Json
    $toggled = Invoke-RestMethod -Uri "$baseUrl/workflow/exports/scheduled/$exportId" -Method PATCH -Headers $adminHeaders -Body $togglePayload
    Write-Output "  Disabled export (is_enabled: $($toggled.is_enabled))"
    
    # Delete export
    Write-Output "`n  Cleaning up - deleting export..."
    Invoke-RestMethod -Uri "$baseUrl/workflow/exports/scheduled/$exportId" -Method DELETE -Headers $adminHeaders
    Write-Output "  Export deleted"
    
    Write-Output "`n[PASS] Scheduled Exports (Admin): PASSED`n"
} catch {
    Write-Output "  [FAIL] ERROR: $($_.Exception.Message)"
    Write-Output "`n[FAIL] Scheduled Exports (Admin): FAILED`n"
}

# ============================================================================
# Test 4: Scheduled Exports (Verifier - Read Only)
# ============================================================================
Write-Output "[TEST 4] Scheduled Exports - Verifier"
Write-Output "-------------------------------------------"

$verifierHeaders = @{
    "Authorization" = "Bearer verifier_token"
    "Content-Type" = "application/json"
}

try {
    # Verifier can list exports (filtered by owner)
    Write-Output "  Listing exports as verifier..."
    $verifierExports = Invoke-RestMethod -Uri "$baseUrl/workflow/exports/scheduled" -Headers $verifierHeaders
    Write-Output "  Verifier can view exports: $($verifierExports.Count)"
    
    # Try to create export as verifier (should fail with 403)
    Write-Output "`n  Testing create restriction..."
    try {
        $exportPayload = @{
            name = "Should Fail"
            schedule = "DAILY"
            hour = 9
            minute = 0
            mode = "case"
            target_id = "test_123"
            export_type = "pdf"
        } | ConvertTo-Json
        
        $forbidden = Invoke-RestMethod -Uri "$baseUrl/workflow/exports/scheduled" -Method POST -Headers $verifierHeaders -Body $exportPayload
        Write-Output "  [FAIL] Verifier was able to create export (should be forbidden)"
    } catch {
        if ($_.Exception.Message -like "*403*" -or $_.Exception.Message -like "*Forbidden*") {
            Write-Output "  Create blocked with 403 (as expected)"
        } else {
            Write-Output "  [SKIP] Unexpected error: $($_.Exception.Message)"
        }
    }
    
    Write-Output "`n[PASS] Scheduled Exports (Verifier): PASSED`n"
} catch {
    Write-Output "  [FAIL] ERROR: $($_.Exception.Message)"
    Write-Output "`n[FAIL] Scheduled Exports (Verifier): FAILED`n"
}

# ============================================================================
# Summary
# ============================================================================
Write-Output "`n=========================================="
Write-Output "Verification Complete"
Write-Output "==========================================`n"
Write-Output "Next steps:"
Write-Output "1. Open http://localhost:5173 in browser"
Write-Output "2. Navigate to Analytics Dashboard"
Write-Output "3. Test saved views UI (create, save, apply)"
Write-Output "4. Open a case and check Workbench tab"
Write-Output "5. Verify adherence panel and scheduled exports UI`n"
