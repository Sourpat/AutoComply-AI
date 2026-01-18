# Phase 7.6: Executive Decision Summary Card - BACKEND COMPLETE

## Status: Backend Implementation Complete ✅ | Frontend Pending ⏳

## Overview
Phase 7.6 adds an "Executive Summary" card that renders deterministic, executive-level narratives from Decision Intelligence v2 without LLM calls.

## Backend Implementation (COMPLETE)

### 1. Narrative Builder ✅
**File**: [backend/app/intelligence/narrative.py](backend/app/intelligence/narrative.py) (430 lines)

**ExecutiveSummary Schema**:
```python
class ExecutiveSummary(BaseModel):
    headline: str
    what_we_know: List[str]  # Max 3
    what_we_dont_know: List[str]  # Max 3
    risks: List[str]  # Max 3
    recommended_next_actions: List[str]  # Max 3
    confidence: Dict[str, Any]  # {score, band}
    badges: List[str]  # ["High Bias Risk", "Critical Gaps", etc.]
```

**Core Function**:
```python
def build_executive_summary(
    intel: Dict[str, Any],  # DecisionIntelligence v2
    case: Dict[str, Any],   # CaseRecord
    decision_type: str
) -> ExecutiveSummary
```

**Deterministic Logic**:
- **Headline**: Based on confidence_band + gap_severity_score + case status
  - HIGH confidence + low gaps: "Ready for decision - High confidence with complete evidence"
  - MEDIUM + high gaps: "Needs review - Evidence gaps require attention"
  - LOW: "Critical review needed - Significant evidence gaps detected"

- **what_we_know**: Extracted from explanation_factors (positive signals only)
  - "Primary submission completed with all required fields"
  - "Supporting evidence attached: [details]"
  - "Verification checks passed successfully"

- **what_we_dont_know**: Extracted from gaps (sorted by severity) + request_info state
  - "Primary submission not provided"
  - "Missing required evidence: [description]"
  - "Waiting on submitter response to information request"

- **risks**: Extracted from bias_flags + high-severity gaps
  - "Single source reliance - Validation with secondary source recommended"
  - "Low signal diversity - Additional verification sources needed"
  - "Critical evidence gaps may impact decision reliability"

- **recommended_next_actions**: Prioritized (gaps first, bias second, status-based)
  - "Request missing evidence: [description]"
  - "Validate findings with secondary independent source"
  - "Follow up on outstanding information request"
  - "Proceed to final approval decision" (high confidence only)

- **badges**: Visual indicators
  - "High Bias Risk" / "Bias Detected"
  - "Critical Gaps" / "Minor Gaps"
  - "Stale Signals" (>60 minutes old)

### 2. Database Migration ✅
**File**: [backend/scripts/migrate_add_executive_summary.py](backend/scripts/migrate_add_executive_summary.py)

**Changes**:
```sql
ALTER TABLE decision_intelligence
ADD COLUMN executive_summary_json TEXT
```

**Status**: ✅ Migration completed successfully

### 3. Repository Updates ✅
**File**: [backend/app/intelligence/repository.py](backend/app/intelligence/repository.py)

**Changes**:
- Updated `compute_and_upsert_decision_intelligence()` UPDATE statement to include `executive_summary_json`
- Updated INSERT statement to include `executive_summary_json`
- Updated `get_decision_intelligence()` SELECT to fetch `executive_summary_json`
- Updated DecisionIntelligence model instantiation to include `executive_summary_json`
- Added `update_executive_summary(case_id, executive_summary_json)` helper function

### 4. Service Layer Integration ✅
**File**: [backend/app/intelligence/service.py](backend/app/intelligence/service.py)

**Changes**:
- Updated imports to include `build_executive_summary` and `update_executive_summary`
- Added Step 4 to `recompute_case_intelligence()`: Generate and cache executive summary
- Added `_generate_and_cache_executive_summary()` helper function
  - Fetches case details from database
  - Builds intel_dict with gap_severity_score and explanation_factors
  - Calls `build_executive_summary()`
  - Caches JSON to decision_intelligence table
  - Returns ExecutiveSummary object

**Auto-Trigger Workflow**:
```
User Action → Backend Endpoint → lifecycle.py auto-trigger →  
service.recompute_case_intelligence() →
  1. Generate signals
  2. Upsert signals
  3. Compute v2 intelligence
  4. Generate + cache executive summary ← NEW
  5. Emit decision_intelligence_updated event
```

### 5. API Endpoint ✅
**File**: [backend/app/intelligence/router.py](backend/app/intelligence/router.py)

**New Endpoint**:
```python
GET /workflow/cases/{case_id}/executive-summary?decision_type=...
```

**Response**: `ExecutiveSummary` (Pydantic model)

**Logic**:
1. Get decision_intelligence record
2. If not found, compute it first
3. If `executive_summary_json` cached, parse and return
4. Otherwise, generate on-the-fly:
   - Build intel_dict from intelligence
   - Fetch case details
   - Call `build_executive_summary()`
   - Cache JSON for next time
   - Return ExecutiveSummary

**Caching**: Executive summary is automatically regenerated and cached whenever intelligence recomputes (Phase 7.5 auto-triggers)

### 6. Models Updated ✅
**File**: [backend/app/intelligence/models.py](backend/app/intelligence/models.py)

**Changes**:
```python
class DecisionIntelligence(BaseModel):
    # ... existing fields ...
    executive_summary_json: Optional[str] = None  # Phase 7.6
```

## Frontend Implementation (PENDING)

### 7. API Client ⏳
**File**: `frontend/src/api/intelligenceApi.ts`

**TODO**: Add function:
```typescript
export async function getExecutiveSummary(
  caseId: string, 
  decisionType?: string
): Promise<ExecutiveSummary> {
  const params = new URLSearchParams();
  if (decisionType) params.set('decision_type', decisionType);
  
  const response = await fetch(
    `${API_BASE_URL}/workflow/cases/${caseId}/executive-summary?${params}`
  );
  return response.json();
}
```

### 8. ExecutiveSummary Component ⏳
**File**: `frontend/src/features/intelligence/ExecutiveSummary.tsx`

**TODO**: Create component with:
- Headline at top (text-lg font-semibold)
- Confidence badge (ConfidenceBadge component)
- 4 bullet list sections:
  - What We Know (green checkmark icons)
  - What We Don't Know (yellow warning icons)
  - Risks (red alert icons)
  - Next Actions (blue arrow icons)
- Badges row (small colored pills)
- Loading state (skeleton)
- Error state (error message)

### 9. CaseDetailsPanel Integration ⏳
**File**: `frontend/src/features/cases/CaseDetailsPanel.tsx`

**TODO**:
- Import ExecutiveSummary component
- Add state: `const [executiveSummary, setExecutiveSummary] = useState(null)`
- Add useEffect to load summary when case changes
- Add auto-refresh on `decision_intelligence_updated` events (reuse Phase 7.5 pattern)
- Add ExecutiveSummary card to layout (before/after existing panels)

## Testing

### Backend Tests ⏳
**File**: `tests/test_phase7_6_executive_summary.py`

**TODO**: Test scenarios:
1. Low confidence + missing gaps → unknowns populated, actions include request info
2. Bias single-source → risk + action present
3. High confidence + no gaps → headline "Ready for decision", minimal actions
4. Endpoint returns stable deterministic ordering
5. Caching: executive_summary_json stored after recompute
6. On-the-fly generation when cache missing

### Manual Verification ⏳
1. Start servers: `HITL: Run Demo (Servers)` task
2. Create case → Upload evidence
3. Check `/executive-summary` endpoint → Verify JSON structure
4. Frontend: Verify summary card displays
5. Upload more evidence → Verify summary auto-updates

## Files Changed

### Backend (Created)
- ✅ `backend/app/intelligence/narrative.py` (430 lines)
- ✅ `backend/scripts/migrate_add_executive_summary.py` (65 lines)

### Backend (Modified)
- ✅ `backend/app/intelligence/models.py` (+1 field)
- ✅ `backend/app/intelligence/repository.py` (+40 lines - UPDATE/INSERT/SELECT/helper)
- ✅ `backend/app/intelligence/service.py` (+120 lines - executive summary generation)
- ✅ `backend/app/intelligence/router.py` (+150 lines - GET /executive-summary endpoint)

### Frontend (Pending)
- ⏳ `frontend/src/api/intelligenceApi.ts` (add getExecutiveSummary)
- ⏳ `frontend/src/features/intelligence/ExecutiveSummary.tsx` (new component)
- ⏳ `frontend/src/features/cases/CaseDetailsPanel.tsx` (wire in component)

### Tests (Pending)
- ⏳ `backend/tests/test_phase7_6_executive_summary.py`

## Commands

### Run Migration
```powershell
cd backend
.\.venv\Scripts\python.exe scripts\migrate_add_executive_summary.py
```
**Status**: ✅ Completed

### Run Backend Tests (when created)
```powershell
cd backend
.\.venv\Scripts\python.exe -m pytest tests/test_phase7_6_executive_summary.py -v
```

### Test API Endpoint
```powershell
# Start backend
cd backend
.\.venv\Scripts\python.exe -m uvicorn src.api.main:app --reload --host 127.0.0.1 --port 8001

# Test endpoint (separate terminal)
$caseId = "case-xyz"
$response = Invoke-RestMethod -Uri "http://127.0.0.1:8001/workflow/cases/$caseId/executive-summary" -Method GET
$response | ConvertTo-Json -Depth 5
```

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│ Backend: Auto-Trigger Recompute (Phase 7.5)                    │
│ - User uploads evidence                                         │
│ - lifecycle.py auto_recompute_on_signal_change()                │
│ - service.recompute_case_intelligence()                         │
│   ├─ Generate signals                                           │
│   ├─ Compute v2 intelligence (gaps, bias, confidence)           │
│   ├─ Generate executive summary (NEW Phase 7.6) ←              │
│   │   └─ narrative.build_executive_summary()                    │
│   │       └─ Cache JSON to decision_intelligence table          │
│   └─ Emit decision_intelligence_updated event                   │
└─────────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ Backend: GET /executive-summary Endpoint (Phase 7.6)           │
│ - Check decision_intelligence.executive_summary_json            │
│ - If cached: Parse JSON and return                             │
│ - If missing: Generate on-the-fly, cache, return               │
└─────────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ Frontend: ExecutiveSummary Component (PENDING)                 │
│ - Load via API: getExecutiveSummary(caseId)                    │
│ - Auto-refresh on decision_intelligence_updated events          │
│ - Display: headline, confidence, 4 bullet sections, badges      │
└─────────────────────────────────────────────────────────────────┘
```

## Executive Summary Schema Example

```json
{
  "headline": "Needs review - Evidence gaps require attention",
  "what_we_know": [
    "Primary submission completed with all required fields",
    "Supporting evidence attached: License verification document"
  ],
  "what_we_dont_know": [
    "Missing required evidence: Employer verification letter",
    "Waiting on submitter response to information request"
  ],
  "risks": [
    "Single source reliance - Validation with secondary source recommended",
    "Critical evidence gaps may impact decision reliability"
  ],
  "recommended_next_actions": [
    "Request missing evidence: Employer verification letter",
    "Follow up on outstanding information request by due date",
    "Validate findings with secondary independent source"
  ],
  "confidence": {
    "score": 62.5,
    "band": "MEDIUM"
  },
  "badges": [
    "Bias Detected",
    "Critical Gaps"
  ]
}
```

## Next Steps

1. ⏳ Create backend tests (`test_phase7_6_executive_summary.py`)
2. ⏳ Add frontend API client function (`getExecutiveSummary`)
3. ⏳ Create ExecutiveSummary component
4. ⏳ Wire into CaseDetailsPanel with auto-refresh
5. ⏳ Manual verification (5-step checklist)

---

**Phase 7.6 Backend Status**: ✅ **COMPLETE**  
**Phase 7.6 Frontend Status**: ⏳ **PENDING**  
**Date**: 2026-01-15  
**Backend Files**: 6 files (2 created, 4 modified)  
**Migration**: ✅ Completed  
**API Endpoint**: ✅ `/workflow/cases/{caseId}/executive-summary`
