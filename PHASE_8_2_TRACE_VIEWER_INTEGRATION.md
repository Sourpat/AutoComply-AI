# Phase 8.2: Trace Viewer Integration Guide

## Status: Backend Complete ✅ | Frontend Ready for Integration 🔄

### Completed Work

**Backend (100% Complete)**
- ✅ POST `/api/traces/{trace_id}/labels` endpoint
- ✅ GET `/api/traces/{trace_id}` includes labels
- ✅ Label storage in `trace_metadata_json` under `__labels` key
- ✅ All inputs redacted with `safe_mode=True`
- ✅ 5 integration tests (skip for unit test DB)

**Frontend (Ready to Integrate)**
- ✅ `tracesClient.ts` - API client with TypeScript types
- ✅ `TraceViewer.tsx` - Complete React component
- 🔄 **Pending**: Add Traces tab to ConsoleDashboard

---

## Integration Steps

### 1. Add Traces Tab to ConsoleDashboard

**File**: `frontend/src/pages/ConsoleDashboard.tsx`

**Step 1.1**: Update ActiveSection type (around line 28)
```typescript
type ActiveSection = 
  | "dashboard" 
  | "csf" 
  | "licenses" 
  | "orders" 
  | "traces"  // ADD THIS
  | "settings" 
  | "about";
```

**Step 1.2**: Add import at top
```typescript
import { TraceViewer } from "../components/TraceViewer";
```

**Step 1.3**: Add nav button in sidebar (around line 1470, after Orders button)
```tsx
<button
  className={`console-nav-item ${activeSection === "traces" ? "console-nav-item--active" : ""}`}
  onClick={() => setActiveSection("traces")}
>
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
  </svg>
  Traces
</button>
```

**Step 1.4**: Add content section (search for `{activeSection === "dashboard"`, add after orders section)
```tsx
{activeSection === "traces" && (
  <div className="console-section">
    <TraceViewer />
  </div>
)}
```

### 2. Build & Verify

```powershell
cd frontend
npm install
npm run build
```

Expected: Clean build with no TypeScript errors.

### 3. Test Manually

1. Start backend: `cd backend; .venv/Scripts/python -m uvicorn src.api.main:app --reload --port 8001`
2. Start frontend: `cd frontend; npm run dev`
3. Navigate to `http://localhost:5173/console`
4. Click **Traces** tab in sidebar
5. Verify trace list loads (may be empty if no traces exist)
6. Click any trace to open detail view
7. Add labels (codes, category, pass/fail, severity, notes)
8. Click **Save Labels**
9. Verify success alert
10. Close and reopen trace, verify labels persisted

### 4. RBAC (Optional Enhancement)

If you want to restrict Traces tab to verifier/admin only:

**File**: `frontend/src/auth/permissions.ts`
```typescript
export function canViewTraces(role: string): boolean {
  return role === "verifier" || role === "admin";
}
```

**File**: `frontend/src/pages/ConsoleDashboard.tsx`
```tsx
// Only show Traces button if authorized
{canViewTraces(currentUserRole) && (
  <button
    className={`console-nav-item ${activeSection === "traces" ? "console-nav-item--active" : ""}`}
    onClick={() => setActiveSection("traces")}
  >
    Traces
  </button>
)}
```

---

## API Reference

### List Traces
```typescript
GET /api/traces?case_id={id}&limit=50&offset=0
Response: { traces: TraceSummary[], total: number }
```

### Get Trace Detail
```typescript
GET /api/traces/{trace_id}
Response: TraceDetail (root_span, child_spans, labels, totals)
```

### Add/Update Labels
```typescript
POST /api/traces/{trace_id}/labels
Body: {
  open_codes: string[],         // e.g., ["missing_policy", "review_required"]
  axial_category: string | null,  // policy_gap | data_quality | edge_case | expected | other
  pass_fail: boolean | null,
  severity: string | null,       // P0 | P1 | P2
  notes: string | null
}
Response: { success: true, trace_id: string, labels: {...} }
```

### Security
- All label inputs redacted with `safe_mode=True` before storage
- Labels stored in `trace_metadata_json.__labels` (no new tables)
- Backend never stores raw user input

---

## Testing

### Backend Tests
```powershell
cd backend
.venv/Scripts/python -m pytest tests/test_phase8_01_trace.py -v -k "TestTraceLabelsAPI"
```

**Note**: These 5 tests skip in unit test environment (DB lacks trace columns from Phase 8.1 migration). They will run in production/migrated environments.

### Frontend Manual Test Cases
1. **Empty State**: No traces → shows "No traces found"
2. **Search**: Filter by trace_id or case_id
3. **Detail View**: Click trace → modal opens with span tree
4. **Add Labels**: Fill form → Save → success alert
5. **Update Labels**: Reopen same trace → form pre-filled → modify → save
6. **Required Fields**: All label fields optional (can save with partial data)

---

## Files Changed

```
backend/
  src/api/routes/traces.py          (labels endpoints)
  tests/test_phase8_01_trace.py     (5 new tests)

frontend/
  src/api/tracesClient.ts           (NEW - API client)
  src/components/TraceViewer.tsx    (NEW - UI component)
  src/pages/ConsoleDashboard.tsx    (TODO - add Traces tab)
```

---

## Next Steps (Phase 8.3 - Future)

**Do NOT implement Phase 8.3 yet (WIP=1 constraint)**

Future enhancements:
- Export traces to CSV/JSON
- Bulk labeling (select multiple traces)
- Label analytics dashboard
- Trace search by label values
- Time-based filtering (created_at range)

---

## Commit Message Template

```
feat(ui): add Trace Viewer tab with labeling (Phase 8.2)

Backend:
- POST /api/traces/{trace_id}/labels: Store labels in trace_metadata_json
- GET /api/traces/{trace_id}: Include labels in response
- Redaction: All inputs redacted with safe_mode=True
- Tests: 5 integration tests (skip for unit test DB)

Frontend:
- tracesClient.ts: TypeScript API client for traces endpoints
- TraceViewer.tsx: React component with list/detail/label UI
- Integration pending: Add Traces tab to ConsoleDashboard

Files changed:
- backend/src/api/routes/traces.py
- backend/tests/test_phase8_01_trace.py
- frontend/src/api/tracesClient.ts (NEW)
- frontend/src/components/TraceViewer.tsx (NEW)
- PHASE_8_2_TRACE_VIEWER_INTEGRATION.md (NEW)

Manual verification:
1. Run backend tests: pytest -k "TestTraceLabelsAPI"
2. Integrate TraceViewer into ConsoleDashboard (see PHASE_8_2_TRACE_VIEWER_INTEGRATION.md)
3. Test labels save/retrieve workflow
```
