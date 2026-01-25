$baseUrl = "https://autocomply-mcp-control-plane.vercel.app"

Write-Host "`n╔════════════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  MCP SERVER DIAGNOSTIC - CHATGPT CONNECTION ISSUES                 ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════════════════╝`n" -ForegroundColor Cyan

# Test 1: OAuth Discovery Endpoints
Write-Host "1️⃣  Testing OAuth Discovery Endpoints" -ForegroundColor Yellow
Write-Host "   (ChatGPT checks these first)`n" -ForegroundColor Gray

try {
    Write-Host "   → GET /.well-known/oauth-authorization-server" -ForegroundColor White
    $r1 = Invoke-WebRequest "$baseUrl/.well-known/oauth-authorization-server"
    Write-Host "   ✅ Status: $($r1.StatusCode)" -ForegroundColor Green
} catch {
    Write-Host "   ❌ FAILED: $_" -ForegroundColor Red
    Write-Host "   This might cause ChatGPT to hang!" -ForegroundColor Yellow
}

try {
    Write-Host "   → GET /api/mcp/.well-known/oauth-authorization-server" -ForegroundColor White
    $r2 = Invoke-WebRequest "$baseUrl/api/mcp/.well-known/oauth-authorization-server"
    Write-Host "   ✅ Status: $($r2.StatusCode)" -ForegroundColor Green
} catch {
    Write-Host "   ❌ FAILED: $_" -ForegroundColor Red
}

# Test 2: MCP Lifecycle
Write-Host "`n2️⃣  Testing MCP Lifecycle (initialize → tools/list)" -ForegroundColor Yellow
Write-Host "   (This is what ChatGPT Connect does)`n" -ForegroundColor Gray

$mcpUrl = "$baseUrl/mcp"

# Step 1: initialize
try {
    Write-Host "   → POST initialize" -ForegroundColor White
    $init = '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}'
    $r = Invoke-WebRequest -Uri $mcpUrl -Method POST -Body $init -ContentType "application/json" -Headers @{Origin="https://chatgpt.com"}
    $data = $r.Content | ConvertFrom-Json
    
    if ($r.StatusCode -eq 200 -and $data.result.protocolVersion) {
        Write-Host "   ✅ initialize OK - Protocol: $($data.result.protocolVersion)" -ForegroundColor Green
        Write-Host "      CORS: $($r.Headers['Access-Control-Allow-Origin'])" -ForegroundColor Gray
    } else {
        Write-Host "   ⚠️  Unexpected response" -ForegroundColor Yellow
    }
} catch {
    Write-Host "   ❌ initialize FAILED: $_" -ForegroundColor Red
    Write-Host "   ChatGPT will hang here!" -ForegroundColor Yellow
}

# Step 2: notifications/initialized
try {
    Write-Host "   → POST notifications/initialized" -ForegroundColor White
    $notif = '{"jsonrpc":"2.0","method":"notifications/initialized","params":{}}'
    $r = Invoke-WebRequest -Uri $mcpUrl -Method POST -Body $notif -ContentType "application/json" -Headers @{Origin="https://chatgpt.com"}
    
    if ($r.StatusCode -eq 204) {
        Write-Host "   ✅ notifications/initialized OK (204)" -ForegroundColor Green
    } else {
        Write-Host "   ⚠️  Status: $($r.StatusCode)" -ForegroundColor Yellow
    }
} catch {
    if ($_.Exception.Response.StatusCode -eq 204) {
        Write-Host "   ✅ notifications/initialized OK (204)" -ForegroundColor Green
    } else {
        Write-Host "   ❌ notifications/initialized FAILED: $_" -ForegroundColor Red
    }
}

# Step 3: tools/list
try {
    Write-Host "   → POST tools/list" -ForegroundColor White
    $tools = '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}'
    $r = Invoke-WebRequest -Uri $mcpUrl -Method POST -Body $tools -ContentType "application/json" -Headers @{Origin="https://chatgpt.com"}
    $data = $r.Content | ConvertFrom-Json
    
    if ($data.result.tools) {
        Write-Host "   ✅ tools/list OK - $($data.result.tools.Count) tools" -ForegroundColor Green
        Write-Host "      CORS: $($r.Headers['Access-Control-Allow-Origin'])" -ForegroundColor Gray
    } else {
        Write-Host "   ⚠️  No tools in response" -ForegroundColor Yellow
    }
} catch {
    Write-Host "   ❌ tools/list FAILED: $_" -ForegroundColor Red
}

# Test 3: CORS Preflight
Write-Host "`n3️⃣  Testing CORS Preflight (required for browser)" -ForegroundColor Yellow
Write-Host "   (ChatGPT browser needs this)`n" -ForegroundColor Gray

try {
    Write-Host "   → OPTIONS /mcp" -ForegroundColor White
    $r = Invoke-WebRequest -Method OPTIONS -Uri $mcpUrl -Headers @{
        Origin = "https://chatgpt.com"
        "Access-Control-Request-Method" = "POST"
        "Access-Control-Request-Headers" = "content-type"
    }
    
    if ($r.StatusCode -in @(200, 204)) {
        Write-Host "   ✅ OPTIONS OK - Status: $($r.StatusCode)" -ForegroundColor Green
        Write-Host "      Allow-Origin: $($r.Headers['Access-Control-Allow-Origin'])" -ForegroundColor Gray
        Write-Host "      Allow-Methods: $($r.Headers['Access-Control-Allow-Methods'])" -ForegroundColor Gray
    }
} catch {
    Write-Host "   ❌ OPTIONS FAILED: $_" -ForegroundColor Red
    Write-Host "   Browser requests will fail!" -ForegroundColor Yellow
}

# Test 4: Check for OAuth endpoints (if configured)
Write-Host "`n4️⃣  Testing OAuth Endpoints (if ChatGPT tries OAuth)" -ForegroundColor Yellow
Write-Host "   (Might cause hanging if misconfigured)`n" -ForegroundColor Gray

$oauthEndpoints = @(
    "/api/auth/authorize",
    "/api/auth/token",
    "/api/auth/callback"
)

foreach ($endpoint in $oauthEndpoints) {
    try {
        Write-Host "   → GET $endpoint" -ForegroundColor White
        $r = Invoke-WebRequest "$baseUrl$endpoint" -Method GET
        Write-Host "   ✅ Responds: $($r.StatusCode)" -ForegroundColor Green
    } catch {
        $statusCode = $_.Exception.Response.StatusCode.value__
        if ($statusCode -in @(400, 401, 405)) {
            Write-Host "   ⚠️  $endpoint exists but returned $statusCode" -ForegroundColor Yellow
        } else {
            Write-Host "   ❌ $endpoint NOT FOUND" -ForegroundColor Red
        }
    }
}

# Summary
Write-Host "`n╔════════════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  DIAGNOSTIC SUMMARY                                                ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════════════════╝`n" -ForegroundColor Cyan

Write-Host "Common Issues:" -ForegroundColor Yellow
Write-Host "   • If OAuth endpoints fail → ChatGPT hangs on Connect" -ForegroundColor White
Write-Host "   • If CORS missing → Browser blocks requests" -ForegroundColor White
Write-Host "   • If initialize fails → Connection never completes" -ForegroundColor White
Write-Host "   • If tools/list fails → 'All tools are hidden' error`n" -ForegroundColor White

Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host "   1. Check Vercel logs for errors during Connect" -ForegroundColor White
Write-Host "   2. Review test results above for failures" -ForegroundColor White
Write-Host "   3. If OAuth failing, we can disable it`n" -ForegroundColor White
