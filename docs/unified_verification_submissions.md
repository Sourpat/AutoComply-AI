# Unified Verification Submissions System

## Overview

This system connects all CSF/License submission flows to the Compliance Console with real-time data fetching and unique trace replay for each submission.

## Backend Architecture

### Submissions Store (`backend/src/autocomply/domain/submissions_store.py`)

**Central in-memory store** for tracking verification submissions across all CSF types (Practitioner, Hospital, Facility, EMS, Researcher).

**Key Components:**
- `Submission` model (Pydantic) with fields:
  - `submission_id`: UUID
  - `csf_type`: practitioner|hospital|facility|ems|researcher
  - `tenant`: tenant identifier
  - `status`: submitted|in_review|approved|rejected|blocked
  - `priority`: low|medium|high
  - `created_at`, `updated_at`: ISO timestamps
  - `title`, `subtitle`, `summary`: human-readable descriptions
  - `trace_id`: linked trace for replay
  - `payload`: original submission data
  - `decision_status`, `risk_level`: decision metadata

- `SubmissionStore` class:
  - `create_submission()`: Add new submission
  - `get_submission(id)`: Retrieve by ID
  - `list_submissions(tenant, status, limit)`: Query with filters
  - `update_submission_status()`: Update status
  - `get_statistics()`: Counts by status/priority

- Global singleton: `get_submission_store()`

**Design:** Structured for easy migration to PostgreSQL/MongoDB. Currently in-memory dict, thread-safe for single-process.

### Console API (`backend/src/api/routes/console.py`)

**Endpoints:**
- `GET /console/work-queue?tenant=...&status=submitted,in_review`
  - Returns submissions sorted by `created_at` desc (newest first)
  - Response includes `items` (submissions), `statistics`, `total`
  
- `GET /console/submissions/{submission_id}`
  - Get specific submission by ID

### CSF Submit Endpoints

All CSF types now have unified submit endpoints:

- `POST /csf/practitioner/submit`
- `POST /csf/hospital/submit`
- `POST /csf/facility/submit`
- `POST /csf/ems/submit`
- `POST /csf/researcher/submit`

**Flow:**
1. Evaluate CSF using decision engine
2. Generate `trace_id` via `generate_trace_id()`
3. Determine priority based on decision status (blocked → HIGH)
4. Create human-readable title/subtitle
5. Call `store.create_submission()` with payload
6. Return `SubmissionResponse` with `submission_id`, `trace_id`, `status`

**Example Titles/Subtitles:**
- Title: "Practitioner CSF – Dr. John Smith"
- Subtitle: "Blocked: DEA registration expired"

---

## Frontend Integration

### Compliance Console (`frontend/src/pages/ConsoleDashboard.tsx`)

**Real-time Data Fetching:**
- `useEffect` hook fetches from `GET /console/work-queue` on mount
- Auto-refresh every 30 seconds
- Transforms backend `Submission[]` to `WorkQueueItem[]` format
- Calculates human-readable age ("Flagged 2 days ago")
- Maps priority to color classes

**Loading States:**
- **Loading:** Shows "Loading work queue..." spinner
- **Error:** Shows error message, falls back to mock data
- **Empty:** Shows "No items in verification queue"
- **Success:** Renders work queue items from API

**Trace Replay:**
- Each item has unique `trace_id`
- Clicking "Open trace" opens drawer with correct trace
- Uses existing `TRACE_REPLAYS` mapping (still mock)
- Future: Fetch trace from `GET /trace/{trace_id}` endpoint

---

## Testing

### Backend Testing

**Test Coverage Needed:**
1. Submit practitioner CSF → appears in `/console/work-queue`
2. Submit facility CSF → appears in `/console/work-queue`
3. Submit hospital/ems/researcher → appears in queue
4. Filter by tenant works
5. Filter by status works
6. Statistics counts are accurate

**Example Test:**
```python
def test_practitioner_submit_appears_in_console(client):
    # Submit practitioner CSF
    response = client.post("/csf/practitioner/submit", json={
        "account_number": "TEST-001",
        # ... form data
    })
    assert response.status_code == 200
    submission_id = response.json()["submission_id"]
    
    # Fetch work queue
    queue_response = client.get("/console/work-queue")
    assert queue_response.status_code == 200
    items = queue_response.json()["items"]
    
    # Verify submission appears
    assert any(item["submission_id"] == submission_id for item in items)
```

### Frontend Testing

**Manual Test Flow:**
1. Start backend: `uvicorn src.api.main:app --reload`
2. Start frontend: `npm run dev`
3. Open Compliance Console: `http://localhost:5173/console`
4. Verify: "Loading work queue..." shows briefly
5. If backend running: Real submissions appear
6. If backend down: Falls back to mock data with error message
7. Submit from Practitioner sandbox → Refresh console → New item appears
8. Click "Open trace" → Drawer opens with trace_id

**Automated Testing (Future):**
```typescript
describe('Compliance Console Work Queue', () => {
  it('fetches and displays real submissions', async () => {
    render(<ConsoleDashboard />);
    await waitFor(() => {
      expect(screen.getByText(/Practitioner CSF/i)).toBeInTheDocument();
    });
  });
  
  it('shows loading state while fetching', () => {
    render(<ConsoleDashboard />);
    expect(screen.getByText(/Loading work queue/i)).toBeInTheDocument();
  });
});
```

---

## Migration Path

### Current State (v1 - In-Memory)
- ✅ Submissions stored in `SubmissionStore` (in-memory dict)
- ✅ Survives single-process restarts (data lost on server restart)
- ✅ Fast, no database dependencies
- ⚠️ Data lost on restart
- ⚠️ Not shared across processes (no horizontal scaling)

### Future (v2 - Database-Backed)

**Option A: PostgreSQL with SQLAlchemy**
```python
# Replace SubmissionStore with SQLAlchemy model
class Submission(Base):
    __tablename__ = "submissions"
    
    submission_id = Column(String, primary_key=True)
    csf_type = Column(String, nullable=False)
    # ... other columns
```

**Option B: MongoDB**
```python
# Replace with pymongo client
submissions_collection = db["submissions"]
submissions_collection.insert_one(submission.dict())
```

**Migration Steps:**
1. Create database schema/collection
2. Update `SubmissionStore` methods to use DB queries
3. Add connection pooling, error handling
4. Migrate existing data (if needed)
5. Update tests to use test database

---

## API Response Examples

### GET /console/work-queue
```json
{
  "items": [
    {
      "submission_id": "a1b2c3d4-...",
      "csf_type": "practitioner",
      "tenant": "practitioner-default",
      "status": "submitted",
      "priority": "high",
      "created_at": "2025-12-21T15:30:00Z",
      "updated_at": "2025-12-21T15:30:00Z",
      "title": "Practitioner CSF – Dr. John Smith",
      "subtitle": "Blocked: DEA registration expired",
      "trace_id": "f7e8d9c0-...",
      "payload": { /* form + decision data */ },
      "decision_status": "blocked",
      "risk_level": "High"
    }
  ],
  "statistics": {
    "total": 1,
    "by_status": { "submitted": 1 },
    "by_priority": { "high": 1 }
  },
  "total": 1
}
```

### POST /csf/practitioner/submit Response
```json
{
  "submission_id": "a1b2c3d4-...",
  "status": "submitted",
  "created_at": "2025-12-21T15:30:00Z",
  "decision_status": "blocked",
  "reason": "DEA registration expired"
}
```

---

## Summary

**Backend:**
- ✅ Unified `submissions_store.py` for all CSF types
- ✅ Console API endpoints (`/console/work-queue`, `/console/submissions/{id}`)
- ✅ All CSF submit endpoints updated (practitioner, hospital, facility, ems, researcher)
- ✅ Each submission gets unique `trace_id` for replay
- ✅ Structured for future database migration

**Frontend:**
- ✅ ConsoleDashboard fetches real data from API
- ✅ Auto-refresh every 30 seconds
- ✅ Loading/error/empty states
- ✅ Fallback to mock data on error
- ✅ Each "Open trace" button uses unique `trace_id`

**Next Steps:**
1. Add backend tests for console endpoints
2. Implement `GET /trace/{trace_id}` endpoint for dynamic trace fetching
3. Update frontend to fetch traces from backend instead of static mapping
4. Add "View in Console" button to sandbox submit confirmations
5. Migrate to database backend (PostgreSQL/MongoDB)
