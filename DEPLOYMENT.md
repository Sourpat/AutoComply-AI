# AutoComply AI — Deployment Guide

## 🚀 Quick Deploy

### Frontend (Vercel)

1. **Connect Repository**:
   - Go to [vercel.com](https://vercel.com)
   - Import project from GitHub: `Sourpat/AutoComply-AI`

2. **Configure Build Settings**:
   - **Framework Preset**: Vite
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Install Command**: `npm install`

3. **Environment Variables**:
   ```
   VITE_API_BASE_URL=http://127.0.0.1:8001
   ```
   *(Set to your backend URL once hosted. For demo/preview, use localhost.)*

4. **Deploy**:
   - Click "Deploy"
   - Wait for build to complete
   - Copy deployment URL (e.g., `https://autocomply-ai-xyz.vercel.app`)

### Backend (Local Development)

The backend runs locally on `localhost:8001`. To start:

```powershell
cd backend
.venv\Scripts\python -m uvicorn src.api.main:app --reload --host 127.0.0.1 --port 8001
```

**Environment Variables** (create `.env` in `backend/`):
```env
AUTOCOMPLY_OPENAI_KEY=your_openai_api_key_here
AUTOCOMPLY_GEMINI_KEY=your_gemini_api_key_here  # optional
```

---

## 📋 Pre-Deployment Checklist

### ✅ Repo Hygiene
- [x] No secrets committed (`.env` protected)
- [x] `.gitignore` comprehensive (`.env.*`, `*.log`, `*.db`)
- [x] `.env.example` files documented for both frontend & backend

### ✅ Test Gates
- [x] Backend tests: 325 passing, 11 skipped
- [x] Frontend build: Success (957 KB bundle)
- [x] Frontend tests: 82 passing (25 require Router mock setup — non-blocking)

### ✅ Environment Configuration
- [x] `VITE_API_BASE_URL` documented
- [x] Frontend properly reads `import.meta.env.VITE_API_BASE_URL`
- [x] Fallback logic for localhost development

---

## 🧪 Post-Deployment Smoke Test

After deploying to Vercel:

1. **Open Deployment URL**:
   ```
   https://your-vercel-app.vercel.app
   ```

2. **Verify Pages Load**:
   - [ ] Landing page renders
   - [ ] Console dashboard loads
   - [ ] Navigation works (CSF sandboxes, license pages)

3. **Expected Backend Behavior**:
   - **If backend not reachable**: Yellow banner appears: *"⚠️ Backend not connected"*
   - **This is expected** until backend is hosted separately

4. **Test API Integration** (once backend is hosted):
   - Navigate to CSF sandbox
   - Submit test form
   - Verify decision result returns

---

## 🔧 Troubleshooting

### Issue: "Backend not reachable" banner

**Cause**: `VITE_API_BASE_URL` points to `localhost:8001`, which isn't accessible from deployed frontend.

**Solution**: Deploy backend to a public host (Render, Railway, AWS, etc.) and update `VITE_API_BASE_URL`:

```
VITE_API_BASE_URL=https://autocomply-backend-xyz.onrender.com
```

Then redeploy frontend on Vercel.

---

### Issue: Frontend build fails on Vercel

**Cause**: Missing dependencies or incorrect build command.

**Solution**:
- Verify `frontend/package.json` has correct scripts
- Check Vercel build logs for errors
- Ensure Node.js version matches (use `engines` field in `package.json`)

---

### Issue: Large bundle size warning

**Cause**: Some chunks > 500 KB (informational, not a blocker).

**Solution** (optional optimization):
```typescript
// frontend/vite.config.ts
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
  },
});
```

---

## 🎯 Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Vercel Deployment (Frontend Only)                      │
│  ┌───────────────────────────────────────────┐          │
│  │  AutoComply AI React App                  │          │
│  │  - CSF Sandboxes                          │          │
│  │  - License Compliance Console             │          │
│  │  - Intelligence Panels                    │          │
│  └───────────────────────────────────────────┘          │
│                     ↓                                    │
│              VITE_API_BASE_URL                           │
│                     ↓                                    │
└─────────────────────────────────────────────────────────┘
                      ↓
          ┌──────────────────────────┐
          │  Backend (FastAPI)       │
          │  localhost:8001          │
          │  (or hosted on Render)   │
          └──────────────────────────┘
                      ↓
          ┌──────────────────────────┐
          │  SQLite Database         │
          │  autocomply.db           │
          └──────────────────────────┘
```

---

## 📦 What's Deployed

**Frontend (Vercel)**:
- React + TypeScript app
- Vite bundler (optimized production build)
- CSF sandboxes (Practitioner, EMS, Researcher, Facility, Hospital)
- Compliance console (case management, verification queue, analytics)
- Intelligence panels (confidence history, field issues, rules)

**Backend (Local / To Be Hosted)**:
- FastAPI REST API
- SQLite database (autocomply.db)
- Intelligence engine (confidence scoring, autorecompute)
- CSF evaluation endpoints
- License validation (Ohio TDDD)

---

## 🔗 Useful Links

- **Vercel Dashboard**: https://vercel.com/dashboard
- **GitHub Repo**: https://github.com/Sourpat/AutoComply-AI
- **API Documentation**: See `docs/api_endpoints.md`
- **Architecture Guide**: See `docs/architecture.md`

---

## 📝 Version Info

**Release**: Phase 7.17 Intelligence Panels + Deployment Prep  
**Commit**: `155474f`  
**Date**: January 2025  
**Features**:
- Confidence history timeline
- Auto-recompute on submission/evidence changes
- Field validation framework
- Intelligence panels (history, issues, rules)

---

## 🆘 Support

For issues or questions:
- Check `docs/troubleshooting.md`
- Review test scripts in root directory (`test_*.ps1`)
- See `RUNBOOK.md` for operational procedures
