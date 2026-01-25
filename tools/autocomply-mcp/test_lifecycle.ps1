$url = "https://autocomply-mcp-control-plane.vercel.app/mcp"

Write-Host "`n════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host " TESTING ENHANCED MCP LIFECYCLE HANDLERS" -ForegroundColor Cyan
Write-Host "════════════════════════════════════════════════════════════`n" -ForegroundColor Cyan

# Test 1: initialize
Write-Host "Test 1: initialize" -ForegroundColor Yellow
$init = @{
  jsonrpc = "2.0"
  id = 1
  method = "initialize"
  params = @{}
} | ConvertTo-Json -Compress

try {
  $response = Invoke-RestMethod -Uri $url -Method POST -Body $init -ContentType "application/json"
  Write-Host "✅ SUCCESS" -ForegroundColor Green
  Write-Host "   Protocol: $($response.result.protocolVersion)" -ForegroundColor Gray
  Write-Host "   Server: $($response.result.serverInfo.name)" -ForegroundColor Gray
  Write-Host "   Description: $($response.result.serverInfo.description)" -ForegroundColor Gray
  Write-Host "   listChanged: $($response.result.capabilities.tools.listChanged)" -ForegroundColor Gray
} catch {
  Write-Host "❌ FAILED: $_" -ForegroundColor Red
}

# Test 2: ping
Write-Host "`nTest 2: ping" -ForegroundColor Yellow
$ping = @{
  jsonrpc = "2.0"
  id = 2
  method = "ping"
  params = @{}
} | ConvertTo-Json -Compress

try {
  $response = Invoke-RestMethod -Uri $url -Method POST -Body $ping -ContentType "application/json"
  Write-Host "✅ SUCCESS" -ForegroundColor Green
} catch {
  Write-Host "❌ FAILED: $_" -ForegroundColor Red
}

# Test 3: tools/list
Write-Host "`nTest 3: tools/list" -ForegroundColor Yellow
$tools = @{
  jsonrpc = "2.0"
  id = 3
  method = "tools/list"
  params = @{}
} | ConvertTo-Json -Compress

try {
  $response = Invoke-RestMethod -Uri $url -Method POST -Body $tools -ContentType "application/json"
  Write-Host "✅ SUCCESS - $($response.result.tools.Count) tools available:" -ForegroundColor Green
  $response.result.tools | ForEach-Object {
    Write-Host "   • $($_.name)" -ForegroundColor Gray
  }
} catch {
  Write-Host "❌ FAILED: $_" -ForegroundColor Red
}

Write-Host "`n════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host " CHATGPT INTEGRATION READY" -ForegroundColor Cyan
Write-Host "════════════════════════════════════════════════════════════`n" -ForegroundColor Cyan

Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host "1. Go to ChatGPT → Settings → GPTs & Custom Actions" -ForegroundColor White
Write-Host "2. Delete old 'AutoComply Control Plane' app" -ForegroundColor White
Write-Host "3. Create NEW app with URL:" -ForegroundColor White
Write-Host "   https://autocomply-mcp-control-plane.vercel.app/mcp" -ForegroundColor Cyan
Write-Host "4. Click Connect and verify tools appear`n" -ForegroundColor White
