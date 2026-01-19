# Vercel Frontend Deployment Guide

Complete guide for deploying the AutoComply AI frontend to Vercel.

---

## Prerequisites

- GitHub repository with AutoComply AI code
- Vercel account (free tier works)
- Backend deployed to Render or other platform

---

## Step 1: Vercel Project Settings

### A. Root Directory Configuration

Since this is a monorepo with `frontend/` and `backend/` directories:

1. Go to Vercel dashboard → **Import Project**
2. Select your GitHub repository
3. In **Configure Project**:
   - **Framework Preset**: `Vite`
   - **Root Directory**: `frontend` ⚠️ **CRITICAL**
   - **Build Command**: `npm ci && npm run build`
   - **Output Directory**: `dist`
   - **Install Command**: `npm ci`

---

## Step 2: Environment Variables

Go to **Project Settings → Environment Variables** and add:

### Required Variables

| Variable | Value | Description |
|----------|-------|-------------|
| `VITE_API_BASE_URL` | `https://autocomply-ai.onrender.com` | Backend API URL (replace with your Render URL) |
| `VITE_GIT_SHA` | `$(git rev-parse HEAD)` | Build commit hash (auto-populated by Vercel) |

### Optional Feature Flags

| Variable | Value | Description |
|----------|-------|-------------|
| `VITE_ENABLE_REVIEW_QUEUE` | `1` | Show Review Queue in nav (default: enabled) |
| `VITE_ENABLE_OPS` | `1` | Show Ops in nav (default: enabled) |
| `VITE_APP_ENV` | `production` | Environment name |

### Example Configuration

**Production Environment**:
```bash
VITE_API_BASE_URL=https://autocomply-ai.onrender.com
VITE_GIT_SHA=$(git rev-parse HEAD)
VITE_ENABLE_REVIEW_QUEUE=1
VITE_ENABLE_OPS=1
VITE_APP_ENV=production
```

**Preview/Staging Environment** (hide admin features):
```bash
VITE_API_BASE_URL=https://autocomply-staging.onrender.com
VITE_GIT_SHA=$(git rev-parse HEAD)
VITE_ENABLE_REVIEW_QUEUE=0
VITE_ENABLE_OPS=0
VITE_APP_ENV=staging
```

---

## Step 3: Build & Deployment

### Automatic Deployment

Vercel auto-deploys on push to `main` branch:
```bash
git push origin main
```

### Manual Deployment

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy to preview
vercel

# Deploy to production
vercel --prod
```

---

## Step 4: Verification

### A. Check Build Logs

1. Go to Vercel dashboard → **Deployments**
2. Click latest deployment
3. Check **Build Logs** for:
   ```
   ✓ built in XXXms
   ✓ dist/ output directory created
   ```

### B. Verify Runtime

1. Open deployed site: `https://your-app.vercel.app`
2. Open browser console (F12)
3. Look for:
   ```
   [AutoComply] Resolved API base URL: https://autocomply-ai.onrender.com
   [AutoComply Dev] { env: 'production', mode: 'production', gitSha: 'a1b2c3d' }
   ```

### C. Test Navigation

1. Check top navigation bar shows:
   - Home
   - Chat
   - Console
   - **Review Queue** ✅ (should be visible)
   - **Ops** ✅ (should be visible)
   - Suites (dropdown)
   - More (dropdown)

2. Click **Build Info** button (◉ icon) in top-right
3. Verify:
   - Git SHA matches your commit
   - Mode shows "production"
   - API Base URL is correct

### D. Test API Connectivity

1. Navigate to `/console`
2. Should load work queue items from backend
3. Open Network tab (F12) → should see:
   ```
   GET https://autocomply-ai.onrender.com/workflow/cases?limit=1000
   Status: 200 OK
   ```

---

## Troubleshooting

### Issue: "Review Queue" and "Ops" not showing

**Cause**: Feature flags disabled or localStorage not set

**Fix**:
1. Check Vercel env vars have `VITE_ENABLE_REVIEW_QUEUE=1`
2. Redeploy after changing env vars (they're build-time)
3. Clear browser cache

**Temporary fix** (runtime):
```javascript
// Browser console
localStorage.setItem('admin_unlocked', 'true')
location.reload()
```

---

### Issue: API calls fail with CORS errors

**Cause**: Backend not configured for Vercel domain

**Fix - Backend (Render)**:
```python
# backend/src/config.py
CORS_ORIGINS: str = "http://localhost:5173,http://127.0.0.1:5173,https://autocomply-ai.vercel.app"
```

Redeploy backend after change.

---

### Issue: Build uses wrong directory

**Cause**: Root Directory not set to `frontend`

**Fix**:
1. Vercel dashboard → Settings → General
2. **Root Directory**: `frontend`
3. Save and redeploy

---

### Issue: Environment variables not applied

**Cause**: Env vars are build-time, not runtime

**Fix**:
1. Change env vars in Vercel dashboard
2. **Redeploy** (env vars embedded during build)
3. Do NOT just restart - must rebuild

---

### Issue: 404 on route refresh (e.g., /console)

**Cause**: SPA routing not configured

**Fix**: Create `vercel.json` in repo root:
```json
{
  "routes": [
    {
      "src": "/[^.]+",
      "dest": "/",
      "status": 200
    }
  ]
}
```

**Alternative**: Vercel auto-detects Vite and handles this - check if issue persists.

---

## Advanced Configuration

### Custom Domain

1. Vercel dashboard → Settings → Domains
2. Add custom domain: `app.autocomply.example.com`
3. Update DNS:
   ```
   CNAME: app.autocomply.example.com → cname.vercel-dns.com
   ```
4. Update backend CORS to include custom domain

### Preview Deployments

Each PR gets a preview URL:
- `https://autocomply-ai-git-feature-branch-username.vercel.app`
- Useful for testing before merge
- Uses same env vars as production (can override per-branch)

### Performance Optimizations

Already configured via Vite:
- Code splitting
- Tree shaking
- Minification
- Gzip compression
- HTTP/2 push

---

## Monitoring

### Vercel Analytics

Enable in dashboard → Analytics:
- Page views
- Performance metrics (Core Web Vitals)
- Top pages
- Geographic distribution

### Build Info Display

Click **◉** button in header to see:
- Git commit SHA
- Build mode
- API base URL
- Useful for confirming correct build is deployed

---

## Rollback

### Via Vercel Dashboard

1. Go to Deployments
2. Find previous working deployment
3. Click **⋯** → **Promote to Production**

### Via Git

```bash
git revert <bad-commit-sha>
git push origin main
# Vercel auto-deploys the revert
```

---

## Summary Checklist

Before deploying:
- [ ] Backend deployed and healthy (`GET /health` returns 200)
- [ ] Backend CORS includes Vercel domain
- [ ] Vercel Root Directory set to `frontend`
- [ ] `VITE_API_BASE_URL` env var set to backend URL
- [ ] `VITE_GIT_SHA` env var configured
- [ ] Feature flags configured (`VITE_ENABLE_*`)
- [ ] Test routes exist in App.jsx (`/admin/review`, `/admin/ops`)

After deploying:
- [ ] Build logs show success
- [ ] Console logs show correct API base URL
- [ ] Navigation shows Review Queue and Ops
- [ ] Build info displays correct commit SHA
- [ ] API calls to backend succeed (check Network tab)
- [ ] Work queue loads data from backend

---

## See Also

- [DEPLOYMENT.md](../docs/DEPLOYMENT.md) - General deployment guide
- [VERCEL_UI_EMPTY_ROOT_CAUSE.md](../VERCEL_UI_EMPTY_ROOT_CAUSE.md) - Troubleshooting empty UI
- [DEPLOYMENT_FIXES_SUMMARY.md](../DEPLOYMENT_FIXES_SUMMARY.md) - Recent fixes
- [Frontend .env.example](../frontend/.env.example) - Environment variable reference
