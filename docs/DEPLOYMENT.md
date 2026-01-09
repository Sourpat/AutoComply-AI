# AutoComply AI - Deployment Guide

This guide covers local development setup, production builds, and deployment configuration for AutoComply AI.

## Table of Contents

1. [Local Development Setup](#local-development-setup)
2. [Production Build](#production-build)
3. [Environment Variables Reference](#environment-variables-reference)
4. [Deployment Steps](#deployment-steps)
5. [Troubleshooting](#troubleshooting)

---

## Local Development Setup

### Prerequisites

- **Python 3.12** for backend
- **Node.js 18+** and npm for frontend
- **Git** for version control

### Quick Start

#### 1. Clone and Setup Backend

```powershell
# Navigate to backend directory
cd backend

# Create Python virtual environment (Python 3.12)
py -3.12 -m venv .venv

# Activate virtual environment
.venv\Scripts\activate

# Install dependencies
python -m pip install --upgrade pip
python -m pip install -r requirements.txt

# Copy environment configuration
cp .env.example .env
# Edit .env and add your API keys if needed

# Initialize database (migrations run automatically)
# Database will be created at: app/data/autocomply.db
```

#### 2. Setup Frontend

```powershell
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install

# Copy environment configuration
cp .env.example .env
# For local dev, default values should work
```

#### 3. Start Development Servers

**Option A: Using VS Code Tasks (Recommended)**

Run the task: `HITL: Run Demo (Servers)` which starts both:
- Backend API on http://127.0.0.1:8001
- Frontend dev server on http://localhost:5173

**Option B: Manual Start**

Terminal 1 (Backend):
```powershell
cd backend
.venv\Scripts\python -m uvicorn src.api.main:app --reload --host 127.0.0.1 --port 8001
```

Terminal 2 (Frontend):
```powershell
cd frontend
npm run dev
```

#### 4. Access Application

- **Frontend**: http://localhost:5173
- **Backend API Docs**: http://127.0.0.1:8001/docs
- **Backend Health**: http://127.0.0.1:8001/health

### Development Database

The SQLite database is created automatically at `backend/app/data/autocomply.db` on first run. Migrations are applied automatically.

To reset the database:
```powershell
cd backend
Remove-Item app/data/autocomply.db
# Restart backend - database will be recreated
```

---

## Production Build

### Backend Production Configuration

#### 1. Environment Variables

Create `backend/.env` with production values:

```bash
# Application environment
APP_ENV=prod

# Server configuration
PORT=8001

# CORS origins (comma-separated, no wildcards)
CORS_ORIGINS=https://autocomply.example.com,https://admin.autocomply.example.com

# Database path (absolute path recommended)
DB_PATH=/var/lib/autocomply/autocomply.db

# Export directory (absolute path recommended)
EXPORT_DIR=/var/lib/autocomply/exports

# AI API keys
AUTOCOMPLY_OPENAI_KEY=sk-proj-your-actual-key
AUTOCOMPLY_GEMINI_KEY=AIzaSy-your-actual-key
```

#### 2. Run Backend in Production

**Using start.sh script (Recommended for hosted platforms):**
```bash
# Set PORT environment variable (e.g., from Heroku, Railway, Render)
export PORT=8001

# Run production start script (sets APP_ENV=prod automatically)
chmod +x start.sh
./start.sh
```

**For Procfile-based platforms (Heroku, Railway, etc.):**
```
web: cd backend && ./start.sh
```

Or directly:
```
web: cd backend && python -m uvicorn src.api.main:app --host 0.0.0.0 --port $PORT
```

**Using Uvicorn directly:**
```bash
# Single worker (development-like)
python -m uvicorn src.api.main:app --host 0.0.0.0 --port 8001

# Multiple workers (production)
python -m uvicorn src.api.main:app --host 0.0.0.0 --port 8001 --workers 4
```

**Using environment variable for port:**
```bash
# Reads PORT from .env file or environment
export APP_ENV=prod
python -m uvicorn src.api.main:app --host 0.0.0.0 --port ${PORT:-8001}
```

**Using gunicorn with uvicorn workers:**
```bash
gunicorn src.api.main:app --workers 4 --worker-class uvicorn.workers.UvicornWorker --bind 0.0.0.0:8001
```

### Frontend Production Build

#### 1. Environment Variables

Create `frontend/.env.production`:

```bash
# Production API URL
VITE_API_BASE_URL=https://api.autocomply.example.com

# Production environment
VITE_APP_ENV=prod

# Admin configuration
VITE_ADMIN_MODE=false
VITE_ADMIN_PASSCODE=your-secure-passcode-here
```

#### 2. Build Frontend

```bash
cd frontend

# Install dependencies
npm install

# Build for production
npm run build
```

This creates an optimized production build in `frontend/dist/`.

#### 3. Preview Build Locally (Optional)

```bash
# Preview on localhost
npm run preview

# Preview on network (0.0.0.0)
npm run preview:host
```

#### 4. Serve Frontend

The built files in `dist/` are static and can be served by any web server:

**Using nginx**:
```nginx
server {
    listen 80;
    server_name autocomply.example.com;
    
    root /path/to/frontend/dist;
    index index.html;
    
    # SPA routing - serve index.html for all routes
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    # API proxy (optional - can also use VITE_API_BASE_URL)
    location /api/ {
        proxy_pass http://127.0.0.1:8001/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

**Using serve**:
```bash
npm install -g serve
serve -s dist -l 3000
```

---

## Environment Variables Reference

### Backend Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `APP_ENV` | No | `dev` | Application environment: `dev` or `prod` |
| `PORT` | No | `8001` | Server port |
| `CORS_ORIGINS` | No | `*` | Comma-separated CORS origins. Use `*` for dev, specific origins for prod |
| `DB_PATH` | No | `app/data/autocomply.db` | SQLite database file path (relative or absolute) |
| `EXPORT_DIR` | No | `app/data/exports` | Export files directory (relative or absolute) |
| `AUTOCOMPLY_OPENAI_KEY` | Yes* | - | OpenAI API key for compliance analysis |
| `AUTOCOMPLY_GEMINI_KEY` | Yes* | - | Google Gemini API key for OCR/vision |
| `AUTOCOMPLY_N8N_BASE_URL` | No | - | n8n base URL for automation (optional) |
| `AUTOCOMPLY_N8N_SLACK_WEBHOOK_PATH` | No | - | n8n Slack webhook path (optional) |

*Required for AI features to work

### Frontend Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `VITE_API_BASE_URL` | No | `http://127.0.0.1:8001` | Backend API base URL |
| `VITE_APP_ENV` | No | `dev` | Application environment: `dev` or `prod` |
| `VITE_ADMIN_MODE` | No | `false` | Show admin features by default (dev only) |
| `VITE_ADMIN_PASSCODE` | No | `admin123` | Admin access passcode |

**Note**: All Vite environment variables must start with `VITE_` to be exposed to the client.

---

## Deployment Steps

### Step 1: Prepare Environment

1. **Clone repository**:
   ```bash
   git clone https://github.com/your-org/autocomply-ai.git
   cd autocomply-ai
   ```

2. **Create environment files**:
   ```bash
   cp backend/.env.example backend/.env
   cp frontend/.env.example frontend/.env.production
   ```

3. **Edit environment files** with production values (see [Environment Variables Reference](#environment-variables-reference))

### Step 2: Deploy Backend

1. **Install Python dependencies**:
   ```bash
   cd backend
   python -m venv .venv
   source .venv/bin/activate  # Linux/Mac
   # OR
   .venv\Scripts\activate     # Windows
   pip install -r requirements.txt
   ```

2. **Create data directories**:
   ```bash
   mkdir -p /var/lib/autocomply/exports
   ```

3. **Set permissions** (Linux/Mac):
   ```bash
   chown -R appuser:appuser /var/lib/autocomply
   ```

4. **Start backend**:

   **Option A: Using start.sh (Recommended)**
   ```bash
   cd backend
   chmod +x start.sh
   export PORT=8001
   ./start.sh
   ```

   **Option B: Direct uvicorn command**
   ```bash
   cd backend
   export APP_ENV=prod
   uvicorn src.api.main:app --host 0.0.0.0 --port 8001 --workers 4
   ```

   **Option C: Create a systemd service (Linux)**
   ```ini
   [Unit]
   Description=AutoComply AI Backend
   After=network.target

   [Service]
   Type=notify
   User=appuser
   WorkingDirectory=/path/to/autocomply-ai/backend
   Environment="PATH=/path/to/autocomply-ai/backend/.venv/bin"
   Environment="APP_ENV=prod"
   Environment="PORT=8001"
   ExecStart=/path/to/autocomply-ai/backend/start.sh
   Restart=always

   [Install]
   WantedBy=multi-user.target
   ```

### Step 3: Deploy Frontend

1. **Build frontend**:
   ```bash
   cd frontend
   npm install
   npm run build
   ```

2. **Copy build to web server**:
   ```bash
   cp -r dist/* /var/www/autocomply/
   ```

3. **Configure web server** (see nginx example in [Production Build](#production-build))

### Step 4: Verify Deployment

1. **Check backend health**:
   ```bash
   curl https://api.autocomply.example.com/health
   ```

2. **Check frontend**:
   - Visit https://autocomply.example.com
   - Verify API connectivity
   - Test core features

---

## Hosted Platform Deployment

AutoComply AI can be deployed to common hosted platforms with minimal configuration.

### Heroku / Railway / Render

These platforms automatically detect the PORT environment variable and provide build/start commands.

#### Backend Deployment

**Create `Procfile` in project root**:
```
web: cd backend && ./start.sh
```

**Or specify build and start commands directly**:
- **Install Command**: `cd backend && pip install -r requirements.txt`
- **Start Command**: `cd backend && python -m uvicorn src.api.main:app --host 0.0.0.0 --port $PORT`

**Environment Variables** (set in platform dashboard):
```
APP_ENV=prod
CORS_ORIGINS=https://your-frontend-url.com
AUTOCOMPLY_OPENAI_KEY=sk-proj-your-key
AUTOCOMPLY_GEMINI_KEY=AIzaSy-your-key
```

#### Frontend Deployment

**Build Configuration**:
- **Build Command**: `cd frontend && npm ci && npm run build`
- **Publish Directory**: `frontend/dist`
- **Install Command**: `cd frontend && npm ci`

**Environment Variables**:
```
VITE_API_BASE_URL=https://your-backend-url.com
VITE_APP_ENV=prod
```

**Static File Serving**:
All routes should serve `index.html` for SPA routing. Most platforms (Netlify, Vercel, Render Static Sites) handle this automatically.

For custom servers, add a `_redirects` file in `frontend/public/`:
```
/*  /index.html  200
```

### Vercel (Frontend Only)

Vercel is optimized for frontend deployment. Deploy backend separately (e.g., Railway, Render).

**vercel.json** (optional, in frontend directory):
```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ],
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": "vite"
}
```

### DigitalOcean App Platform

**Backend App**:
- **Type**: Web Service
- **Source Directory**: `backend`
- **Build Command**: `pip install -r requirements.txt`
- **Run Command**: `./start.sh`
- **Environment**: Add all required env vars

**Frontend App**:
- **Type**: Static Site
- **Source Directory**: `frontend`
- **Build Command**: `npm ci && npm run build`
- **Output Directory**: `dist`

---

## Run with Docker

Docker provides the easiest way to run AutoComply AI in production without manual environment setup.

### Prerequisites

- Docker Engine 20.10+
- Docker Compose 2.0+

### Quick Start with Docker Compose

1. **Clone repository**:
   ```bash
   git clone https://github.com/your-org/autocomply-ai.git
   cd autocomply-ai
   ```

2. **Start all services**:
   ```bash
   docker-compose up -d
   ```

   This starts:
   - **Backend API** on http://localhost:8001
   - **Frontend** on http://localhost:80
   - **n8n** (automation) on http://localhost:5678

3. **View logs**:
   ```bash
   docker-compose logs -f backend
   docker-compose logs -f frontend
   ```

4. **Stop services**:
   ```bash
   docker-compose down
   ```

### Docker Service Details

#### Backend Service
- **Image**: Python 3.12-slim
- **Port**: 8001
- **Volumes**: `backend_data:/app/data` (SQLite database persistence)
- **Environment**: Configured via docker-compose.yml

#### Frontend Service
- **Build**: Multi-stage (Node 20 build → nginx serve)
- **Port**: 80
- **Features**: 
  - Production-optimized nginx
  - SPA routing (serves index.html for all routes)
  - Gzip compression
  - Security headers

#### n8n Service (Optional)
- **Image**: n8nio/n8n:latest
- **Port**: 5678
- **Volumes**: `n8n_data:/home/node/.n8n` (workflow persistence)

### Customizing Docker Configuration

#### Backend Environment Variables

Edit `docker-compose.yml` to customize backend environment:

```yaml
services:
  backend:
    environment:
      - APP_ENV=prod
      - PORT=8001
      - CORS_ORIGINS=https://yourapp.com
      - DB_PATH=/app/data/autocomply.db
      - EXPORT_DIR=/app/data/exports
      - AUTOCOMPLY_OPENAI_KEY=sk-your-key
      - AUTOCOMPLY_GEMINI_KEY=your-key
```

#### Frontend API URL

For production deployments where frontend and backend are on different domains, update the nginx config in `frontend/Dockerfile` to proxy API requests:

```nginx
# Add to frontend/Dockerfile nginx config
location /api/ {
    proxy_pass http://backend:8001/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
}
```

Or rebuild frontend with production API URL:

```bash
cd frontend
VITE_API_BASE_URL=https://api.yourapp.com npm run build
```

### Building Individual Images

**Backend only**:
```bash
cd backend
docker build -t autocomply-backend:latest .
docker run -p 8001:8001 autocomply-backend:latest
```

**Frontend only**:
```bash
cd frontend
docker build -t autocomply-frontend:latest .
docker run -p 80:80 autocomply-frontend:latest
```

### Data Persistence

The `backend_data` volume persists:
- SQLite database (`/app/data/autocomply.db`)
- Export files (`/app/data/exports`)

**Backup database**:
```bash
docker-compose exec backend cp /app/data/autocomply.db /app/data/autocomply.db.backup
docker cp autocomply-backend:/app/data/autocomply.db.backup ./backup.db
```

**Restore database**:
```bash
docker cp ./backup.db autocomply-backend:/app/data/autocomply.db
docker-compose restart backend
```

### Production Deployment with Docker

For production deployment:

1. **Update docker-compose.yml** with production environment variables
2. **Configure CORS** to allow only your frontend domain
3. **Use reverse proxy** (nginx/Caddy) for SSL/TLS termination
4. **Set up monitoring** with Docker health checks
5. **Configure backups** for `backend_data` volume

**Example production docker-compose override** (`docker-compose.prod.yml`):

```yaml
version: "3.9"

services:
  backend:
    environment:
      - APP_ENV=prod
      - CORS_ORIGINS=https://app.yourcompany.com
      - AUTOCOMPLY_OPENAI_KEY=${OPENAI_KEY}
      - AUTOCOMPLY_GEMINI_KEY=${GEMINI_KEY}
    restart: always

  frontend:
    restart: always
    
  n8n:
    restart: always
```

Run with:
```bash
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

---

## Troubleshooting

### Backend Issues

#### Database Connection Error
```
sqlite3.OperationalError: unable to open database file
```

**Solution**: Check DB_PATH and ensure directory exists and has write permissions:
```bash
mkdir -p $(dirname $DB_PATH)
chmod 755 $(dirname $DB_PATH)
```

#### CORS Errors in Production
```
Access to fetch at 'https://api.example.com' from origin 'https://app.example.com' has been blocked by CORS
```

**Solution**: Add frontend origin to CORS_ORIGINS in backend .env:
```bash
CORS_ORIGINS=https://app.example.com,https://admin.example.com
```

#### Port Already in Use
```
OSError: [Errno 98] Address already in use
```

**Solution**: Change PORT in .env or kill process using the port:
```bash
# Find process
lsof -i :8001  # Linux/Mac
netstat -ano | findstr :8001  # Windows

# Kill process
kill -9 <PID>  # Linux/Mac
taskkill /PID <PID> /F  # Windows
```

### Frontend Issues

#### API Connection Failed
```
Failed to fetch: http://127.0.0.1:8001/api/...
```

**Solution**: Update VITE_API_BASE_URL in .env.production to correct backend URL

#### Build Errors
```
vite build failed
```

**Solution**: 
1. Clear node_modules and reinstall:
   ```bash
   rm -rf node_modules package-lock.json
   npm install
   ```
2. Check for TypeScript errors:
   ```bash
   npm run type-check
   ```

#### Blank Page After Deployment
- Check browser console for errors
- Verify base path in vite.config.ts matches deployment path
- Ensure all files in dist/ are uploaded
- Check web server routing for SPA (all routes should serve index.html)

### Database Issues

#### Missing Column Errors
```
sqlite3.OperationalError: no such column: searchable_text
```

**Solution**: Migration should run automatically on startup. If not, backup and recreate database:
```bash
cp app/data/autocomply.db app/data/autocomply.db.backup
rm app/data/autocomply.db
# Restart backend - migrations will run
```

#### Database Locked
```
sqlite3.OperationalError: database is locked
```

**Solution**: 
- Ensure only one backend instance is running
- Check for stale lock files
- Consider using connection pooling or read-only mode for additional instances

---

## Security Checklist

Before deploying to production:

- [ ] Change VITE_ADMIN_PASSCODE to a strong password
- [ ] Set APP_ENV=prod in backend
- [ ] Configure specific CORS_ORIGINS (no wildcards)
- [ ] Use HTTPS for all connections
- [ ] Store .env files securely (never commit to git)
- [ ] Rotate API keys regularly
- [ ] Set up database backups
- [ ] Configure rate limiting (e.g., nginx)
- [ ] Enable firewall rules
- [ ] Set up monitoring and logging

---

## Additional Resources

- [API Documentation](./api_reference.md)
- [Architecture Overview](./architecture.md)
- [Quick Start Guide](../QUICK_START_AFTER_FIX.md)
- [HITL Demo Guide](../HITL_DEMO_GUIDE.md)

---

**Need Help?** Check existing issues or create a new one with:
- Environment details (OS, Python version, Node version)
- Error messages and stack traces
- Steps to reproduce
- Configuration (sanitized .env)
