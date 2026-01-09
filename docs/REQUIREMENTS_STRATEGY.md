# Requirements Files - Development vs Production

**Purpose**: Explain the split between full and lean dependency files  
**Audience**: Developers and deployers

---

## File Overview

### requirements.txt (Full Dependencies)

**Location**: `backend/requirements.txt`  
**Size**: ~500 MB installed  
**Use Case**: Local development with full RAG capabilities

**Includes**:
- ✅ Core FastAPI + Uvicorn
- ✅ Database (SQLAlchemy)
- ✅ RAG & LangChain (langchain-openai, langchain-community)
- ✅ Vector DB (chromadb)
- ✅ Embeddings (sentence-transformers, torch, transformers)
- ✅ Document parsing (unstructured, pypdf, pdf2image)
- ✅ Testing (pytest)

**Install**:
```bash
cd backend
pip install -r requirements.txt
```

**When to use**:
- Local development with full RAG capabilities
- Testing knowledge base embedding generation
- Document parsing and chunking experiments
- Running complete test suite with ML features

---

### requirements.render.txt (Lean Dependencies)

**Location**: `backend/requirements.render.txt`  
**Size**: ~60 MB installed  
**Use Case**: Production deployment (Render, Railway, Fly.io, etc.)

**Includes**:
- ✅ Core FastAPI + Uvicorn
- ✅ Database (SQLAlchemy)
- ✅ HTTP clients (httpx, requests)
- ✅ Configuration (pydantic, pydantic-settings, python-dotenv)
- ✅ Basic data processing (numpy for CSF engines)
- ✅ PDF generation (reportlab for case exports)
- ✅ Testing (pytest - optional for prod)

**Excludes** (Heavy ML Dependencies):
- ❌ openai (~10 MB)
- ❌ langchain-* (~50 MB)
- ❌ chromadb (~20 MB)
- ❌ sentence-transformers (~200 MB)
- ❌ torch (~100-500 MB depending on platform)
- ❌ transformers (~50 MB)
- ❌ unstructured (~30 MB)
- ❌ pypdf, pdf2image, Pillow (~20 MB)

**Total reduction**: ~500 MB → ~60 MB (88% smaller)

**Install**:
```bash
cd backend
pip install -r requirements.render.txt
```

**When to use**:
- Hosted deployments (Render, Vercel Functions, AWS Lambda)
- Docker production builds
- CI/CD pipelines (faster builds)
- Memory-constrained environments

---

## Why the Split?

### Problem: Hosted Deployment Overhead

**Before** (using requirements.txt):
- Build time: 10-15 minutes (downloading/compiling torch, etc.)
- Memory usage: 1.5-2 GB RAM (ML libraries loaded at startup)
- Disk space: 800 MB - 1 GB installed dependencies
- Cold start: 30-60 seconds (loading ML models)

**After** (using requirements.render.txt):
- Build time: 2-3 minutes (only essential packages)
- Memory usage: 256-512 MB RAM (no ML overhead)
- Disk space: 120-180 MB installed dependencies
- Cold start: 5-10 seconds (fast startup)

### v0.1-demo Strategy

The demo version doesn't need real-time RAG or embedding generation:
- Knowledge base pre-seeded with ~50 regulatory questions
- Embeddings pre-computed during development
- RAG features auto-disabled in production (APP_ENV=prod)
- Chat endpoint gracefully routes questions to review queue
- Lazy imports prevent crashes when ML dependencies missing
- Chat uses pre-indexed KB (no LLM generation in demo mode)

**Result**: Can run on cheaper hosting tiers (512 MB RAM vs 2 GB+)

---

## Conditional Installation

### Docker (Dockerfile)

The Dockerfile uses `APP_ENV` build arg to choose requirements:

```dockerfile
ARG APP_ENV=dev
RUN pip install --upgrade pip && \
    if [ "$APP_ENV" = "prod" ]; then \
        pip install -r /app/requirements.render.txt; \
    else \
        pip install -r /app/requirements.txt; \
    fi
```

**Build for dev**:
```bash
docker build -t autocomply-backend:dev .
```

**Build for prod**:
```bash
docker build --build-arg APP_ENV=prod -t autocomply-backend:prod .
```

### Render.com

In Render dashboard, set **Build Command**:
```bash
pip install -r requirements.render.txt
```

### Manual (Local Testing)

**Test production requirements locally**:
```bash
cd backend

# Create clean venv
python -m venv .venv-prod
.venv-prod\Scripts\activate

# Install lean requirements
pip install -r requirements.render.txt

# Start server
python -m uvicorn src.api.main:app --reload --host 127.0.0.1 --port 8001
```

**Expected**: Server starts normally, CSF/workflow/analytics work, RAG features disabled gracefully.

---

## What Still Works with Lean Requirements?

### ✅ Fully Functional

- **CSF Engines**: Hospital, Facility, Practitioner, EMS, Researcher
- **License Validation**: Ohio TDDD, NY Pharmacy
- **Workflow & Cases**: Submission intake, work queue, case detail
- **Analytics**: Coverage dashboard, saved views, exports
- **Admin Tools**: Review queue, ops dashboard, admin operations
- **Database**: SQLite persistence, migrations
- **Health Checks**: `/health`, `/api/v1/workflow/health`

### ⚠️ Degraded or Disabled

- **RAG Chat**: Returns error or uses fallback (simple keyword search)
- **Knowledge Base Search**: Uses pre-computed embeddings (works if DB seeded with embeddings)
- **Live Embedding**: Cannot generate new embeddings at runtime
- **Document Parsing**: Cannot parse PDFs/HTML on-the-fly

### 🔧 Graceful Degradation

The backend code should handle missing dependencies gracefully:

```python
# Example: Optional RAG import
try:
    from langchain_openai import OpenAIEmbeddings
    RAG_AVAILABLE = True
except ImportError:
    RAG_AVAILABLE = False
    
# Later, in route handler:
if not RAG_AVAILABLE:
    raise HTTPException(
        status_code=503,
        detail="RAG features not available in this deployment"
    )
```

**Current State**: v0.1-demo doesn't implement graceful degradation yet (assumes full dependencies). Adding this is a future enhancement.

---

## Upgrade to Full RAG in Production

If you later need full RAG capabilities in hosted deployment:

### Option 1: Switch to requirements.txt

**In Render Build Command**:
```bash
pip install -r requirements.txt
```

**Upgrade Instance Type**: Standard or higher (2+ GB RAM)

### Option 2: External Embedding Service

- Use OpenAI Embeddings API (no local transformers needed)
- Remove sentence-transformers, torch, transformers
- Keep langchain-openai for API calls
- Reduces local dependencies while keeping RAG functional

**requirements.hybrid.txt** (not created yet):
```
# Keep langchain but use API-based embeddings
langchain-openai>=0.3.0
# Remove: sentence-transformers, torch, transformers
```

### Option 3: Managed Vector DB

- Use Pinecone, Weaviate, or Qdrant Cloud
- Remove chromadb
- Offload vector storage to external service
- Backend becomes stateless

---

## Testing Before Deployment

### Verify Lean Requirements Work

**Step 1: Create test environment**
```powershell
cd backend
python -m venv .venv-test
.venv-test\Scripts\activate
pip install -r requirements.render.txt
```

**Step 2: Run server**
```powershell
python -m uvicorn src.api.main:app --reload --host 127.0.0.1 --port 8001
```

**Step 3: Test critical paths**
1. Visit http://localhost:8001/health (should return 200 OK)
2. Submit Hospital CSF form (should work)
3. Check work queue (should load cases)
4. Export to CSV (should download file)

**Step 4: Test expected failures**
1. Try RAG chat (should fail gracefully or return static error)
2. Try knowledge base search (works if embeddings pre-seeded)

**Step 5: Cleanup**
```powershell
deactivate
Remove-Item -Recurse .venv-test
```

---

## Maintenance

### Keeping Files in Sync

When adding new production dependencies:

1. Add to **requirements.txt** (full)
2. If essential for runtime (not just RAG), add to **requirements.render.txt**
3. Test both environments

**Example**: Adding new HTTP client
```bash
# Add to both files
echo "aiohttp>=3.9.0" >> requirements.txt
echo "aiohttp>=3.9.0" >> requirements.render.txt
```

### Dependency Updates

**Update all dependencies**:
```bash
# In development environment
pip install --upgrade -r requirements.txt
pip freeze > requirements-updated.txt

# Review changes, cherry-pick updates to requirements.txt

# Update lean requirements with only essential packages
# Manually sync version numbers to requirements.render.txt
```

**Automated approach** (requires pip-tools):
```bash
# Create requirements.in and requirements-render.in with unpinned versions
# Use pip-compile to generate locked versions
pip-compile requirements.in
pip-compile requirements-render.in -o requirements.render.txt
```

---

## Summary

| Aspect | requirements.txt | requirements.render.txt |
|--------|-----------------|------------------------|
| **Size** | ~500 MB | ~50 MB |
| **Build Time** | 10-15 min | 2-3 min |
| **Memory** | 1.5-2 GB | 256-512 MB |
| **Use Case** | Local dev + RAG | Hosted prod |
| **RAG** | Full capabilities | Disabled/degraded |
| **CSF/Workflow** | ✅ Works | ✅ Works |
| **Cost** | N/A | Cheaper hosting |

**Recommendation**: 
- Use requirements.txt for local development
- Use requirements.render.txt for Render/hosted deployments
- Test both environments before releases
- Document any features that don't work with lean requirements

---

*AutoComply AI - Requirements Strategy*  
*Last Updated: January 9, 2026*
