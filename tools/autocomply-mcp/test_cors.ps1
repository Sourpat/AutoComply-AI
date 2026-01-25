$url = "https://autocomply-mcp-control-plane.vercel.app/mcp"

Write-Host "`n════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host " TESTING CORS HEADERS FOR CHATGPT INTEGRATION" -ForegroundColor Cyan
Write-Host "════════════════════════════════════════════════════════════`n" -ForegroundColor Cyan

# Test 1: OPTIONS (CORS Preflight)
Write-Host "Test 1: OPTIONS (CORS Preflight)" -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Method OPTIONS -Uri $url -Headers @{
        Origin = "https://chatgpt.com"
        "Access-Control-Request-Method" = "POST"
        "Access-Control-Request-Headers" = "content-type,authorization"
    }
    
    Write-Host "✅ STATUS: $($response.StatusCode)" -ForegroundColor Green
    
    $allowOrigin = $response.Headers['Access-Control-Allow-Origin']
    $allowMethods = $response.Headers['Access-Control-Allow-Methods']
    $allowHeaders = $response.Headers['Access-Control-Allow-Headers']
    $maxAge = $response.Headers['Access-Control-Max-Age']
    
    Write-Host "   Access-Control-Allow-Origin: $allowOrigin" -ForegroundColor Gray
    Write-Host "   Access-Control-Allow-Methods: $allowMethods" -ForegroundColor Gray
    Write-Host "   Access-Control-Allow-Headers: $allowHeaders" -ForegroundColor Gray
    Write-Host "   Access-Control-Max-Age: $maxAge" -ForegroundColor Gray
    
    if ($allowOrigin -eq 'https://chatgpt.com') {
        Write-Host "   ✅ CORS Origin matches ChatGPT" -ForegroundColor Green
    } else {
        Write-Host "   ❌ CORS Origin incorrect: $allowOrigin" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ FAILED: $_" -ForegroundColor Red
}

# Test 2: tools/list with Origin header
Write-Host "`nTest 2: POST tools/list with Origin header" -ForegroundColor Yellow
$body = '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'

try {
    $response = Invoke-WebRequest -Method POST -Uri $url -ContentType "application/json" -Body $body -Headers @{
        Origin = "https://chatgpt.com"
    }
    
    Write-Host "✅ STATUS: $($response.StatusCode)" -ForegroundColor Green
    
    $allowOrigin = $response.Headers['Access-Control-Allow-Origin']
    Write-Host "   Access-Control-Allow-Origin: $allowOrigin" -ForegroundColor Gray
    
    if ($allowOrigin -eq 'https://chatgpt.com') {
        Write-Host "   ✅ CORS Origin matches ChatGPT" -ForegroundColor Green
    } else {
        Write-Host "   ❌ CORS Origin incorrect: $allowOrigin" -ForegroundColor Red
    }
    
    # Parse response to count tools
    $data = $response.Content | ConvertFrom-Json
    $toolCount = $data.result.tools.Count
    Write-Host "   Tools returned: $toolCount" -ForegroundColor Gray
    
} catch {
    Write-Host "❌ FAILED: $_" -ForegroundColor Red
}

# Test 3: initialize with Origin header
Write-Host "`nTest 3: POST initialize with Origin header" -ForegroundColor Yellow
$body = '{"jsonrpc":"2.0","id":2,"method":"initialize","params":{}}'

try {
    $response = Invoke-WebRequest -Method POST -Uri $url -ContentType "application/json" -Body $body -Headers @{
        Origin = "https://chatgpt.com"
    }
    
    Write-Host "✅ STATUS: $($response.StatusCode)" -ForegroundColor Green
    
    $allowOrigin = $response.Headers['Access-Control-Allow-Origin']
    Write-Host "   Access-Control-Allow-Origin: $allowOrigin" -ForegroundColor Gray
    
    if ($allowOrigin -eq 'https://chatgpt.com') {
        Write-Host "   ✅ CORS Origin matches ChatGPT" -ForegroundColor Green
    } else {
        Write-Host "   ❌ CORS Origin incorrect: $allowOrigin" -ForegroundColor Red
    }
    
    # Parse response to show capabilities
    $data = $response.Content | ConvertFrom-Json
    Write-Host "   Protocol: $($data.result.protocolVersion)" -ForegroundColor Gray
    Write-Host "   listChanged: $($data.result.capabilities.tools.listChanged)" -ForegroundColor Gray
    
} catch {
    Write-Host "❌ FAILED: $_" -ForegroundColor Red
}

# Test 4: health_check with Origin header
Write-Host "`nTest 4: POST health_check with Origin header" -ForegroundColor Yellow
$body = '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"health_check","arguments":{}}}'

try {
    $response = Invoke-WebRequest -Method POST -Uri $url -ContentType "application/json" -Body $body -Headers @{
        Origin = "https://chatgpt.com"
    }
    
    Write-Host "✅ STATUS: $($response.StatusCode)" -ForegroundColor Green
    
    $allowOrigin = $response.Headers['Access-Control-Allow-Origin']
    Write-Host "   Access-Control-Allow-Origin: $allowOrigin" -ForegroundColor Gray
    
    if ($allowOrigin -eq 'https://chatgpt.com') {
        Write-Host "   ✅ CORS Origin matches ChatGPT" -ForegroundColor Green
    } else {
        Write-Host "   ❌ CORS Origin incorrect: $allowOrigin" -ForegroundColor Red
    }
    
} catch {
    Write-Host "❌ FAILED: $_" -ForegroundColor Red
}

Write-Host "`n════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host " CORS TESTING COMPLETE" -ForegroundColor Cyan
Write-Host "════════════════════════════════════════════════════════════`n" -ForegroundColor Cyan

Write-Host "All CORS headers should show: https://chatgpt.com" -ForegroundColor Yellow
Write-Host "If all tests pass, ChatGPT can now connect!`n" -ForegroundColor Green
