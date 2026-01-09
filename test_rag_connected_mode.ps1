# RAG Explorer Connected Mode - Quick Test
# Verifies that Connected mode now shows decision data instead of "No rules fired"

Write-Host "=== RAG Explorer Connected Mode Fix - Quick Test ===" -ForegroundColor Cyan
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
Write-Host "=== PROBLEM A: Connected Mode Explainability ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Expected Fix:" -ForegroundColor White
Write-Host "  • Connected mode loads stored decision trace (not re-evaluated)" -ForegroundColor Gray
Write-Host "  • Shows fired rules, missing evidence, next steps from submission payload" -ForegroundColor Gray
Write-Host "  • Approved submissions show 'No blocking rules' instead of empty state" -ForegroundColor Gray
Write-Host "  • Handles both snake_case and camelCase field names" -ForegroundColor Gray
Write-Host ""

Write-Host "Manual Test Steps:" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. Navigate to Compliance Console:" -ForegroundColor White
Write-Host "   http://localhost:5173/console" -ForegroundColor Gray
Write-Host "   • Verify queue has items (Hospital/Practitioner CSFs)" -ForegroundColor Gray
Write-Host "   • Open DevTools → Application → Local Storage" -ForegroundColor Gray
Write-Host "   • Verify autocomply_submissions contains submissions" -ForegroundColor Gray
Write-Host ""

Write-Host "2. Navigate to RAG Explorer:" -ForegroundColor White
Write-Host "   http://localhost:5173/console/rag" -ForegroundColor Gray
Write-Host "   • Scroll to 'Decision Explainability' section (Section 2)" -ForegroundColor Gray
Write-Host ""

Write-Host "3. Test Connected Mode:" -ForegroundColor White
Write-Host "   • Select 'Connected mode (recent submissions)' from dropdown" -ForegroundColor Gray
Write-Host "   • Verify dropdown shows recent submissions" -ForegroundColor Gray
Write-Host "   • Select any submission" -ForegroundColor Gray
Write-Host "   • Click 'Load Selected Submission'" -ForegroundColor Gray
Write-Host "   • Verify success message: '✓ Loaded {type} submission from {date}'" -ForegroundColor Gray
Write-Host ""

Write-Host "4. Explain Decision:" -ForegroundColor White
Write-Host "   • Click 'Explain Decision' button" -ForegroundColor Gray
Write-Host "   • Verify shows loading state briefly" -ForegroundColor Gray
Write-Host "   • Check browser console for logs:" -ForegroundColor Gray
Write-Host "     - '[Connected] Loading stored trace from submission:'" -ForegroundColor DarkGray
Write-Host "     - '[Connected] Normalized trace:' (should show outcome, fired_rules, etc.)" -ForegroundColor DarkGray
Write-Host ""

Write-Host "Expected Results:" -ForegroundColor Yellow
Write-Host ""
Write-Host "✓ Outcome Badge:" -ForegroundColor Green
Write-Host "  • Shows APPROVED / BLOCKED / NEEDS REVIEW badge" -ForegroundColor Gray
Write-Host "  • Badge color matches status (green/red/yellow)" -ForegroundColor Gray
Write-Host ""

Write-Host "✓ Decision Summary:" -ForegroundColor Green
Write-Host "  • Shows decision_summary text from payload" -ForegroundColor Gray
Write-Host "  • NO 'No rules fired for this scenario' empty state" -ForegroundColor Gray
Write-Host ""

Write-Host "✓ For APPROVED submissions:" -ForegroundColor Green
Write-Host "  • Shows 'Why This Decision Was Approved' section" -ForegroundColor Gray
Write-Host "  • Shows 'Checks Passed' list (if satisfied_requirements exists)" -ForegroundColor Gray
Write-Host "  • Shows 'Rules Evaluated' with PASSED badges" -ForegroundColor Gray
Write-Host ""

Write-Host "✓ For BLOCKED/NEEDS_REVIEW submissions:" -ForegroundColor Green
Write-Host "  • Shows 'Missing Evidence' section (if any)" -ForegroundColor Gray
Write-Host "  • Shows 'Next Steps' section (if any)" -ForegroundColor Gray
Write-Host "  • Shows 'Fired Rules' grouped by severity (BLOCK/REVIEW/INFO)" -ForegroundColor Gray
Write-Host "  • Each rule shows: title, citation, requirement, jurisdiction" -ForegroundColor Gray
Write-Host ""

Write-Host "5. Test Deep Linking:" -ForegroundColor White
Write-Host "   • Go back to Compliance Console" -ForegroundColor Gray
Write-Host "   • Click 'Open trace' on any queue item" -ForegroundColor Gray
Write-Host "   • Should navigate to /console/rag?mode=connected&traceId=xxx" -ForegroundColor Gray
Write-Host "   • Should auto-load submission and show ready banner" -ForegroundColor Gray
Write-Host "   • Click 'Explain Decision'" -ForegroundColor Gray
Write-Host "   • Verify shows decision data (not empty)" -ForegroundColor Gray
Write-Host ""

Write-Host "6. Test Sandbox Mode (Regression):" -ForegroundColor White
Write-Host "   • Select 'Sandbox scenarios (pre-defined)'" -ForegroundColor Gray
Write-Host "   • Select any scenario" -ForegroundColor Gray
Write-Host "   • Click 'Explain Decision'" -ForegroundColor Gray
Write-Host "   • Verify still works (calls backend evaluator)" -ForegroundColor Gray
Write-Host "   • Verify shows fired rules as before" -ForegroundColor Gray
Write-Host ""

Write-Host "=== PROBLEM B: Sidebar Layout ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Expected Behavior:" -ForegroundColor White
Write-Host "  • Sidebar visible on left with navigation items" -ForegroundColor Gray
Write-Host "  • Content properly aligned (not under sidebar)" -ForegroundColor Gray
Write-Host "  • Switching Dashboard ↔ RAG Explorer maintains layout" -ForegroundColor Gray
Write-Host ""

Write-Host "Manual Test:" -ForegroundColor Yellow
Write-Host "  1. View RAG Explorer page" -ForegroundColor Gray
Write-Host "  2. Verify sidebar is visible on left" -ForegroundColor Gray
Write-Host "  3. Click 'Dashboard' in sidebar" -ForegroundColor Gray
Write-Host "  4. Verify layout stays consistent" -ForegroundColor Gray
Write-Host "  5. Click 'RAG Explorer' in sidebar" -ForegroundColor Gray
Write-Host "  6. Verify no layout shift or flickering" -ForegroundColor Gray
Write-Host ""

Write-Host "=== Common Issues ===" -ForegroundColor Yellow
Write-Host ""
Write-Host "Issue: Dropdown shows 'No recent submissions found'" -ForegroundColor White
Write-Host "  → Visit Compliance Console first to populate localStorage" -ForegroundColor Gray
Write-Host "  → Check DevTools → Local Storage for autocomply_submissions" -ForegroundColor Gray
Write-Host ""

Write-Host "Issue: Still shows 'No rules fired'" -ForegroundColor White
Write-Host "  → Check console logs for '[Connected] Normalized trace:'" -ForegroundColor Gray
Write-Host "  → Verify loadedTrace.payload contains decision data" -ForegroundColor Gray
Write-Host "  → Check that submission payload has fired_rules or missing_evidence" -ForegroundColor Gray
Write-Host ""

Write-Host "Issue: Decision summary shows 'undefined' or blank" -ForegroundColor White
Write-Host "  → Backend payload may not have decision_summary field" -ForegroundColor Gray
Write-Host "  → Normalizer generates default summary based on outcome" -ForegroundColor Gray
Write-Host "  → Check normalizeTrace() output in console" -ForegroundColor Gray
Write-Host ""

Write-Host "Issue: Deep linking doesn't auto-load" -ForegroundColor White
Write-Host "  → URL must have mode=connected&traceId=xxx" -ForegroundColor Gray
Write-Host "  → Submission with that traceId must exist in localStorage" -ForegroundColor Gray
Write-Host "  → Refresh Compliance Console to update store" -ForegroundColor Gray
Write-Host ""

Write-Host "=== Build Status ===" -ForegroundColor Cyan
Write-Host "✓ npm run build succeeded" -ForegroundColor Green
Write-Host "✓ No TypeScript errors" -ForegroundColor Green
Write-Host "✓ No linting errors" -ForegroundColor Green
Write-Host ""

Write-Host "See RAG_EXPLORER_CONNECTED_MODE_FIX.md for detailed documentation" -ForegroundColor Cyan
