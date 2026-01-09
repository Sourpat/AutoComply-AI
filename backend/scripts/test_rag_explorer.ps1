$ErrorActionPreference = "Stop"
$base = "http://127.0.0.1:8001"

$passCount = 0
$failCount = 0

Write-Host "=== Regulatory RAG Explorer Test Suite ===" -ForegroundColor Cyan
Write-Host "Backend: $base`n"

# Test 1: Health Check
Write-Host "[1/3] Health Check: GET /health" -ForegroundColor Yellow
try {
  $health = Invoke-WebRequest "$base/health" -UseBasicParsing
  Write-Host "✅ PASS: Health endpoint responded" -ForegroundColor Green
  $passCount++
} catch {
  Write-Host "❌ FAIL: Health check failed" -ForegroundColor Red
  Write-Host "Error: $_"
  $failCount++
}

# Test 2: Regulatory Preview
Write-Host "`n[2/3] Regulatory Preview: POST /rag/regulatory/preview" -ForegroundColor Yellow
$previewPayload = @{
  decision_type = "csf_practitioner"
  jurisdiction = "DEA"
} | ConvertTo-Json

try {
  $preview = Invoke-RestMethod "$base/rag/regulatory/preview" -Method Post -ContentType "application/json" -Body $previewPayload
  $itemCount = $preview.items.Count
  Write-Host "✅ PASS: Preview returned $itemCount regulatory items" -ForegroundColor Green
  if ($itemCount -gt 0) {
    Write-Host "   Sample: $($preview.items[0].label)" -ForegroundColor Gray
  }
  $passCount++
} catch {
  Write-Host "❌ FAIL: Regulatory preview failed" -ForegroundColor Red
  Write-Host "Error: $_"
  $failCount++
}

# Test 3: Regulatory Search
Write-Host "`n[3/3] Regulatory Search: POST /rag/regulatory/search" -ForegroundColor Yellow
$searchPayload = @{
  query = "CSF practitioner attestation DEA requirements"
  limit = 5
} | ConvertTo-Json

try {
  $search = Invoke-RestMethod "$base/rag/regulatory/search" -Method Post -ContentType "application/json" -Body $searchPayload
  $resultCount = $search.results.Count
  Write-Host "✅ PASS: Search returned $resultCount results" -ForegroundColor Green
  if ($resultCount -gt 0) {
    Write-Host "   Top result: $($search.results[0].title)" -ForegroundColor Gray
    Write-Host "   Snippet: $($search.results[0].snippet.Substring(0, [Math]::Min(80, $search.results[0].snippet.Length)))..." -ForegroundColor Gray
  }
  $passCount++
} catch {
  Write-Host "❌ FAIL: Regulatory search failed" -ForegroundColor Red
  Write-Host "Error: $_"
  $failCount++
}

# Summary
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "Test Results: $passCount PASS, $failCount FAIL" -ForegroundColor $(if ($failCount -eq 0) { "Green" } else { "Red" })
Write-Host "========================================" -ForegroundColor Cyan

if ($failCount -gt 0) {
  exit 1
}

Write-Host "`n✅ All tests passed!" -ForegroundColor Green
exit 0
