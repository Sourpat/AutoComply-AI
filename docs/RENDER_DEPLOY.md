# AutoComply AI - Render Deployment Guide

This guide provides step-by-step instructions for deploying AutoComply AI to Render.com with a backend web service and frontend static site.

## Overview

**Render Services:**
- **Backend**: Web Service (Python/FastAPI)
- **Frontend**: Static Site (React/Vite)
- **Database**: SQLite with persistent disk
- **Estimated Cost**: ~$7-14/month (Starter tier)

**Deployment Strategy:**
- **Production**: Uses `requirements.render.txt` (lean, ~50 MB dependencies)
  - Excludes heavy ML libraries (torch, transformers, chromadb, sentence-transformers)
  - Faster builds (~2-3 min vs 10-15 min)
  - Lower memory footprint (512 MB vs 2 GB)
- **Local Development**: Uses `requirements.txt` (full, ~500 MB dependencies)
  - Includes RAG and embedding capabilities for testing

---

## Prerequisites

1. **Render Account**: Sign up at [render.com](https://render.com)
2. **Git Repository**: Push your code to GitHub, GitLab, or Bitbucket
3. **API Keys**: OpenAI API key (required for AI features)

---

## Part A: Backend Web Service

### Step 1: Create Web Service

1. **Navigate to Render Dashboard**
   - Click **"New +"** → **"Web Service"**

2. **Connect Repository**
   - Select your Git repository
   - Click **"Connect"**

3. **Configure Service**
   - **Name**: `autocomply-backend` (or your choice)
   - **Region**: Choose closest to your users
   - **Branch**: `main` (or your production branch)
   - **Root Directory**: `backend`
   - **Runtime**: `Python 3`
   - **Build Command**: 
     ```bash
     pip install -r requirements.render.txt
     ```
     **Note**: Uses lean production requirements (excludes heavy ML dependencies)
   - **Start Command**:
     ```bash
     python -m uvicorn src.api.main:app --host 0.0.0.0 --port $PORT
     ```

4. **Instance Type**
   - **Free Tier**: Limited to 750 hours/month, spins down after inactivity
   - **Starter ($7/month)**: Always running, recommended for demos
   - **Standard ($25/month)**: Production workloads

5. **Click "Advanced"** and set **Auto-Deploy**: `Yes`

### Step 2: Add Environment Variables

Click **"Environment"** tab and add these variables:

| Key | Value | Notes |
|-----|-------|-------|
| `APP_ENV` | `prod` | Sets production mode |
| `PORT` | (auto-set) | Render provides this automatically |
| `CORS_ORIGINS` | `https://your-frontend.onrender.com` | Replace with actual frontend URL (see Part C) |
| `DB_PATH` | `/var/data/autocomply.db` | SQLite database path on persistent disk |
| `EXPORT_DIR` | `/var/data/exports` | Export files directory |
| `AUTOCOMPLY_OPENAI_KEY` | `sk-proj-your-key` | **Required** - Your OpenAI API key |
| `AUTOCOMPLY_GEMINI_KEY` | `AIzaSy-your-key` | Optional - Google Gemini API key |
| `AUTOCOMPLY_N8N_BASE_URL` | (optional) | n8n automation URL if using |

**Security Note**: Render encrypts environment variables at rest.

### Step 3: Create Service

Click **"Create Web Service"** - Render will:
1. Clone your repository
2. Install dependencies (pip install -r requirements.render.txt - ~50 MB vs ~500 MB)
3. Start the server
4. Assign a URL: `https://autocomply-backend-xxxxx.onrender.com`

**Wait for deployment** (usually 2-5 minutes).

---

## Part B: Add Persistent Disk (Database & Exports)

By default, Render's filesystem is ephemeral. A persistent disk ensures your SQLite database and export files survive deployments.

### Step 1: Create Persistent Disk

1. **In your Backend Web Service**, click **"Disks"** tab
2. Click **"Add Disk"**
3. **Configure Disk**:
   - **Name**: `autocomply-data`
   - **Mount Path**: `/var/data`
   - **Size**: `1 GB` (sufficient for demos; increase for production)
4. Click **"Save"**

**Render will redeploy** your service with the disk attached.

### Step 2: Verify Disk

After redeployment:
1. Go to **"Shell"** tab
2. Run:
   ```bash
   ls -la /var/data
   ```
3. You should see the directory exists

### Step 3: Database Initialization

The SQLite database will be created automatically on first startup at `/var/data/autocomply.db`. Migrations run automatically via `src.db.migrations.run_migrations()` in `src/api/main.py`.

**Check Logs** (Logs tab) for:
```
INFO:     Application startup complete.
```

---

## Part C: Frontend Static Site

### Step 1: Create Static Site

1. **Navigate to Render Dashboard**
   - Click **"New +"** → **"Static Site"**

2. **Connect Repository**
   - Select the same Git repository
   - Click **"Connect"**

3. **Configure Static Site**
   - **Name**: `autocomply-frontend` (or your choice)
   - **Branch**: `main`
   - **Root Directory**: `frontend`
   - **Build Command**:
     ```bash
     npm ci && npm run build
     ```
   - **Publish Directory**: `dist`

4. **Click "Advanced"** and set **Auto-Deploy**: `Yes`

### Step 2: Add Environment Variables

Click **"Environment"** tab:

| Key | Value | Notes |
|-----|-------|-------|
| `VITE_API_BASE_URL` | `https://autocomply-backend-xxxxx.onrender.com` | Your backend URL from Part A |
| `VITE_APP_ENV` | `prod` | Production environment |
| `VITE_ADMIN_MODE` | `false` | Hide admin features by default |
| `VITE_ADMIN_PASSCODE` | `your-secure-passcode` | Change from default |

**Important**: Replace `autocomply-backend-xxxxx.onrender.com` with your actual backend URL.

### Step 3: Add SPA Rewrite Rules

React Router requires all routes to serve `index.html` for client-side routing.

1. Click **"Redirects/Rewrites"** tab
2. Click **"Add Rule"**
3. **Configure Rule**:
   - **Source**: `/*`
   - **Destination**: `/index.html`
   - **Action**: `Rewrite`
4. Click **"Save"**

### Step 4: Create Static Site

Click **"Create Static Site"** - Render will:
1. Clone your repository
2. Install dependencies (npm ci)
3. Build production bundle (npm run build)
4. Deploy static files from `dist/`
5. Assign a URL: `https://autocomply-frontend-xxxxx.onrender.com`

**Wait for deployment** (usually 1-3 minutes).

---

## Part D: Update CORS Origins

After your frontend is deployed, update the backend CORS setting:

1. Go to **Backend Web Service** → **"Environment"** tab
2. Update `CORS_ORIGINS`:
   ```
   https://autocomply-frontend-xxxxx.onrender.com
   ```
   (Replace with your actual frontend URL)
3. Click **"Save Changes"**

Render will **automatically redeploy** the backend with the new CORS setting.

---

## Verification Checklist

### Backend Health Check

1. Visit: `https://autocomply-backend-xxxxx.onrender.com/health`
2. Expected response:
   ```json
   {"status": "ok"}
   ```

3. Visit: `https://autocomply-backend-xxxxx.onrender.com/workflow/health`
4. Expected response:
   ```json
   {
     "ok": true,
     "env": "prod",
     "version": "0.1.0"
   }
   ```

### Frontend Verification

1. Visit: `https://autocomply-frontend-xxxxx.onrender.com`
2. Expected: Home page loads
3. Test navigation:
   - Click **"Chat"** - should load chat interface
   - Click **"Console"** - should load compliance console
   - Refresh page on any route - should not show 404

### API Connectivity

1. Open browser DevTools (F12) → **Network** tab
2. Navigate to **Console** page
3. Check API calls:
   - Should see requests to `autocomply-backend-xxxxx.onrender.com`
   - Status codes should be `200 OK`
   - No CORS errors in console

---

## Troubleshooting

### Issue 1: CORS Errors

**Symptom**:
```
Access to fetch at 'https://autocomply-backend-xxxxx.onrender.com/api/...' 
from origin 'https://autocomply-frontend-xxxxx.onrender.com' has been blocked by CORS policy
```

**Solution**:
1. Go to **Backend Web Service** → **Environment**
2. Verify `CORS_ORIGINS` matches your frontend URL **exactly**
3. Include protocol (`https://`) and no trailing slash
4. For multiple origins, use comma-separated list:
   ```
   https://app1.onrender.com,https://app2.onrender.com
   ```
5. Save and wait for redeployment

**Development Workaround** (temporary):
- Set `CORS_ORIGINS=*` to allow all origins
- **Security Warning**: Never use `*` in production

### Issue 2: API Base URL Incorrect

**Symptom**:
- API calls go to `http://127.0.0.1:8001` instead of Render backend
- Network errors: `Failed to fetch`

**Solution**:
1. Go to **Frontend Static Site** → **Environment**
2. Verify `VITE_API_BASE_URL` is set correctly:
   ```
   https://autocomply-backend-xxxxx.onrender.com
   ```
3. **Important**: No trailing slash
4. Save changes
5. Render will automatically rebuild and redeploy

**Check Current Value**:
- Open browser console
- Run:
  ```javascript
  import.meta.env.VITE_API_BASE_URL
  ```
- Should show your backend URL

### Issue 3: SPA Refresh Returns 404

**Symptom**:
- Clicking links works fine
- Refreshing page on routes like `/console` or `/analytics` shows 404

**Solution**:
1. Go to **Frontend Static Site** → **Redirects/Rewrites**
2. Verify rule exists:
   - Source: `/*`
   - Destination: `/index.html`
   - Action: `Rewrite`
3. If missing, add the rule (see Part C, Step 3)
4. Redeploy if necessary

### Issue 4: Database Resets on Deploy

**Symptom**:
- Data disappears after each deployment
- Database starts empty

**Solution**:
1. Verify persistent disk is attached:
   - Go to **Backend Web Service** → **Disks**
   - Should see disk mounted at `/var/data`
2. Verify `DB_PATH` environment variable:
   ```
   DB_PATH=/var/data/autocomply.db
   ```
3. Check logs for database location:
   ```
   INFO:     Database: /var/data/autocomply.db
   ```

### Issue 5: Backend Takes Long to Start

**Symptom**:
- First request takes 30-60 seconds
- "Application startup complete" not in logs

**Possible Causes**:
1. **Free tier spin-down**: Free tier services sleep after 15 minutes of inactivity
   - **Solution**: Upgrade to Starter ($7/month) for always-on service
   - Or: Use external monitoring (UptimeRobot) to ping every 10 minutes

2. **Heavy dependencies**: sentence-transformers models download on first run
   - **Solution**: Models are cached after first download
   - Check logs for download progress

### Issue 6: Build Fails

**Backend Build Error**:
```
ERROR: Could not find a version that satisfies the requirement...
```

**Solution**:
1. Check `requirements.txt` for typos
2. Verify Python version (Render uses Python 3.11 by default)
3. Check build logs for specific error

**Frontend Build Error**:
```
npm ERR! code ELIFECYCLE
```

**Solution**:
1. Verify `package.json` scripts
2. Check for missing dependencies
3. Try building locally first:
   ```bash
   cd frontend
   npm ci
   npm run build
   ```

### Issue 7: Environment Variables Not Working

**Symptom**:
- Backend logs show `APP_ENV=dev` instead of `prod`
- Frontend uses wrong API URL

**Solution**:
1. Environment variables must be set **before** deployment
2. After adding/changing variables, Render redeploys automatically
3. Check **Events** tab for recent deployments
4. **Backend**: Variables are available immediately as `os.getenv()`
5. **Frontend**: Variables must start with `VITE_` and are embedded at **build time**
   - Changing frontend env vars triggers a rebuild

---

## Production Checklist

Before going live:

- [ ] Backend deployed and healthy (`/health` returns 200)
- [ ] Frontend deployed and accessible
- [ ] Persistent disk attached to backend (`/var/data`)
- [ ] `CORS_ORIGINS` set to frontend URL (no wildcards)
- [ ] `VITE_API_BASE_URL` points to backend URL
- [ ] SPA rewrite rule configured (`/* → /index.html`)
- [ ] `APP_ENV=prod` on backend
- [ ] `VITE_APP_ENV=prod` on frontend
- [ ] `AUTOCOMPLY_OPENAI_KEY` set (required for AI features)
- [ ] `VITE_ADMIN_PASSCODE` changed from default
- [ ] Database initializes successfully (check logs)
- [ ] Test all major features (Chat, Console, CSF forms)
- [ ] No CORS errors in browser console
- [ ] API calls succeed (200 status codes)

---

## Monitoring & Logs

### View Logs

**Backend Logs**:
1. Go to **Backend Web Service** → **Logs** tab
2. Real-time logs show:
   - Startup messages
   - API requests
   - Errors and exceptions

**Frontend Logs** (build only):
1. Go to **Frontend Static Site** → **Logs** tab
2. Shows build process output

### Metrics

**Backend Web Service**:
- **Metrics** tab shows:
  - CPU usage
  - Memory usage
  - Response times
  - Request count

**Frontend Static Site**:
- **Bandwidth** usage
- **Build history**

### Alerts

Set up email alerts:
1. Go to **Settings** → **Notifications**
2. Add email for deployment failures
3. Configure downtime alerts

---

## Scaling & Performance

### Backend Scaling

**Vertical Scaling** (more resources per instance):
- Starter: 512 MB RAM
- Standard: 2 GB RAM
- Pro: 4 GB RAM

**Horizontal Scaling** (multiple instances):
- Not needed for demos/small deployments
- For high traffic, consider Standard+ tier with multiple instances

### Frontend CDN

Render automatically serves static sites via CDN for fast global delivery.

### Database Considerations

**SQLite Limitations**:
- Single writer (no horizontal scaling)
- Good for up to ~100 concurrent users
- For larger scale, consider PostgreSQL

**To migrate to PostgreSQL**:
1. Create Render PostgreSQL database
2. Update `DATABASE_URL` environment variable
3. Migrate data using SQLAlchemy migrations

---

## Cost Estimate

| Service | Tier | Monthly Cost |
|---------|------|--------------|
| Backend Web Service | Starter | $7 |
| Frontend Static Site | Free | $0 |
| Persistent Disk (1 GB) | Included | $0 |
| **Total** | | **$7/month** |

**Free Tier Option**:
- Backend on Free tier (spins down after inactivity)
- Frontend always free
- Total: $0/month (limited availability)

---

## Next Steps

1. **Custom Domain** (optional):
   - Go to **Settings** → **Custom Domain**
   - Add your domain (e.g., `app.autocomply.ai`)
   - Configure DNS records
   - Render provides free SSL

2. **Continuous Deployment**:
   - Push to `main` branch → Auto-deploy
   - Set up staging environment (use `develop` branch)

3. **Database Backups**:
   - Download database periodically via Shell:
     ```bash
     cat /var/data/autocomply.db > backup.db
     ```
   - Or: Automate backups with cron job

4. **Monitoring**:
   - Integrate with Sentry for error tracking
   - Use Render's built-in metrics
   - Set up UptimeRobot for availability monitoring

---

## Support Resources

- **Render Docs**: https://render.com/docs
- **Render Community**: https://community.render.com
- **AutoComply Docs**: See `docs/DEPLOYMENT.md` for general deployment guide
- **Render Status**: https://status.render.com

---

**Last Updated**: January 8, 2026  
**Render Dashboard**: https://dashboard.render.com
