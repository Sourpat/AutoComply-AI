# Frontend API Integration - Implementation Summary

## ✅ Completed Files

### 1. API Clients (New Files)
- **frontend/src/api/workflowApi.ts** (266 lines)
  - `workflowHealth()` - Health check
  - `listCases(filters)` - List cases with filters
  - `getCase(caseId)` - Get case by ID
  - `createCase(payload)` - Create new case
  - `patchCase(caseId, patch)` - Update case
  - `listAudit(caseId)` - Get audit timeline
  - `addAudit(caseId, event)` - Add audit event
  - `attachEvidence(caseId, evidencePayload)` - Attach evidence
  - `updateEvidencePacket(caseId, packetEvidenceIds)` - Update packet

- **frontend/src/api/submissionsApi.ts** (123 lines)
  - `createSubmission(input)` - Create submission
  - `getSubmission(id)` - Get submission by ID
  - `listSubmissions(filters)` - List submissions with filters

### 2. API-Backed Stores (New Files)
- **frontend/src/workflow/workflowStoreApi.ts** (207 lines)
  - Implements async workflow store matching demoStore interface
  - Maps between backend CaseRecord and frontend WorkQueueItem
  - Maps between backend AuditEvent and frontend AuditEvent
  - Methods: getWorkQueue, addWorkQueueItem, updateWorkQueueItem, deleteWorkQueueItem, getAuditEvents, addAuditEvent, attachEvidence, updateEvidencePacket

- **frontend/src/submissions/submissionStoreApi.ts** (53 lines)
  - Async submission store matching localStorage interface
  - Methods: createSubmission, getSubmission, listSubmissions

### 3. Store Selectors with Fallback (New Files)
- **frontend/src/workflow/workflowStoreSelector.ts** (137 lines)
  - `getWorkflowStore()` - Returns API or localStorage store based on health
  - Health check with 30s cache
  - Automatic fallback to localStorage if backend unavailable
  - DemoStoreAdapter for async compatibility

- **frontend/src/submissions/submissionStoreSelector.ts** (96 lines)
  - `createSubmission()` - Creates submission with auto-fallback
  - `getSubmission()` - Gets submission with auto-fallback
  - `listSubmissions()` - Lists submissions with auto-fallback
  - Health check with fallback

### 4. React Hooks (New Files)
- **frontend/src/workflow/useWorkflowStore.ts** (150 lines)
  - `useWorkflowStore()` - Hook to get store instance
  - `useWorkQueue(autoRefresh)` - Hook to load and refresh queue
  - `useCaseOperations()` - Hook for update/assign/delete operations
  - `useAuditEvents(caseId)` - Hook for audit timeline

### 5. Updated Files
- **frontend/src/workflow/submissionIntakeService.ts**
  - ✅ Updated imports to use `getSubmission` from submissionStoreSelector
  - ✅ Updated imports to use `getWorkflowStore` instead of demoStore
  - ✅ Made `writeAuditEvent()` async
  - ✅ Made `intakeSubmissionToCase()` async with await calls
  - ✅ Made `isSubmissionIntaken()` async
  - ✅ Made `getCaseIdForSubmission()` async

## 📋 UI Components Requiring Updates

### High Priority (Core Workflow)

1. **frontend/src/pages/ConsoleDashboard.tsx** (2234 lines)
   - Primary work queue display
   - **Changes needed:**
     - Replace `demoStore.getWorkQueue()` with `getWorkflowStore().then(s => s.getWorkQueue())`
     - Replace `demoStore.updateWorkQueueItem()` with async calls
     - Replace `demoStore.addAuditEvent()` with async calls
     - Replace `demoStore.assignWorkQueueItem()` with updateWorkQueueItem + assignedTo
     - Replace `demoStore.unassignWorkQueueItem()` with updateWorkQueueItem + null
   - **Alternative:** Use the new `useWorkQueue()` and `useCaseOperations()` hooks

2. **frontend/src/features/cases/CaseDetailsPanel.tsx**
   - Case details display
   - **Changes needed:**
     - Replace demoStore calls with getWorkflowStore() async calls
     - Update audit event loading
     - Update status transitions

3. **frontend/src/components/CaseDetailsDrawer.tsx**
   - Drawer for case details
   - **Changes needed:**
     - Replace demoStore.getAuditEvents() with async call
     - Replace demoStore.getWorkQueue() with async call

4. **frontend/src/pages/CaseWorkspace.tsx**
   - Case workspace page
   - **Changes needed:**
     - Replace demoStore calls with async workflow store

### Medium Priority (Supporting Features)

5. **frontend/src/features/rag/RegulatoryDecisionExplainPanel.tsx**
   - RAG evidence panel
   - Uses demoStore for submissions
   - **Changes needed:**
     - Replace demoStore.getSubmissions() with async call

## 🔧 Implementation Pattern

### Pattern 1: Direct Async Replacement
```typescript
// Before:
const items = demoStore.getWorkQueue();

// After:
const store = await getWorkflowStore();
const items = await store.getWorkQueue();
```

### Pattern 2: Using React Hooks (Recommended)
```typescript
// In React component:
import { useWorkQueue, useCaseOperations } from '../workflow/useWorkflowStore';

function MyComponent() {
  const { items, isLoading, reload } = useWorkQueue();
  const { updateCase, assignCase } = useCaseOperations();
  
  const handleStatusChange = async (caseId, newStatus) => {
    await updateCase(caseId, { status: newStatus });
    reload(); // Refresh queue
  };
  
  // ...
}
```

### Pattern 3: Effect-based Loading
```typescript
// In component mount:
useEffect(() => {
  async function loadData() {
    const store = await getWorkflowStore();
    const items = await store.getWorkQueue();
    setItems(items);
  }
  loadData();
}, []);
```

## ⚙️ Backend Requirements

### Already Running:
✅ Backend on http://localhost:8001
✅ /workflow/* endpoints (9 endpoints)
✅ /submissions/* endpoints (3 endpoints)
✅ CORS enabled for localhost:5173

### Health Check:
```bash
curl http://localhost:8001/workflow/health
# Returns: {"ok": true}
```

## 🧪 Testing Strategy

### 1. Test with Backend Running
```bash
# Terminal 1: Backend
cd backend
.venv\Scripts\python.exe -m uvicorn src.api.main:app --reload --host 127.0.0.1 --port 8001

# Terminal 2: Frontend
cd frontend
npm run dev
```

Expected: Frontend uses API, data persists across refreshes

### 2. Test with Backend Down
```bash
# Stop backend server
# Refresh frontend
```

Expected: Frontend automatically falls back to localStorage

### 3. Test Failover
```bash
# Start backend, create some cases
# Stop backend
# Refresh page
```

Expected: Cases created via API lost, localStorage cases visible

## 📊 Current Status

### ✅ Complete
- API clients for workflow and submissions
- API-backed stores matching demoStore interface
- Automatic health check and fallback logic
- React hooks for easy integration
- Submission intake service updated

### 🔄 In Progress
- UI component updates (5 files need conversion)

### ⏭️ Next Steps
1. Update ConsoleDashboard.tsx to use useWorkQueue() hook
2. Update CaseDetailsPanel.tsx to use useAuditEvents() hook
3. Update CaseDetailsDrawer.tsx
4. Update CaseWorkspace.tsx
5. Update RegulatoryDecisionExplainPanel.tsx for submissions
6. Test end-to-end workflow
7. Verify fallback behavior

## 🎯 Migration Priority

**Phase 1 (Essential):**
- ConsoleDashboard.tsx - Main work queue display
- CaseDetailsPanel.tsx - Case details and actions

**Phase 2 (Important):**
- CaseDetailsDrawer.tsx - Audit timeline
- CaseWorkspace.tsx - Full case workspace

**Phase 3 (Nice-to-have):**
- RegulatoryDecisionExplainPanel.tsx - RAG evidence view

## 💡 Key Design Decisions

1. **Automatic Fallback:** Health check runs once per 30s, cached
2. **Interface Compatibility:** API stores match localStorage store interface exactly
3. **Type Mapping:** Backend types mapped to frontend types transparently
4. **React-Friendly:** Hooks provided for common operations
5. **No Breaking Changes:** Existing localStorage code still works as fallback

## 📝 Notes

- All async operations use try/catch for error handling
- Health check timeout set to 3 seconds
- Store methods return same types whether using API or localStorage
- Audit events auto-create on status/assignment changes (backend)
- Evidence attachment creates audit events (backend)
