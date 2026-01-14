# Review Queue - Quick Start Guide

## Access the Review Queue

### 1. Enable Admin Mode
Navigate to: **http://localhost:5173/console?admin=true**

- Admin badge appears (amber shield icon)
- "Open Review Queue" button appears on dashboard

### 2. Open Review Queue
Click the **"Open Review Queue"** button on the dashboard

Or navigate directly to: **http://localhost:5173/console/review-queue**

## Submit a Test CSF

1. Go to Hospital CSF: **http://localhost:5173/csf/hospital**
2. Fill out the form:
   - Hospital Name: "Test Hospital"
   - Account Number: "ACCT-12345"
   - Ship to State: "OH"
   - ✓ Attestation Accepted
3. Click **"Submit CSF"**
4. Return to Review Queue

## Reviewer Actions

### Start Review
- **Status:** submitted
- **Button:** [Start Review]
- **Action:** Changes status to `in_review`
- **Result:** Buttons change to Approve/Reject

### Approve Submission
- **Status:** in_review
- **Button:** [Approve]
- **Action:** Changes status to `approved`
- **Result:** Item disappears from queue (approved items filtered out)

### Reject Submission
- **Status:** in_review
- **Button:** [Reject]
- **Action:** Changes status to `rejected`
- **Result:** Item disappears from queue

### Add Reviewer Notes
- **Button:** [Notes] (available for all items)
- **Action:** Opens modal to add/edit notes
- **Input:** Free text (e.g., "Verified all required fields")
- **Result:** Notes saved to submission record

## URL Routes

| Route | Description |
|-------|-------------|
| `/console` | Compliance Console dashboard (read-only widget) |
| `/console?admin=true` | Enable admin mode via URL |
| `/console/review-queue` | Dedicated review queue page (requires admin) |

## Status Flow

```
submitted → [Start Review] → in_review → [Approve/Reject] → approved/rejected
                                 ↓
                             [Notes] (any time)
```

## Testing Workflow

1. **Enable admin:** `?admin=true`
2. **Submit CSF:** Hospital CSF sandbox
3. **Open queue:** Click "Open Review Queue"
4. **Start review:** Click [Start Review]
5. **Add notes:** Click [Notes], enter "Test notes", save
6. **Approve:** Click [Approve]
7. **Verify:** Item disappears (approved)

## Common Issues

| Issue | Solution |
|-------|----------|
| Button not visible | Enable admin mode: `?admin=true` |
| "Admin Mode Required" | Return to console with `?admin=true` |
| Actions not working | Check backend is running on port 8001 |
| Item still visible after approve | Refresh page - approved items filter out |

## Backend API

**Fetch Queue:**
```bash
curl http://localhost:8001/console/work-queue?status=submitted,in_review
```

**Update Status:**
```bash
curl -X PATCH http://localhost:8001/console/work-queue/{id} \
  -H "Content-Type: application/json" \
  -d '{"status": "approved", "reviewed_by": "admin"}'
```

## Development Servers

**Backend:**
```powershell
cd backend
.\.venv\Scripts\python -m uvicorn src.api.main:app --reload --port 8001
```

**Frontend:**
```powershell
cd frontend
npm run dev
```

---

**Quick Test:** 3 minutes from cold start to approved submission  
**Admin Mode:** Required for all reviewer actions  
**Status Filter:** Queue shows only `submitted` and `in_review` items
