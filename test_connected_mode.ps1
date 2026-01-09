# Quick Test: Connected Mode Fix
# Verifies that RAG Explorer Connected mode can see Compliance Console submissions

Write-Host "=== Connected Mode Fix - Quick Test ===" -ForegroundColor Cyan
Write-Host ""

# Check if backend is running
Write-Host "Checking backend..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://127.0.0.1:8001/health" -Method GET -TimeoutSec 3
    Write-Host "✓ Backend is running" -ForegroundColor Green
} catch {
    Write-Host "✗ Backend not running. Start with: cd backend; .venv\Scripts\python -m uvicorn src.api.main:app --reload --host 127.0.0.1 --port 8001" -ForegroundColor Red
    exit 1
}

# Check if frontend is running
Write-Host "Checking frontend..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:5173" -Method GET -TimeoutSec 3
    Write-Host "✓ Frontend is running" -ForegroundColor Green
} catch {
    Write-Host "✗ Frontend not running. Start with: cd frontend; npm run dev" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "=== Manual Verification Steps ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Navigate to Compliance Console:" -ForegroundColor White
Write-Host "   http://localhost:5173/console" -ForegroundColor Gray
Write-Host ""
Write-Host "2. Verify verification queue has items" -ForegroundColor White
Write-Host "   - Should see Hospital CSFs, Practitioner CSFs, etc." -ForegroundColor Gray
Write-Host ""
Write-Host "3. Open DevTools → Application → Local Storage" -ForegroundColor White
Write-Host "   - Check for key: autocomply_submissions" -ForegroundColor Gray
Write-Host "   - Should contain array of submission objects" -ForegroundColor Gray
Write-Host ""
Write-Host "4. Navigate to RAG Explorer:" -ForegroundColor White
Write-Host "   http://localhost:5173/console/rag" -ForegroundColor Gray
Write-Host ""
Write-Host "5. In Decision Explain section:" -ForegroundColor White
Write-Host "   - Select 'Connected mode (recent submissions)'" -ForegroundColor Gray
Write-Host "   - Dropdown should show submissions from Console" -ForegroundColor Gray
Write-Host "   - Select a submission and click 'Load Selected Submission'" -ForegroundColor Gray
Write-Host "   - Should show success message" -ForegroundColor Gray
Write-Host ""
Write-Host "6. Click 'Explain Decision'" -ForegroundColor White
Write-Host "   - Should show fired rules and evaluation results" -ForegroundColor Gray
Write-Host "   - Should NOT show 'No submissions available'" -ForegroundColor Gray
Write-Host ""
Write-Host "7. Test Deep Linking:" -ForegroundColor White
Write-Host "   - Go back to Compliance Console" -ForegroundColor Gray
Write-Host "   - Click 'Open trace' on any queue item" -ForegroundColor Gray
Write-Host "   - Should auto-load submission in RAG Explorer" -ForegroundColor Gray
Write-Host ""
Write-Host "=== Expected Results ===" -ForegroundColor Cyan
Write-Host "✓ Submissions appear in RAG Explorer dropdown" -ForegroundColor Green
Write-Host "✓ Loading submission succeeds" -ForegroundColor Green
Write-Host "✓ Explain Decision shows fired rules" -ForegroundColor Green
Write-Host "✓ Deep linking works from 'Open trace' button" -ForegroundColor Green
Write-Host "✓ Data syncs between Console and RAG Explorer" -ForegroundColor Green
Write-Host ""
Write-Host "=== Common Issues ===" -ForegroundColor Yellow
Write-Host "Issue: No submissions in dropdown" -ForegroundColor White
Write-Host "  → Visit Compliance Console first to populate localStorage" -ForegroundColor Gray
Write-Host ""
Write-Host "Issue: Deep linking doesn't work" -ForegroundColor White
Write-Host "  → Refresh Compliance Console to update submission store" -ForegroundColor Gray
Write-Host ""
Write-Host "Issue: Explain Decision shows 'No rules fired'" -ForegroundColor White
Write-Host "  → Check backend logs for evaluation errors" -ForegroundColor Gray
Write-Host "  → Verify submission payload contains evidence data" -ForegroundColor Gray
Write-Host ""
Write-Host "See CONNECTED_MODE_FIX_VERIFICATION.md for detailed testing steps" -ForegroundColor Cyan
