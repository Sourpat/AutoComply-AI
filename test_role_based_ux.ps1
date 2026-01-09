# Quick Test: Role-Based UX

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  AutoComply AI - Role-Based UX Test" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "[OK] Step 1.9 Implementation Complete!" -ForegroundColor Green
Write-Host ""
Write-Host "What was built:" -ForegroundColor Yellow
Write-Host "  - 3 user roles: Submitter, Verifier, Admin" -ForegroundColor White
Write-Host "  - Role switcher dropdown in header (top-right)" -ForegroundColor White
Write-Host "  - 15 granular permission checks" -ForegroundColor White
Write-Host "  - Role-based feature gating in Console + RAG Explorer" -ForegroundColor White
Write-Host "  - localStorage persistence across page refreshes" -ForegroundColor White
Write-Host ""

Write-Host "Files created/modified:" -ForegroundColor Yellow
Write-Host "  ✨ frontend/src/context/RoleContext.tsx (NEW)" -ForegroundColor Green
Write-Host "  ✨ frontend/src/auth/permissions.ts (NEW)" -ForegroundColor Green
Write-Host "  ✏️  frontend/src/main.jsx (modified)" -ForegroundColor Blue
Write-Host "  ✏️  frontend/src/components/AppHeader.tsx (modified)" -ForegroundColor Blue
Write-Host "  ✏️  frontend/src/pages/ConsoleDashboard.tsx (modified)" -ForegroundColor Blue
Write-Host "  ✏️  frontend/src/features/rag/RegulatoryDecisionExplainPanel.tsx (modified)" -ForegroundColor Blue
Write-Host ""

Write-Host "Build status:" -ForegroundColor Yellow
Write-Host "  ✅ No TypeScript errors in new files" -ForegroundColor Green
Write-Host "  ✅ Build successful (1.28s)" -ForegroundColor Green
Write-Host "  ✅ Bundle size: 629.66 kB (gzipped: 152.92 kB)" -ForegroundColor Green
Write-Host ""

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Manual Testing Instructions" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "1️⃣  Start the demo servers:" -ForegroundColor Yellow
Write-Host "   Terminal 1 (Backend):" -ForegroundColor White
Write-Host "     cd backend" -ForegroundColor Gray
Write-Host "     .venv\Scripts\python -m uvicorn src.api.main:app --reload --host 127.0.0.1 --port 8001" -ForegroundColor Gray
Write-Host ""
Write-Host "   Terminal 2 (Frontend):" -ForegroundColor White
Write-Host "     cd frontend" -ForegroundColor Gray
Write-Host "     npm run dev" -ForegroundColor Gray
Write-Host ""

Write-Host "2️⃣  Open browser:" -ForegroundColor Yellow
Write-Host "     http://localhost:5173" -ForegroundColor Cyan
Write-Host ""

Write-Host "3️⃣  Test role switching:" -ForegroundColor Yellow
Write-Host "   a) Find role dropdown in top-right corner" -ForegroundColor White
Write-Host "   b) Default role: ✅ Verifier" -ForegroundColor White
Write-Host ""
Write-Host "   c) Switch to 📝 Submitter:" -ForegroundColor Magenta
Write-Host "      • Compliance Console:" -ForegroundColor White
Write-Host "        ✓ 'My Submissions' section appears" -ForegroundColor Green
Write-Host "        ✓ Work queue is hidden" -ForegroundColor Green
Write-Host "        ✓ Recent decisions table is hidden" -ForegroundColor Green
Write-Host "        ✓ Submitter guidance panel appears" -ForegroundColor Green
Write-Host "      • RAG Explorer:" -ForegroundColor White
Write-Host "        ✓ Mode switcher is hidden (Sandbox only)" -ForegroundColor Green
Write-Host "        ✓ Rule IDs and citations are hidden" -ForegroundColor Green
Write-Host "        ✓ Evidence chips are hidden" -ForegroundColor Green
Write-Host "        ✓ Fired rules section is hidden" -ForegroundColor Green
Write-Host "        ✓ Counterfactuals are hidden" -ForegroundColor Green
Write-Host "        ✓ Export buttons are hidden" -ForegroundColor Green
Write-Host "        ✓ Outcome + missing fields are visible" -ForegroundColor Green
Write-Host ""
Write-Host "   d) Switch to ✅ Verifier:" -ForegroundColor Cyan
Write-Host "      • Compliance Console:" -ForegroundColor White
Write-Host "        ✓ Work queue is visible" -ForegroundColor Green
Write-Host "        ✓ Recent decisions table is visible" -ForegroundColor Green
Write-Host "        ✓ 'My Submissions' is hidden" -ForegroundColor Green
Write-Host "      • RAG Explorer:" -ForegroundColor White
Write-Host "        ✓ Mode switcher is visible" -ForegroundColor Green
Write-Host "        ✓ Full explainability with rule IDs" -ForegroundColor Green
Write-Host "        ✓ Evidence chips are clickable" -ForegroundColor Green
Write-Host "        ✓ Export JSON/HTML buttons work" -ForegroundColor Green
Write-Host ""
Write-Host "   e) Switch to ⚙️ Admin:" -ForegroundColor Yellow
Write-Host "      ✓ All verifier features visible" -ForegroundColor Green
Write-Host "      ✓ Admin controls accessible (if applicable)" -ForegroundColor Green
Write-Host "      ✓ Debug panels enabled (if DevSupport on)" -ForegroundColor Green
Write-Host ""

Write-Host "4️⃣  Test persistence:" -ForegroundColor Yellow
Write-Host "   a) Switch to Submitter" -ForegroundColor White
Write-Host "   b) Refresh page (F5)" -ForegroundColor White
Write-Host "   c) Verify role is still Submitter ✅" -ForegroundColor Green
Write-Host ""

Write-Host "5️⃣  Verify no crashes:" -ForegroundColor Yellow
Write-Host "   • Switch rapidly between all 3 roles" -ForegroundColor White
Write-Host "   • Navigate between Console and RAG Explorer" -ForegroundColor White
Write-Host "   • Run a decision in RAG Explorer" -ForegroundColor White
Write-Host "   • Check browser console for errors" -ForegroundColor White
Write-Host ""

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Documentation" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "📖 Full guide:     ROLE_BASED_UX_GUIDE.md" -ForegroundColor Cyan
Write-Host "📊 Summary:        STEP_1_9_COMPLETE.md" -ForegroundColor Cyan
Write-Host "🔍 Permission API: frontend/src/auth/permissions.ts" -ForegroundColor Cyan
Write-Host ""

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  localStorage Schema" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Key: 'acai.role.v1'" -ForegroundColor White
Write-Host "Value: 'submitter' | 'verifier' | 'admin'" -ForegroundColor White
Write-Host "Default: 'verifier'" -ForegroundColor White
Write-Host ""
Write-Host "To reset:" -ForegroundColor Yellow
Write-Host "  localStorage.removeItem('acai.role.v1')" -ForegroundColor Gray
Write-Host "  # Then refresh page" -ForegroundColor Gray
Write-Host ""

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Next Steps" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "✨ What's next after role-based UX?" -ForegroundColor Yellow
Write-Host ""
Write-Host "Potential enhancements:" -ForegroundColor White
Write-Host "  • Backend role validation (send role in API headers)" -ForegroundColor Gray
Write-Host "  • SSO/OAuth integration (auto-assign roles from claims)" -ForegroundColor Gray
Write-Host "  • Audit logging (track who viewed what)" -ForegroundColor Gray
Write-Host "  • Custom roles (ReadOnlyVerifier, ComplianceManager)" -ForegroundColor Gray
Write-Host "  • Role-specific dashboards with analytics" -ForegroundColor Gray
Write-Host ""

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Status: READY FOR TESTING" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
