# Quick Verification Script for Submission Tab removeChild Fix
# Run this after starting dev server

Write-Host "=== Submission Tab removeChild Fix - Verification Script ===" -ForegroundColor Cyan
Write-Host ""

# Check if dev server is running
Write-Host "[1/5] Checking if dev server is running..." -ForegroundColor Yellow
$devServerRunning = $false
try {
    $response = Invoke-WebRequest -Uri "http://localhost:5173" -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop
    if ($response.StatusCode -eq 200) {
        $devServerRunning = $true
        Write-Host "  ✅ Dev server is running on http://localhost:5173" -ForegroundColor Green
    }
} catch {
    Write-Host "  ❌ Dev server is NOT running" -ForegroundColor Red
    Write-Host "     Please run: cd frontend; npm run dev" -ForegroundColor Gray
}

Write-Host ""

# Check TypeScript compilation
Write-Host "[2/5] Checking TypeScript compilation..." -ForegroundColor Yellow
Push-Location "frontend"
try {
    $tscOutput = npx tsc --noEmit 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  ✅ TypeScript compilation passed (no errors)" -ForegroundColor Green
    } else {
        Write-Host "  ❌ TypeScript compilation failed:" -ForegroundColor Red
        Write-Host $tscOutput -ForegroundColor Gray
    }
} catch {
    Write-Host "  ⚠️  Could not run TypeScript check: $_" -ForegroundColor Yellow
} finally {
    Pop-Location
}

Write-Host ""

# Verify modified files exist
Write-Host "[3/5] Verifying modified files..." -ForegroundColor Yellow
$filesToCheck = @(
    "frontend\src\features\cases\CaseDetailsPanel.tsx",
    "frontend\src\utils\exportPacket.ts",
    "frontend\src\utils\clipboard.ts",
    "frontend\src\components\ErrorBoundary.tsx"
)

$allFilesExist = $true
foreach ($file in $filesToCheck) {
    if (Test-Path $file) {
        Write-Host "  ✅ $file" -ForegroundColor Green
    } else {
        Write-Host "  ❌ $file - NOT FOUND" -ForegroundColor Red
        $allFilesExist = $false
    }
}

Write-Host ""

# Check for removeChild pattern fixes
Write-Host "[4/5] Checking for safe removeChild patterns..." -ForegroundColor Yellow
$filesWithPatterns = 0

# Check CaseDetailsPanel.tsx
$caseDetailContent = Get-Content "frontend\src\features\cases\CaseDetailsPanel.tsx" -Raw
if ($caseDetailContent -match "setTimeout\(\(\) => \{[^}]*removeChild" -and $caseDetailContent -match "ErrorBoundary") {
    Write-Host "  ✅ CaseDetailsPanel.tsx has safe removeChild + ErrorBoundary" -ForegroundColor Green
    $filesWithPatterns++
} else {
    Write-Host "  ❌ CaseDetailsPanel.tsx missing safe pattern" -ForegroundColor Red
}

# Check exportPacket.ts
$exportPacketContent = Get-Content "frontend\src\utils\exportPacket.ts" -Raw
if ($exportPacketContent -match "setTimeout\(\(\) => \{[^}]*removeChild") {
    Write-Host "  ✅ exportPacket.ts has safe removeChild pattern" -ForegroundColor Green
    $filesWithPatterns++
} else {
    Write-Host "  ❌ exportPacket.ts missing safe pattern" -ForegroundColor Red
}

# Check clipboard.ts
$clipboardContent = Get-Content "frontend\src\utils\clipboard.ts" -Raw
if ($clipboardContent -match "setTimeout\(\(\) => \{[^}]*removeChild") {
    Write-Host "  ✅ clipboard.ts has safe removeChild pattern" -ForegroundColor Green
    $filesWithPatterns++
} else {
    Write-Host "  ❌ clipboard.ts missing safe pattern" -ForegroundColor Red
}

Write-Host ""

# Summary
Write-Host "[5/5] Summary" -ForegroundColor Yellow
Write-Host ""

if ($devServerRunning -and $allFilesExist -and $filesWithPatterns -eq 3) {
    Write-Host "✅ ALL CHECKS PASSED!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next Steps:" -ForegroundColor Cyan
    Write-Host "  1. Open http://localhost:5173/console in browser" -ForegroundColor White
    Write-Host "  2. Click any case to open details" -ForegroundColor White
    Write-Host "  3. Switch to 'Submission' tab" -ForegroundColor White
    Write-Host "  4. Rapidly switch between tabs (Summary → Submission → Playbook)" -ForegroundColor White
    Write-Host "  5. Check browser DevTools console for errors" -ForegroundColor White
    Write-Host "  6. Expected: No 'removeChild' errors" -ForegroundColor White
    Write-Host ""
} else {
    Write-Host "⚠️  SOME CHECKS FAILED" -ForegroundColor Yellow
    Write-Host ""
    if (-not $devServerRunning) {
        Write-Host "  → Start dev server: cd frontend; npm run dev" -ForegroundColor Gray
    }
    if (-not $allFilesExist) {
        Write-Host "  → Some files are missing. Check git status." -ForegroundColor Gray
    }
    if ($filesWithPatterns -lt 3) {
        Write-Host "  → Some files don't have the safe removeChild pattern." -ForegroundColor Gray
    }
}

Write-Host ""
Write-Host "=== Manual Testing Checklist ===" -ForegroundColor Cyan
Write-Host "[ ] 1. Submission tab loads without errors" -ForegroundColor White
Write-Host "[ ] 2. Rapid tab switching doesn't crash UI" -ForegroundColor White
Write-Host "[ ] 3. Export buttons work (admin only)" -ForegroundColor White
Write-Host "[ ] 4. No 'removeChild' errors in DevTools" -ForegroundColor White
Write-Host "[ ] 5. ErrorBoundary fallback appears if tab crashes" -ForegroundColor White
Write-Host ""

Write-Host "Documentation: SUBMISSION_TAB_CRASH_FIX.md" -ForegroundColor Gray
