$ErrorActionPreference = "Stop"

function Invoke-Step {
    param (
        [string]$Label,
        [scriptblock]$Action
    )
    Write-Host "`n==> $Label" -ForegroundColor Cyan
    & $Action
    if ($LASTEXITCODE -ne $null -and $LASTEXITCODE -ne 0) {
        Write-Host "Step failed with exit code $LASTEXITCODE" -ForegroundColor Red
        exit $LASTEXITCODE
    }
}

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $repoRoot

Invoke-Step "Backend targeted tests" {
    Set-Location (Join-Path $repoRoot "backend")
    & "C:/Python314/python.exe" -m pytest -q tests/test_explainability_contract.py tests/test_ops_smoke.py tests/test_golden_suite.py tests/test_kb_stats.py
}

Invoke-Step "Ops smoke" {
    Set-Location $repoRoot
    Invoke-RestMethod "http://127.0.0.1:8001/api/ops/smoke" | Out-Null
}

Invoke-Step "Golden suite" {
    Set-Location $repoRoot
    Invoke-RestMethod -Method Post "http://127.0.0.1:8001/api/ops/golden/run" | Out-Null
}

Invoke-Step "KB stats" {
    Set-Location $repoRoot
    $kb = Invoke-RestMethod "http://127.0.0.1:8001/api/ops/kb-stats"
    if ($env:ENV -eq "ci" -and $kb.knowledge_version -ne "kp-v1") {
        throw "CI pack mode not active (knowledge_version=$($kb.knowledge_version))"
    }
}

Invoke-Step "Frontend RAG smoke" {
    Set-Location (Join-Path $repoRoot "frontend")
    npm run rag:smoke
}

Write-Host "`nRC smoke complete" -ForegroundColor Green
exit 0
