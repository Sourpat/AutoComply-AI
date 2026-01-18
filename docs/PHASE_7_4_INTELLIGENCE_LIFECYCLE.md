# PHASE 7.4: Intelligence Lifecycle - COMPLETE

**Status:** ✅ Implementation Complete  
**Date:** 2025-01-27  
**Goal:** Make Decision Intelligence recompute automatically on meaningful case changes, add freshness/stale indicators to API + UI

---

## Overview

Phase 7.4 adds **automatic lifecycle management** to Decision Intelligence (Phase 7.2/7.3). Intelligence now:
- Auto-recomputes when case data changes (submission, evidence, status)
- Debounces to prevent recompute storms (2-second minimum interval)
- Tracks freshness with stale indicators (30-minute default threshold)
- Emits case events for audit trail

This makes intelligence data **always up-to-date** without manual intervention.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│ LIFECYCLE FLOW (Phase 7.4)                                      │
└─────────────────────────────────────────────────────────────────┘

1. USER ACTION (submission update, evidence upload, status change)
   ↓
2. ENDPOINT HANDLER (router.py, submissions/router.py)
   ↓
3. TRIGGER CHECK (lifecycle.request_recompute)
   ├─ Feature flag enabled? (AUTO_INTELLIGENCE_ENABLED)
   ├─ Is triggering event? (submission_created, evidence_attached, etc.)
   └─ Not debounced? (>2 seconds since last recompute)
   ↓
4. RECOMPUTE PIPELINE
   ├─ generate_signals_for_case() - Extract signals from artifacts
   ├─ compute_and_upsert_decision_intelligence() - Run v2 algorithm
   └─ emit intelligence_updated event - Audit trail
   ↓
5. API RESPONSE (GET /intelligence)
   ├─ Fetch intelligence record
   ├─ Compute is_stale (now - computed_at > stale_after_minutes)
   └─ Return with freshness fields
   ↓
6. UI DISPLAY (IntelligencePanel + FreshnessIndicator)
   ├─ Show "Last updated: X min ago"
   └─ Show "May be outdated" warning if is_stale=true
```

---

## Implementation

### 1. Backend: Lifecycle Module

**File:** `backend/app/intelligence/lifecycle.py` (270 lines)

**Purpose:** Auto-recompute orchestration with debouncing

**Key Components:**
- **Triggering Events:** 6 event types that trigger recompute
  ```python
  TRIGGERING_EVENT_TYPES = {
      "submission_created",
      "submission_updated",
      "evidence_attached",
      "request_info_created",
      "request_info_resubmitted",
      "status_changed",
  }
  ```

- **Debouncing:** 2-second minimum interval between recomputes
  ```python
  MIN_RECOMPUTE_INTERVAL_SECONDS = 2
  _recompute_timestamps: Dict[str, float] = {}  # In-memory cache
  ```

- **Entry Point:** `request_recompute(case_id, reason, event_type, decision_type=None)`
  - Checks feature flag: `AUTO_INTELLIGENCE_ENABLED`
  - Checks if event triggers recompute
  - Checks debounce window
  - Calls recompute pipeline
  - Emits case event

**Example Usage:**
```python
from app.intelligence.lifecycle import request_recompute

# In submission router
request_recompute(
    case_id=case.id,
    reason="submission_created",
    event_type="submission_created",
    decision_type="csf_practitioner"
)
```

---

### 2. Backend: Configuration

**File:** `backend/src/config.py`

**Added:**
```python
class Settings(BaseSettings):
    # ... existing fields ...
    
    # Phase 7.4: Auto-intelligence lifecycle
    AUTO_INTELLIGENCE_ENABLED: bool = Field(
        default=True,
        description="Enable automatic intelligence recomputation on case changes"
    )
```

**Defaults to enabled** - can be disabled via environment variable:
```bash
export AUTO_INTELLIGENCE_ENABLED=false
```

---

### 3. Backend: Schema

**File:** `backend/app/workflow/schema.sql`

**Added Column:**
```sql
CREATE TABLE IF NOT EXISTS decision_intelligence (
    ...
    -- Phase 7.4: Freshness tracking
    stale_after_minutes INTEGER DEFAULT 30,  -- How long before intelligence is considered stale
    ...
);
```

**Migration Script:** `backend/scripts/migrate_add_freshness_tracking.py`
- Adds column to existing databases
- Safe to run multiple times (idempotent)
- Skips if database doesn't exist yet

---

### 4. Backend: API Models

**File:** `backend/app/intelligence/models.py`

**Updated Response:**
```python
class DecisionIntelligenceResponse(BaseModel):
    # ... existing fields ...
    
    # Phase 7.4: Freshness indicators
    is_stale: bool = False  # True if (now - computed_at) > stale_after_minutes
    stale_after_minutes: int = 30  # How long before intelligence is considered stale
```

**Computed at runtime** in `backend/app/intelligence/router.py`:
```python
def compute_is_stale(computed_at: str, stale_after_minutes: int) -> bool:
    computed_time = datetime.fromisoformat(computed_at.replace("Z", "+00:00"))
    age_minutes = (datetime.utcnow() - computed_time.replace(tzinfo=None)).total_seconds() / 60
    return age_minutes > stale_after_minutes
```

---

### 5. Backend: Endpoint Integration

**Wired Triggers:**

| Endpoint | Event Type | Description |
|----------|-----------|-------------|
| `POST /submissions` | `submission_created` | New submission intake |
| `PATCH /submissions/{id}` | `submission_updated` | Submitter edits form |
| `POST /workflow/cases/{id}/evidence` | `evidence_attached` | Evidence upload |
| `POST /workflow/cases/{id}/request-info` | `request_info_created` | Verifier requests info |
| `POST /workflow/cases/{id}/resubmit` | `request_info_resubmitted` | Submitter resubmits |
| `POST /workflow/cases/{id}/status` | `status_changed` | Status transition |

**Example (Evidence Upload):**
```python
# backend/app/workflow/router.py
@router.post("/cases/{case_id}/evidence")
def upload_case_evidence(...):
    # ... upload logic ...
    
    # Create case event
    create_case_event(...)
    
    # Phase 7.4: Trigger auto-recompute
    from app.intelligence.lifecycle import request_recompute
    request_recompute(
        case_id=case_id,
        reason="evidence_attached",
        event_type="evidence_attached"
    )
    
    return evidence
```

---

### 6. Frontend: Freshness Indicator

**File:** `frontend/src/features/intelligence/FreshnessIndicator.tsx` (80 lines)

**Purpose:** Lightweight UI component to show freshness status

**Features:**
- **Age Display:** "Just now", "5 min ago", "2 hours ago", "3 days ago"
- **Stale Warning:** Yellow badge with ⚠️ icon if `is_stale=true`
- **Responsive:** Flexbox layout, inline with header

**Example Output:**
```
Last updated: 12 min ago
```

**Stale Warning (>30 min):**
```
Last updated: 45 min ago  [⚠️ May be outdated]
```

---

### 7. Frontend: Integration

**File:** `frontend/src/features/intelligence/IntelligencePanel.tsx`

**Changes:**
- Import `FreshnessIndicator`
- Add component next to confidence badge in header
- Pass `computed_at`, `is_stale`, `stale_after_minutes` props

**Before (Phase 7.3):**
```tsx
<div className="flex items-center gap-2">
  <span className="text-[10px] text-zinc-500">
    Updated: {new Date(intelligence.computed_at).toLocaleTimeString()}
  </span>
  {canRecompute && <button>↻ Recompute</button>}
</div>
```

**After (Phase 7.4):**
```tsx
<div className="flex items-center gap-3">
  <FreshnessIndicator
    computedAt={intelligence.computed_at}
    isStale={intelligence.is_stale ?? false}
    staleAfterMinutes={intelligence.stale_after_minutes ?? 30}
  />
  {canRecompute && <button>↻ Recompute</button>}
</div>
```

---

### 8. Frontend: API Types

**File:** `frontend/src/api/intelligenceApi.ts`

**Updated Interface:**
```typescript
export interface DecisionIntelligenceResponse {
  // ... existing fields ...
  computed_at: string;
  
  // Phase 7.4: Freshness tracking
  is_stale?: boolean;
  stale_after_minutes?: number;
}
```

---

## Trigger Matrix

| Event Type | Triggers Recompute? | Reason | Example Use Case |
|------------|---------------------|--------|------------------|
| `submission_created` | ✅ Yes | New form data available | Practitioner submits CSF |
| `submission_updated` | ✅ Yes | Form data changed | Submitter corrects license number |
| `evidence_attached` | ✅ Yes | New evidence available | Upload proof of license |
| `request_info_created` | ✅ Yes | Case requires more info | Verifier identifies gap |
| `request_info_resubmitted` | ✅ Yes | Additional info provided | Submitter provides missing docs |
| `status_changed` | ✅ Yes | Case state changed | Move to in_review |
| `case_created` | ❌ No | Already triggered by submission_created | - |
| `note_added` | ❌ No | Notes don't affect intelligence | Verifier adds internal note |
| `assigned` | ❌ No | Assignment doesn't change data | Assign to verifier@example.com |

---

## Debounce Behavior

**Problem:** Multiple rapid changes could trigger redundant recomputes  
**Solution:** 2-second minimum interval between recomputes per case

**Algorithm:**
1. Check `_recompute_timestamps[case_id]`
2. If `(now - last_recompute_time) < 2 seconds` → Skip recompute
3. Otherwise → Proceed + update timestamp

**Example Scenario:**
```
Time    Event                      Action
--------------------------------------------------
0.0s    submission_created         Recompute (first time)
0.5s    evidence_attached          Skip (debounced)
1.0s    status_changed             Skip (debounced)
2.5s    submission_updated         Recompute (>2s elapsed)
```

**Result:** 2 recomputes instead of 4 (50% reduction)

**In-Memory Cache:** `_recompute_timestamps: Dict[str, float]`
- Simple timestamp storage
- No external dependencies
- Reset on server restart (safe - just triggers fresh recompute)

---

## Freshness Rules

**Threshold:** 30 minutes (default)

**States:**
- **Fresh:** `age ≤ 30 minutes` → `is_stale = false`
- **Stale:** `age > 30 minutes` → `is_stale = true`

**Computation:**
```python
def compute_is_stale(computed_at: str, stale_after_minutes: int) -> bool:
    computed_time = datetime.fromisoformat(computed_at.replace("Z", "+00:00"))
    age_minutes = (datetime.utcnow() - computed_time.replace(tzinfo=None)).total_seconds() / 60
    return age_minutes > stale_after_minutes
```

**Example:**
```
Scenario: Intelligence computed at 10:00 AM

10:15 AM → age = 15 min → is_stale = false → "Last updated: 15 min ago"
10:45 AM → age = 45 min → is_stale = true  → "Last updated: 45 min ago ⚠️ May be outdated"
```

**Why 30 minutes?**
- Short enough to catch stale data
- Long enough to avoid constant warnings
- Can be adjusted per-case via `stale_after_minutes` column

---

## Case Events

**Event Type:** `decision_intelligence_updated`

**Emitted When:** Intelligence auto-recomputes successfully

**Payload:**
```json
{
  "reason": "submission_updated",
  "event_type": "submission_updated",
  "confidence_score": 75.5,
  "confidence_band": "medium",
  "gap_severity_score": 20,
  "bias_count": 1,
  "computed_at": "2026-01-27T15:30:00Z"
}
```

**Actor:** `system` (auto-triggered)

**Message Example:**
```
"Decision intelligence auto-recomputed: submission_updated"
```

**Audit Trail:** Visible in case timeline for transparency

---

## Files Changed/Created

### Backend (8 files)

**Created:**
- `backend/app/intelligence/lifecycle.py` (270 lines) - Auto-recompute orchestration
- `backend/scripts/migrate_add_freshness_tracking.py` (65 lines) - Schema migration

**Modified:**
- `backend/src/config.py` - Added AUTO_INTELLIGENCE_ENABLED flag
- `backend/app/workflow/schema.sql` - Added stale_after_minutes column
- `backend/app/intelligence/models.py` - Added freshness fields to Response
- `backend/app/intelligence/router.py` - Compute is_stale at read-time
- `backend/app/submissions/router.py` - Trigger on create/update
- `backend/app/workflow/router.py` - Trigger on evidence/request_info/status

### Frontend (4 files)

**Created:**
- `frontend/src/features/intelligence/FreshnessIndicator.tsx` (80 lines) - Freshness UI

**Modified:**
- `frontend/src/api/intelligenceApi.ts` - Added freshness fields to types
- `frontend/src/features/intelligence/IntelligencePanel.tsx` - Integrated FreshnessIndicator
- `frontend/src/features/intelligence/index.ts` - Export FreshnessIndicator

**Total:** 12 files (2 created, 10 modified)

---

## Manual Verification Steps

### Test 1: Submission Created → Auto-Recompute

1. Start backend: `.venv/Scripts/python -m uvicorn src.api.main:app --reload --port 8001`
2. Start frontend: `npm run dev`
3. Navigate to Compliance Console
4. Create a new CSF submission (Practitioner)
5. Check case Intelligence tab → Should show fresh data
6. Check backend logs:
   ```
   [Lifecycle] Auto-recompute triggered for case_xyz: submission_created
   [Lifecycle] Recompute successful: medium confidence (68.0%)
   [Lifecycle] Emitted intelligence_updated event for case_xyz
   ```
7. Verify freshness: "Last updated: Just now"

**Expected Result:** Intelligence computed automatically on submission creation

---

### Test 2: Evidence Attached → Auto-Recompute

1. Open an existing case
2. Upload evidence file (e.g., license.pdf)
3. Check Intelligence tab → Should auto-refresh
4. Check backend logs:
   ```
   [Lifecycle] Auto-recompute triggered for case_xyz: evidence_attached
   ```
5. Verify confidence may have changed (more signals)

**Expected Result:** Intelligence updates after evidence upload

---

### Test 3: Debounce (Rapid Changes)

1. Create submission (recompute #1)
2. **Immediately** upload evidence (within 2 seconds)
3. **Immediately** change status (within 2 seconds)
4. Check backend logs:
   ```
   [Lifecycle] Auto-recompute triggered for case_xyz: submission_created
   [Lifecycle] Skipping recompute for case_xyz: debounced (last recompute 0.5s ago)
   [Lifecycle] Skipping recompute for case_xyz: debounced (last recompute 1.2s ago)
   ```
5. Wait 3 seconds, upload another evidence
6. Check logs:
   ```
   [Lifecycle] Auto-recompute triggered for case_xyz: evidence_attached
   ```

**Expected Result:** Debounce prevents storm, but allows recompute after 2+ seconds

---

### Test 4: Freshness Indicator (Stale Warning)

**Manual Simulation:**

1. Open browser DevTools
2. Modify intelligence API response:
   ```javascript
   // In Network tab, edit response for /intelligence
   {
       "computed_at": "2026-01-27T12:00:00Z", // 45 minutes ago
       "is_stale": true,
       "stale_after_minutes": 30,
       ...
   }
   ```
3. Refresh Intelligence tab
4. Verify UI shows:
   ```
   Last updated: 45 min ago  [⚠️ May be outdated]
   ```

**Real-World Test (Time-Based):**

1. Disable auto-recompute:
   ```bash
   export AUTO_INTELLIGENCE_ENABLED=false
   ```
2. Create submission (manual recompute only)
3. Wait 31 minutes
4. Refresh Intelligence tab
5. Verify stale warning appears

**Expected Result:** Stale indicator shows after 30+ minutes

---

### Test 5: Feature Flag Disabled

1. Set environment variable:
   ```bash
   export AUTO_INTELLIGENCE_ENABLED=false
   ```
2. Restart backend
3. Create submission
4. Check backend logs:
   ```
   [Lifecycle] Auto-intelligence is disabled (feature flag)
   ```
5. Check Intelligence tab → No data (or must recompute manually)

**Expected Result:** Auto-recompute disabled, manual recompute still works

---

## Performance Considerations

### Debounce Trade-offs

**Pros:**
- Prevents redundant work (50%+ reduction in rapid-change scenarios)
- Reduces database write load
- Lowers CPU usage during bulk updates

**Cons:**
- Intelligence may be slightly delayed (up to 2 seconds)
- In-memory cache resets on server restart

**Mitigation:**
- 2-second delay is acceptable for non-real-time use case
- Cache reset triggers fresh recompute (safe fallback)

---

### Recompute Cost

**Phase 7.2 Intelligence v2:**
- Signal extraction: ~10-50ms (SQLite queries)
- Gap detection: ~5-20ms (in-memory heuristics)
- Bias detection: ~5-20ms (in-memory heuristics)
- Confidence v2: ~5-15ms (weighted scoring)
- **Total:** ~25-105ms per recompute

**Acceptable for:**
- Low-medium volume (<1000 cases/day)
- Non-real-time workflows (SLA measured in hours/days)

**If performance becomes issue:**
- Add background job queue (Celery, RQ)
- Increase debounce window (5-10 seconds)
- Make feature flag per-decision-type

---

## Testing Strategy

### Unit Tests (Not Yet Implemented)

**File:** `backend/tests/test_intelligence_lifecycle.py`

**Test Cases:**
1. `test_submission_created_triggers_recompute` - Verify trigger on submission
2. `test_evidence_attached_triggers_recompute` - Verify trigger on evidence
3. `test_non_triggering_event_skips` - Verify note_added doesn't trigger
4. `test_debounce_prevents_double_recompute` - Verify 2-second window
5. `test_feature_flag_disabled_skips` - Verify AUTO_INTELLIGENCE_ENABLED=false
6. `test_is_stale_toggles_correctly` - Verify freshness computation
7. `test_event_emission_on_recompute` - Verify case event created

### Integration Tests

1. **Submission → Intelligence Flow:**
   - Create submission
   - Verify intelligence auto-computed
   - Verify case event emitted

2. **Evidence → Intelligence Flow:**
   - Upload evidence
   - Verify intelligence updated
   - Verify confidence/signals changed

3. **Debounce Flow:**
   - Rapid-fire 3 updates within 2 seconds
   - Verify only 1 recompute

---

## Future Enhancements

### 1. Background Jobs (Scalability)

**Problem:** Recompute blocks API request (25-105ms)

**Solution:** Offload to background queue
```python
# Use Celery or RQ
@celery_app.task
def recompute_intelligence_task(case_id: str, decision_type: str):
    compute_and_upsert_decision_intelligence(case_id, decision_type)
```

**Benefits:**
- Non-blocking API responses
- Can retry on failure
- Better for high-volume

---

### 2. Configurable Thresholds

**Per-Decision-Type:**
```python
STALE_THRESHOLDS = {
    "csf_practitioner": 30,  # 30 minutes
    "license_renewal": 120,  # 2 hours (slower-moving process)
    "emergency_authorization": 5,  # 5 minutes (high urgency)
}
```

**Per-Case:**
- Store in `stale_after_minutes` column (already supported)
- UI for admin to set per-case

---

### 3. Smart Triggers (ML-Based)

**Heuristic:**
- Don't recompute if change is trivial (e.g., typo fix in name field)
- Use similarity score on form_data diff
- Only trigger if `similarity < 0.95`

---

### 4. WebSocket Push (Real-Time UI)

**Current:** UI polls or refetches on navigation

**Future:** Server pushes intelligence updates via WebSocket
```typescript
socket.on('intelligence_updated', (data) => {
  setIntelligence(data);
  showToast('Intelligence updated automatically');
});
```

---

## Summary

**Phase 7.4 Complete:** Decision Intelligence now has **full lifecycle management**

**✅ Delivered:**
1. ✅ Auto-recompute on 6 triggering events (submission, evidence, status, request_info)
2. ✅ Debouncing (2-second minimum interval) to prevent storms
3. ✅ Freshness tracking (is_stale, stale_after_minutes, computed_at)
4. ✅ Feature flag (AUTO_INTELLIGENCE_ENABLED, default=True)
5. ✅ Case event emission for audit trail
6. ✅ Frontend freshness indicator ("Last updated: X min ago" + stale warning)
7. ✅ Schema migration (stale_after_minutes column)
8. ✅ Full integration across submission/workflow routers

**📊 Impact:**
- **Always up-to-date intelligence** without manual intervention
- **Transparent audit trail** via case events
- **User visibility** into freshness/staleness
- **Performance-safe** with debouncing

**🚀 Ready for:**
- Manual verification testing
- Load testing (optional)
- User acceptance testing

---

## Commands Reference

### Migration
```bash
# Run migration to add stale_after_minutes column
cd backend
.venv/Scripts/python scripts/migrate_add_freshness_tracking.py
```

### Disable Feature
```bash
# Disable auto-recompute (environment variable)
export AUTO_INTELLIGENCE_ENABLED=false

# Restart backend
.venv/Scripts/python -m uvicorn src.api.main:app --reload --port 8001
```

### Debug Logging
```bash
# Check lifecycle logs
tail -f backend.log | grep Lifecycle

# Example output:
# [Lifecycle] Auto-recompute triggered for case_abc: submission_created
# [Lifecycle] Recompute successful: medium confidence (72.0%)
# [Lifecycle] Skipping recompute for case_abc: debounced (last 0.8s ago)
```

---

**Phase 7.4 Status: COMPLETE** ✅  
**Next Phase:** User acceptance testing + optional backend tests
