# Quick Reference - Reviewer Actions

## 🚀 Quick Start

### Enable Admin Mode (Browser Console)
```javascript
localStorage.setItem('admin_unlocked', 'true');
location.reload();
```

### Navigate to Work Queue
1. Open http://localhost:5173
2. Click "Compliance Console" in sidebar
3. Work queue loads automatically

---

## 📊 Status Workflow

```
submitted → in_review → approved/rejected
```

- **submitted**: New CSF awaiting review
- **in_review**: Reviewer is actively checking
- **approved**: Final approval, `reviewed_at` set
- **rejected**: Final rejection, `reviewed_at` set

---

## 🎯 Action Buttons (Admin Only)

| Button | From Status | To Status | Notes |
|--------|------------|-----------|-------|
| **Start Review** | submitted | in_review | Begin reviewing |
| **Approve** | in_review | approved | Sets `reviewed_at` |
| **Reject** | in_review | rejected | Sets `reviewed_at` |
| **Notes** | any | any | Add/edit reviewer notes |

---

## 🔍 Filter Chips

- **All** - Show all submissions
- **Submitted** - Show only new items
- **In Review** - Show items being reviewed
- **Approved** - Show approved items
- **Rejected** - Show rejected items

Each chip shows the count: `Submitted (5)`

---

## 🔐 Admin Protection

### Admin View
- All action buttons visible
- Can edit notes
- Can change status
- Full functionality

### Non-Admin View
- Read-only access
- "Admin access required" message
- Can view notes but not edit
- Warning badge: "⚠️ Read-only (Admin unlock required)"

---

## 📝 Reviewer Notes

### Add/Edit Notes
1. Click **Notes** button on any submission
2. Type notes in textarea
3. Click **Save Notes**
4. Notes persist across status changes

### View Notes (Non-Admin)
1. Click **View Notes** button
2. See notes in disabled textarea
3. Click **Close**

---

## 🔄 API Endpoints

### Update Status
```bash
PATCH /console/work-queue/{submission_id}
{
  "status": "in_review",
  "reviewer_notes": "Checking DEA...",
  "reviewed_by": "jane@example.com"
}
```

### Get Details
```bash
GET /console/work-queue/{submission_id}
```

### List Queue
```bash
GET /console/work-queue?tenant=tenant1&status=submitted&limit=100
```

---

## ✅ Testing

### Backend Tests (23 tests)
```powershell
cd backend
.venv/Scripts/python -m pytest tests/test_console_work_queue.py -v
```

### Frontend Build
```powershell
cd frontend
npm run build
```

### Manual API Test
```powershell
.\test_reviewer_actions.ps1
```

---

## 📦 Data Fields

| Field | Type | Description | Auto-Set |
|-------|------|-------------|----------|
| `status` | string | Reviewer workflow status | Manual |
| `reviewer_notes` | string | Free-text review notes | Manual |
| `reviewed_by` | string | Email/username of reviewer | Defaults to "admin" |
| `reviewed_at` | string | ISO timestamp of final decision | Yes, on approve/reject |
| `decision_status` | string | AI engine verdict (separate) | Automatic |

---

## 🎨 Color Coding

### Status Colors
- **Submitted**: Blue
- **In Review**: Purple
- **Approved**: Green
- **Rejected**: Red

### Decision Colors
- **ok_to_ship**: Green
- **blocked**: Red
- **needs_review**: Yellow

---

## 🐛 Troubleshooting

### Admin buttons not showing?
```javascript
localStorage.setItem('admin_unlocked', 'true');
location.reload();
```

### Backend not responding?
```powershell
cd backend
.venv/Scripts/python -m uvicorn src.api.main:app --reload --host 127.0.0.1 --port 8001
```

### Frontend errors?
```powershell
cd frontend
npm install
npm run dev
```

---

## 📚 Documentation Files

- **REVIEWER_ACTIONS_SUMMARY.md** - Complete overview
- **WORK_QUEUE_REVIEWER_ACTIONS_COMPLETE.md** - Detailed implementation guide
- **REVIEWER_ACTIONS_CHECKLIST.md** - Verification checklist
- **test_reviewer_actions.ps1** - Automated test script

---

## 💡 Common Workflows

### Approve a Submission
1. Filter to "Submitted"
2. Click **Start Review**
3. Click **Notes** → Add context
4. Click **Approve**

### Reject a Submission
1. Filter to "Submitted"
2. Click **Start Review**
3. Click **Notes** → Explain rejection reason
4. Click **Reject**

### Review Approved Items
1. Filter to "Approved"
2. Click **Notes** to see review history
3. Check `reviewed_by` and `reviewed_at` fields

---

## 🔢 Statistics

Dashboard shows real-time counts:
- **Total** - All submissions
- **Submitted** - Awaiting review
- **In Review** - Currently reviewing
- **Approved** - Final approved
- **Rejected** - Final rejected

---

**Status**: ✅ Production Ready  
**Tests**: 23/23 Passing  
**Build**: ✅ Success  
**Last Updated**: 2025-06-10
