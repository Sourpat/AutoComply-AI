# Operator Guide - Private

**Audience**: You (the operator/developer)  
**Purpose**: Admin operations and demo management  
**Status**: Private - NOT linked in UI

---

## Admin Mode Access

### Method 1: Admin Login Page (Recommended)

1. Navigate to: `http://localhost:5173/admin/login` (dev) or `https://your-frontend-url/admin/login` (prod)
2. Enter passcode: `autocomply-admin-2024`
3. Click "Unlock Admin Features"
4. Admin mode will persist until you clear localStorage

### Method 2: Browser Console

```javascript
// Enable admin mode
localStorage.setItem('admin_unlocked', 'true');
// Then refresh the page
window.location.reload();

// Disable admin mode
localStorage.removeItem('admin_unlocked');
window.location.reload();
```

### Method 3: URL Parameter

Navigate to Console with admin param:
```
http://localhost:5173/console?admin=true
```

### Verify Admin Mode is Active

1. Check localStorage: `localStorage.getItem('admin_unlocked')` should return `'true'`
2. Nav bar should show: **Review Queue** and **Ops Dashboard** links
3. Console page should show: **Console Tour** card
4. Console should show: Testing, Docs, Future Work, Run Locally sections

---

## Seeding Demo Data

### Knowledge Base Seed

**When**: First time setup, or after DB reset

**Command** (from `backend/` directory):
```powershell
.venv\Scripts\python scripts\seed_kb.py
```

**What it does**:
- Seeds ~50 regulatory compliance questions with answers
- Generates vector embeddings for semantic search
- Adds question variants for paraphrasing handling
- Creates sample tags (florida, ohio, schedule-ii, etc.)

**Output**:
```
Seeding knowledge base...
✓ Created 52 KB entries
✓ Generated embeddings
✓ Added 156 question variants
Knowledge base seeded successfully
```

**Alternative**: Use Admin API endpoint
```bash
curl -X POST http://localhost:8001/api/v1/admin/kb/seed \
  -H "X-User-Role: admin"
```

### Review Queue Sample Data

**Optional**: Pre-populate review queue with test items

**Command** (from `backend/` directory):
```powershell
.venv\Scripts\python -c "
from src.database.connection import get_db_session
from src.database.models import ReviewQueueItem, ReviewStatus, QuestionEvent
from datetime import datetime

with get_db_session() as db:
    # Create sample question event
    question = QuestionEvent(
        question_text='What are the DEA requirements for Schedule III shipments?',
        asked_at=datetime.utcnow(),
        source='chat'
    )
    db.add(question)
    db.flush()
    
    # Create review queue item
    review_item = ReviewQueueItem(
        question_event_id=question.id,
        status=ReviewStatus.OPEN,
        priority=2,
        created_at=datetime.utcnow()
    )
    db.add(review_item)
    db.commit()
    print('Sample review item created')
"
```

---

## Database Reset (Dangerous)

### Full Database Reset

**Warning**: This deletes ALL data and cannot be undone.

**When**: Testing fresh deployments, demo resets, clearing test data

**Method 1**: Admin API Endpoint (Recommended)

1. Enable admin mode in UI
2. Navigate to: `http://localhost:8001/admin` (use browser or API client)
3. GET `/admin/reset/preview` to see what will be deleted
4. POST `/admin/reset/confirm` with body: `{"confirm": true}`

**Method 2**: Delete Database File

```powershell
# From backend/ directory
# Stop backend server first
Remove-Item app\data\autocomply.db -ErrorAction SilentlyContinue
Remove-Item app\data\exports\* -Recurse -ErrorAction SilentlyContinue

# Restart backend - DB will be recreated
.venv\Scripts\python -m uvicorn src.api.main:app --reload --host 127.0.0.1 --port 8001
```

**Method 3**: Reset Script (if you create one)

```powershell
# backend/scripts/reset_demo.py
python scripts\reset_demo.py --confirm
```

### Partial Resets

**Clear Review Queue Only**:
```sql
-- From backend/ directory
sqlite3 app/data/autocomply.db
DELETE FROM review_queue_items;
DELETE FROM question_events;
.quit
```

**Clear Cases Only**:
```sql
sqlite3 app/data/autocomply.db
DELETE FROM audit_events;
DELETE FROM cases;
.quit
```

**Clear Exports Only**:
```powershell
Remove-Item app\data\exports\* -Recurse -Force
```

---

## Suggested Demo Flow (High Level)

### For Recruiters (Public View - Admin OFF)

**Goal**: Show polished product experience

1. **Home Page** → Brief overview
2. **Chat** → Ask: "What are Florida Schedule II requirements?"
   - Shows RAG retrieval with sources
   - Demonstrates natural language interface
3. **CSF Forms** → Hospital CSF (Ohio scenario)
   - Fill out valid hospital form
   - Get `ok_to_ship` verdict
   - Show normalized decision output
4. **License Validation** → Ohio TDDD
   - Enter valid license number
   - Show expiry validation
   - Demonstrate deterministic engine
5. **Console** → Overview of all engines
   - Show breadth of coverage
   - Highlight API-first design
   - Point to decision badges (ok_to_ship, needs_review, blocked)

**Duration**: 5-7 minutes  
**Focus**: Functional product, clean UI, working features

### For Technical Interviews (Admin ON)

**Goal**: Show technical depth and architecture

1. **Enable Admin Mode** → `/admin/login` or console
2. **Console Tour** → Walk through guided narrative
   - Explains each engine's architecture
   - Shows RAG integration points
   - Discusses deterministic + AI hybrid approach
3. **Review Queue** → Human-in-the-loop workflow
   - Show unanswered question escalation
   - Demonstrate draft → approve → publish flow
   - Highlight metadata (triage score, top matches)
4. **Ops Dashboard** → Real-time operational metrics
   - KPIs: open reviews, high-risk items, response time
   - Show how verification teams monitor queue health
   - Discuss SLA tracking and bottleneck detection
5. **Coverage Analytics** → Form and geographic coverage
   - Show saved views (CSF types, jurisdictions)
   - Export to CSV
   - Discuss scheduled exports for reporting
6. **Testing & Docs** → Show commitment to quality
   - Pytest coverage (~20 test cases)
   - Architecture docs
   - API reference with curl examples
7. **API Exploration** → `/docs` OpenAPI Swagger UI
   - Try live endpoints
   - Show request/response schemas
   - Discuss API-first design philosophy

**Duration**: 15-25 minutes  
**Focus**: Architecture, testing, scalability, design decisions

### Demo Scenarios by Feature

**RAG Knowledge Explorer**:
- Known question: "What is Ohio TDDD?" → High confidence match
- Paraphrased: "Tell me about Ohio terminal distributor license" → Variant matching
- Unknown question: "What are Alaska Schedule IV requirements?" → Auto-escalates to review queue

**CSF Engines**:
- Happy path: Valid hospital in Ohio → `ok_to_ship`
- Edge case: Missing attestation → `needs_review`
- Blocked: Expired facility license → `blocked`

**Review Queue**:
- Open item: Assign to yourself
- Draft answer: Write sample compliance answer
- Approve & Publish: Adds to KB with variants

**Ops Dashboard**:
- Check KPIs: Show current queue depth
- Review timeline: See recent activity
- Filter by risk: Show high-risk items

---

## Health & Verification Endpoints

### Backend Health Check

**Endpoint**: `GET /health`

**Command**:
```bash
curl http://localhost:8001/health
```

**Expected Response**:
```json
{
  "status": "healthy",
  "version": "0.1.0",
  "timestamp": "2026-01-08T12:34:56.789Z",
  "database": "connected",
  "kb_entries": 52
}
```

**Troubleshooting**:
- 500 error → Database connection issue, check SQLite file exists
- No response → Backend not running, check port 8001
- CORS error → Check `CORS_ORIGINS` environment variable

### Frontend Build Verification

**Command** (from `frontend/` directory):
```powershell
npm run build
```

**Expected Output**:
```
vite v5.4.21 building for production...
✓ 1234 modules transformed.
dist/index.html                   0.45 kB │ gzip:  0.28 kB
dist/assets/index-abc123.css    245.67 kB │ gzip: 34.12 kB
dist/assets/index-xyz789.js     844.23 kB │ gzip: 267.89 kB
✓ built in 12.34s
```

**Check dist/ output**:
```powershell
Get-ChildItem dist -Recurse | Measure-Object -Property Length -Sum
```

Should be ~1.2 MB uncompressed, ~300-350 KB gzipped.

### API Connectivity Test

**From Frontend to Backend**:

```javascript
// Browser console (with frontend running)
fetch('/api/health')
  .then(r => r.json())
  .then(data => console.log('Backend health:', data))
  .catch(err => console.error('Backend unreachable:', err));
```

**Expected**:
- Dev mode: Proxies to `http://127.0.0.1:8001/health`
- Prod mode: Uses `VITE_API_BASE_URL/health`

### Database Integrity Check

**Command** (from `backend/` directory):
```powershell
sqlite3 app\data\autocomply.db "PRAGMA integrity_check;"
```

**Expected**: `ok`

**Check table counts**:
```powershell
sqlite3 app\data\autocomply.db "
SELECT 'kb_entries', COUNT(*) FROM kb_entries
UNION ALL
SELECT 'question_events', COUNT(*) FROM question_events
UNION ALL
SELECT 'review_queue_items', COUNT(*) FROM review_queue_items
UNION ALL
SELECT 'cases', COUNT(*) FROM cases;
"
```

### Admin Endpoint Security Test

**Without Auth Header** (should return 403):
```bash
curl -X GET http://localhost:8001/api/v1/admin/ops/kpis
```

**Expected**:
```json
{
  "detail": {
    "error": "admin_access_required",
    "message": "This endpoint requires admin privileges. Admin mode must be unlocked in the UI."
  }
}
```

**With Auth Header** (should return 200):
```bash
curl -X GET http://localhost:8001/api/v1/admin/ops/kpis \
  -H "X-User-Role: admin"
```

**Expected**:
```json
{
  "open_reviews": 5,
  "high_risk_open_reviews": 2,
  "avg_time_to_first_response_hours": 12.5,
  "auto_answered_rate": 0.78
}
```

---

## Common Operations

### Check What's Running

```powershell
# Check backend (port 8001)
netstat -ano | findstr :8001

# Check frontend (port 5173)
netstat -ano | findstr :5173

# Kill processes if needed
Stop-Process -Id <PID> -Force
```

### View Logs

**Backend**:
- Console output shows all requests/responses
- Look for `INFO:     127.0.0.1:xxxxx - "GET /api/..."` lines

**Frontend**:
- Browser DevTools → Console tab
- Network tab for API calls
- Look for errors in red

### Export Sample Data for Testing

**Create test export**:
```bash
curl -X GET "http://localhost:8001/api/v1/analytics/exports/cases?status=submitted&format=csv" \
  -H "X-User-Role: admin" \
  -o test_export.csv
```

**Check export files**:
```powershell
Get-ChildItem backend\app\data\exports
```

### Scheduled Exports Verification

**List scheduled exports**:
```bash
curl -X GET http://localhost:8001/api/v1/scheduled-exports \
  -H "X-User-Role: admin"
```

**Create test export job**:
```bash
curl -X POST http://localhost:8001/api/v1/scheduled-exports \
  -H "Content-Type: application/json" \
  -H "X-User-Role: admin" \
  -d '{
    "name": "Test Daily Export",
    "frequency": "daily",
    "export_type": "cases",
    "filters": {"status": "submitted"}
  }'
```

---

## Pre-Demo Checklist

### Before Showing to Anyone

- [ ] Backend running on port 8001
- [ ] Frontend running on port 5173 (dev) or built and deployed (prod)
- [ ] Knowledge base seeded (~50 entries)
- [ ] Database has some sample cases (optional, for demo richness)
- [ ] Admin mode unlocked (if showing technical features)
- [ ] Health check returns 200 OK
- [ ] CORS configured correctly for production (if deployed)

### Environment Variables Check

**Backend** (`.env` or platform settings):
```bash
APP_ENV=prod
CORS_ORIGINS=https://your-frontend.onrender.com
PORT=8001
```

**Frontend** (`.env.local` or platform settings):
```bash
VITE_API_BASE_URL=https://your-backend.onrender.com
```

### Quick Smoke Test

1. Visit home page → loads without errors
2. Visit `/chat` → ask question → get response with sources
3. Visit `/csf` → fill hospital form → get decision
4. Visit `/console` → see all engine cards
5. Visit `/coverage` → see analytics dashboard
6. Enable admin → verify Review Queue and Ops Dashboard appear

---

## Troubleshooting

### Backend Won't Start

**Check Python version**:
```powershell
python --version  # Should be 3.11+
```

**Check dependencies**:
```powershell
cd backend
.venv\Scripts\python -m pip install -r requirements.txt
```

**Check database file**:
```powershell
# Should exist
Test-Path backend\app\data\autocomply.db
```

**Check port availability**:
```powershell
netstat -ano | findstr :8001
```

### Frontend Won't Build

**Check Node version**:
```powershell
node --version  # Should be 18+
```

**Clear cache and reinstall**:
```powershell
cd frontend
Remove-Item -Recurse -Force node_modules, dist
npm install
npm run build
```

### Admin Mode Not Working

**Check localStorage**:
```javascript
// Browser console
localStorage.getItem('admin_unlocked')  // Should be 'true'
```

**Clear and reset**:
```javascript
localStorage.clear();
localStorage.setItem('admin_unlocked', 'true');
location.reload();
```

**Check network requests**:
- DevTools → Network tab
- Look for `X-User-Role: admin` header in requests
- Should see admin endpoints returning 200 (not 403)

### Database Locked Error

**Cause**: SQLite file locked by another process

**Fix**:
```powershell
# Stop all Python processes
Stop-Process -Name python -Force

# Wait a moment
Start-Sleep -Seconds 2

# Restart backend
cd backend
.venv\Scripts\python -m uvicorn src.api.main:app --reload --host 127.0.0.1 --port 8001
```

---

## Production Deployment Quick Ref

### Render.com Backend

**Build Command**: (none, Python doesn't need build)  
**Start Command**: `bash start.sh`  
**Environment Variables**:
```
APP_ENV=prod
CORS_ORIGINS=https://your-frontend.onrender.com
PORT=8001
```

**Persistent Disk**: `/opt/render/project/backend/app/data`

### Render.com Frontend

**Build Command**: `npm run build`  
**Publish Directory**: `dist`  
**Environment Variables**:
```
VITE_API_BASE_URL=https://your-backend.onrender.com
```

**Rewrites**: Add in Render dashboard settings:
```
/* → /index.html (for SPA routing)
```

---

## Maintenance

### Weekly (If Actively Demoing)

- [ ] Check health endpoints
- [ ] Verify admin access still works
- [ ] Test one end-to-end flow (chat → CSF → console)
- [ ] Check for any console errors in browser DevTools

### Monthly

- [ ] Update dependencies (`npm update`, `pip list --outdated`)
- [ ] Review RELEASE_NOTES.md for any needed updates
- [ ] Re-test admin endpoint security (403 without header)
- [ ] Verify CORS still restricts to frontend origin

### Before Interviews

- [ ] Fresh database reset (optional, for clean slate)
- [ ] Re-seed knowledge base
- [ ] Test admin unlock flow
- [ ] Verify all demo scenarios work
- [ ] Check logs for any errors

---

**Remember**: This guide is for your use only. Don't link it in the UI or share publicly.

---

*AutoComply AI - Operator Guide*  
*Last Updated: January 8, 2026*
