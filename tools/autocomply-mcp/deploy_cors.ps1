Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host " Building MCP Server with CORS" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

npm run build

if ($LASTEXITCODE -ne 0) {
    Write-Host "`n❌ Build failed!" -ForegroundColor Red
    exit 1
}

Write-Host "`n✅ Build successful!" -ForegroundColor Green

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host " Committing Changes" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

git add -A
git commit -m "fix: add CORS + OPTIONS for ChatGPT MCP discovery"
git push origin main

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host " Deploying to Vercel" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

vercel --prod

Write-Host "`n✅ Deployment complete!" -ForegroundColor Green
Write-Host "`nNext: Run test_cors.ps1 to verify CORS headers`n" -ForegroundColor Yellow
