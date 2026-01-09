# Render.com Deployment - Quick Reference

## Backend Configuration

### Build Settings

**Build Command:**
```bash
pip install -r requirements.render.txt
```

**Start Command:**
```bash
./start.sh
```

### Environment Variables

**Required:**
```env
APP_ENV=prod
CORS_ORIGINS=https://your-frontend-name.onrender.com
```

**Optional:**
```env
RAG_ENABLED=false               # Auto-disabled in prod (default)
OPENAI_API_KEY=sk-...           # Only needed if RAG_ENABLED=true
```

**Auto-Set by Render:**
```env
PORT=<random>                   # Render sets this automatically
```

### Health Check

**Path:** `/healthz`  
**Protocol:** HTTP  
**Port:** Same as web service (auto)

**Advanced Settings:**
- Interval: 30 seconds
- Timeout: 5 seconds
- Unhealthy Threshold: 3 failures

---

## Frontend Configuration

### Build Settings

**Build Command:**
```bash
npm install && npm run build
```

**Publish Directory:**
```
dist
```

### Environment Variables

**Required:**
```env
VITE_API_BASE_URL=https://your-backend-name.onrender.com
```

**Optional (for local preview):**
```env
NODE_ENV=production
```

---

## Post-Deployment Verification

### Backend Checks

1. **Health endpoint:**
   ```bash
   curl https://your-backend-name.onrender.com/healthz
   # Expected: {"status":"ok"}
   ```

2. **Startup logs (in Render dashboard):**
   ```
   INFO: Starting AutoComply AI Backend...
   INFO:   APP_ENV: prod
   INFO:   RAG_ENABLED: False
   INFO:   PORT: 10000
   INFO: Initializing database schema...
   ✓ Database initialized successfully
   INFO: ✓ Startup complete - ready to accept requests
   ```

3. **Memory usage:**
   - Should be < 512 MB
   - Starter tier (512 MB) sufficient

### Frontend Checks

1. **Page loads:**
   ```bash
   curl https://your-frontend-name.onrender.com
   # Should return HTML with no errors
   ```

2. **API connection:**
   - Open browser console
   - Navigate to site
   - Check Network tab for API calls to backend
   - Should see successful responses (200 OK)

---

## Common Issues

### Backend Won't Start

**Symptom:** Health check fails, logs show import errors

**Solution:**
```bash
# Check requirements.render.txt is used (not requirements.txt)
# Verify start.sh has execute permissions
# Check APP_ENV=prod is set
```

### Frontend Can't Reach Backend

**Symptom:** CORS errors, "Failed to fetch" in console

**Solution:**
```bash
# Verify CORS_ORIGINS matches exact frontend URL
# Check VITE_API_BASE_URL points to correct backend URL
# Ensure backend health check passes
```

### High Memory Usage

**Symptom:** App crashes with OOM error

**Solution:**
```bash
# Verify using requirements.render.txt (not requirements.txt)
# Check RAG_ENABLED=false (default in prod)
# Upgrade to Standard tier if needed
```

---

## Deployment Workflow

1. **Push to GitHub:**
   ```bash
   git add -A
   git commit -m "Production-ready deployment"
   git push origin main
   ```

2. **Deploy Backend:**
   - Create Web Service on Render
   - Connect to GitHub repo
   - Set root directory: `backend`
   - Configure build/start commands
   - Set environment variables
   - Deploy

3. **Deploy Frontend:**
   - Create Static Site on Render
   - Connect to GitHub repo
   - Set root directory: `frontend`
   - Configure build command
   - Set VITE_API_BASE_URL to backend URL
   - Deploy

4. **Update CORS:**
   - After frontend deployed, note its URL
   - Update backend CORS_ORIGINS to frontend URL
   - Redeploy backend

5. **Verify:**
   - Test frontend loads
   - Test API connectivity
   - Run smoke test: [docs/HOSTED_SMOKE_TEST.md](docs/HOSTED_SMOKE_TEST.md)

---

## Support Resources

- [RENDER_DEPLOY.md](docs/RENDER_DEPLOY.md) - Full deployment guide
- [HOSTED_SMOKE_TEST.md](docs/HOSTED_SMOKE_TEST.md) - Post-deployment verification
- [PRODUCTION_STARTUP_VERIFIED.md](PRODUCTION_STARTUP_VERIFIED.md) - Startup details
- [RAG_LAZY_LOADING_COMPLETE.md](RAG_LAZY_LOADING_COMPLETE.md) - Dependency optimization
- [REQUIREMENTS_STRATEGY.md](docs/REQUIREMENTS_STRATEGY.md) - Requirements explanation
