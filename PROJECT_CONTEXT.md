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
- `AUDIT_SIGNING_SECRET` - Audit log HMAC secret (change in production!)

**Optional**:
- `OPENAI_API_KEY` - For LLM intelligence features
- `ANTHROPIC_API_KEY` - Alternative LLM provider
- `CORS_ORIGINS` - Frontend origin (default: http://localhost:5173)
- `DEV_SEED_TOKEN` - Seed endpoint auth token

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
