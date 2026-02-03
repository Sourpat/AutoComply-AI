# AutoComply-AI Project Context

**Overview**: AI-powered compliance automation platform for healthcare regulatory workflows (CSF, licenses, controlled substances).

## Architecture

```
┌─────────────┐      HTTP/REST      ┌──────────────┐
│   Frontend  │ ←─────────────────→ │   Backend    │
│  React/Vite │    localhost:8001   │ FastAPI/Python│
│   Port 5173 │                     │              │
└─────────────┘                     └──────────────┘
                                           │
                                           ↓
                                    ┌──────────────┐
                                    │   SQLite DB  │
                                    │ (local file) │
                                    └──────────────┘
```

### Tech Stack

**Backend** (`/backend`)
- **Framework**: FastAPI (Python 3.12)
- **Database**: SQLite (src/data/autocomply.db)
- **ORM**: SQLAlchemy
- **Testing**: pytest
- **Server**: uvicorn

**Frontend** (`/frontend`)
- **Framework**: React + TypeScript
- **Build**: Vite
- **Styling**: Tailwind CSS
- **State**: React hooks (no Redux)
- **HTTP Client**: fetch API

## Local Development

### Setup

```bash
# Backend
cd backend
py -3.12 -m venv .venv
.venv/Scripts/python -m pip install -r requirements.txt

# Frontend
cd frontend
npm install
```

### Running Servers

```bash
# Backend (port 8001)
cd backend
.venv/Scripts/python -m uvicorn src.api.main:app --reload --host 127.0.0.1 --port 8001

# Frontend (port 5173)
cd frontend
npm run dev
```

### How to demo SDX in < 60 seconds

```bash
# Backend (enable SDX + spec trace)
cd backend
$env:FEATURE_EXEC_PREVIEW="1"; $env:FEATURE_SPEC_TRACE="1"; .venv/Scripts/python -m uvicorn src.api.main:app --reload --host 127.0.0.1 --port 8001

# Seed demo packets (PowerShell)
Invoke-RestMethod -Method Post -Uri http://127.0.0.1:8001/api/audit/demo/seed -Body '{"caseId":"CASE-DEMO","count":3}' -ContentType "application/json"
```

**Routes**:
- /audit/packets (confirm execution_preview in list)
- /governance/narrative?hash=<packetHash>
- /agentic/workbench (Decision Trace drawer)

**URLs**:
- Frontend: http://localhost:5173
- Backend API: http://localhost:8001
- API Docs: http://localhost:8001/docs
- Health Check: http://localhost:8001/health

### Testing

```bash
# Backend unit tests
cd backend
.venv/Scripts/python -m pytest tests/ -v

# Frontend build (type check)
cd frontend
npm run build

# Backend specific test
cd backend
.venv/Scripts/python -m pytest tests/test_<feature>.py -v
```

## Key Directories

```
backend/
  ├── src/
  │   ├── api/
  │   │   ├── main.py           # FastAPI app entrypoint
  │   │   └── routes/           # API endpoints
  │   ├── config.py             # Environment config
  │   ├── core/                 # Database, auth
  │   └── data/                 # SQLite DB location
  ├── app/
  │   ├── workflow/             # Case management
  │   ├── intelligence/         # AI decision engine
  │   ├── analytics/            # Metrics & dashboards
  │   └── policy/               # Policy management
  ├── tests/                    # pytest test suite
  └── requirements.txt          # Python dependencies

frontend/
  ├── src/
  │   ├── pages/                # React page components
  │   │   └── ConsoleDashboard.tsx  # Main verifier UI
  │   ├── api/                  # Backend API clients
  │   ├── components/           # Reusable UI components
  │   └── lib/                  # Utilities
  └── package.json              # npm dependencies
```

## Environment Variables

**Required**:
- `DATABASE_URL` - SQLite connection (default: sqlite:///src/data/autocomply.db)
- `AUDIT_SIGNING_KEY` - Audit log HMAC secret (change in production!)

**Optional**:
- `OPENAI_API_KEY` - For LLM intelligence features
- `ANTHROPIC_API_KEY` - Alternative LLM provider
- `CORS_ORIGINS` - Frontend origin (default: http://localhost:5173)
- `DEV_SEED_TOKEN` - Seed endpoint auth token
- `VITE_API_BASE_URL` - Frontend API base URL (build-time)
- `VITE_DEV_SEED_TOKEN` - Frontend-only dev seed token for demo reset header

**Configuration**: See `backend/src/config.py`

## API Patterns

### Authentication
- Header-based: `X-Role: admin|verifier|reviewer|viewer`
- Dev token: `X-Dev-Token` for seed endpoints

### Response Format
```json
{
  "items": [...],
  "total": 100,
  "limit": 50,
  "offset": 0
}
```

### Error Responses
```json
{
  "detail": "Error message",
  "status_code": 400
}
```

## Database Schema

**Core Tables**:
- `workflow_cases` - Case records with SLA tracking
- `audit_events` - Immutable audit trail
- `intelligence_history` - AI decision history with trace_id (Phase 8.1)
- `submissions_store` - Form submissions

**Migrations**: Manual SQL scripts in `backend/scripts/migrate_*.py`

## Recent Features

**Phase 7.x**:
- SLA tracking (age_hours, sla_status)
- Intelligence auto-recompute
- RBAC for sensitive endpoints
- Production health diagnostics

**Phase 8.x**:
- Distributed tracing (trace_id, span_id)
- Trace viewer UI with labeling
- Request ID middleware

## What SDX Is / Is Not

- **Is**: A read-only Execution Preview derived at read-time.
- **Is**: Feature-flagged (FEATURE_EXEC_PREVIEW + VITE_FEATURE_EXEC_PREVIEW).
- **Is**: Demo-safe and deterministic, showing readiness signals.
- **Is Not**: Automation or workflow execution.
- **Is Not**: A change to decision logic or persistence.

## Phase 8 Demo Checklist

- Backend flags: FEATURE_EXEC_PREVIEW=1, FEATURE_SPEC_TRACE=1, FEATURE_OVERRIDE_FEEDBACK=1
- Frontend flags: VITE_FEATURE_EXEC_PREVIEW=true, VITE_FEATURE_GOV_NARRATIVE=true, VITE_FEATURE_OVERRIDE_FEEDBACK=true
- Start backend on port 8001 (see commands below)
- Seed demo packets: POST /api/audit/demo/seed (caseId CASE-DEMO, count 3)
- Open /audit/packets and confirm SDX data appears
- Open /audit/view?hash=<latest> and note Execution Preview section
- Open /audit/diff?left=<prev>&right=<latest> for history compare
- Open /agentic/workbench and expand Decision Trace → Execution Preview
- Open /governance/narrative and expand SDX block
- 90s talk track: Spec → Decision → Execution Preview → Audit evidence → Overrides

## Governance Narrative Talk Track (Phase 4)

- We start with a spec identifier, version used, and the latest available version to show drift awareness.
- The system parses the spec into explicit conditions so governance can see what was interpreted.
- The AI decision is presented as an outcome with confidence and severity, not chain-of-thought.
- UI enforcement reflects the decision through badges and risk indicators, keeping operators aligned.
- Evidence is summarized as metadata (title, source, date) to avoid exposing raw content.
- Human override feedback is captured as a governance signal with reason and note.
- All actions are stitched into an audit artifact with a packet hash and verification links.
- Drift flags highlight when a decision used an older spec version.
- HITL feedback is additive and does not change decision logic.
- Feature flags keep narrative features read-only and demo-safe.

## Deployment Targets

**Production**: (Placeholder - add Render/Railway URL when deployed)
**Staging**: (Placeholder)
**CI/CD**: GitHub Actions (`.github/workflows/`)

## Constraints

- **WIP=1**: One phase/feature at a time
- **Minimal UI changes**: Extend existing patterns
- **No new tables**: Use existing schema + JSON columns
- **Backward compatible**: Don't break existing APIs
- **Test coverage**: All endpoints must have tests

## Common Pitfalls

❌ **Port conflicts**: Check `netstat -ano | findstr :8001` on Windows
❌ **Timezone bugs**: Always use `timezone.utc` for datetime comparisons
❌ **Pydantic v1/v2**: Migration warnings (safe to ignore, fix incrementally)
❌ **Test DB**: May lack recent migrations (mark integration tests with `@pytest.mark.skip`)

## Getting Help

- **API Docs**: http://localhost:8001/docs (auto-generated OpenAPI)
- **OpenAPI Spec**: `openapi.json` (at repo root)
- **Phase Docs**: `PHASE_*.md` files (detailed feature specs)
- **Test Examples**: `backend/tests/test_*.py` (patterns to follow)
