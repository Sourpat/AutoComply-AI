<p align="center">
  <strong>AutoComply AI</strong><br/>
  DEA &amp; State License Compliance Co-Pilot
</p>

<p align="center">
  <a href="https://github.com/Sourpat/AutoComply-AI/actions" target="_blank">
    <img src="https://img.shields.io/github/actions/workflow/status/Sourpat/AutoComply-AI/ci.yml?label=CI&style=flat-square" alt="CI Status" />
  </a>
  <img src="https://img.shields.io/badge/backend-FastAPI-009688?style=flat-square" alt="FastAPI" />
  <img src="https://img.shields.io/badge/frontend-React%20%2B%20Vite-61DAFB?style=flat-square" alt="React + Vite" />
  <img src="https://img.shields.io/badge/automation-n8n-orange?style=flat-square" alt="n8n" />
</p>

<p align="center">
  <a href="https://www.linkedin.com/in/sourabh-patil1995/">LinkedIn</a>
  &nbsp;•&nbsp;
  <a href="https://sourpat.github.io/sourabh-portfolio/">Portfolio</a>
</p>

---

# AutoComply-AI

## 🚀 Deployment & CI/CD

This project uses GitHub Actions to automate both testing (CI) and deployment (CD).

CI: On pull requests to main/develop, the ci.yml workflow installs dependencies (backend/requirements.txt) and runs pytest.

CD: On push to main, the cd.yml workflow builds a Docker image from the backend/ folder, pushes to Docker Hub, and deploys to your server via SSH.

Secrets required:

- DOCKER_USERNAME
- DOCKER_PASSWORD
- SERVER_IP
- SERVER_USER
- SSH_PRIVATE_KEY

Refer to the .env.example for local development and override in production environment.

### ✅ Backend tests

To run the backend tests locally:

```bash
cd backend
python -m pytest
```

The CI pipeline runs these tests on every pull request to protect the
core API (e.g., the JSON license validation endpoint).

### 🐳 Run backend with Docker (local)

From the project root:

```bash
cd backend
docker build -t autocomply-backend .
docker run -p 8000:8000 --env-file ../.env autocomply-backend
```

The API will be available at http://localhost:8000.
Make sure .env contains your AUTOCOMPLY_OPENAI_KEY and AUTOCOMPLY_GEMINI_KEY.

### 🧪 Local full stack with Docker Compose

To run the backend, frontend, and n8n together:

```bash
docker compose up --build
```

Services:

Backend: http://localhost:8000

Frontend: http://localhost:4173

n8n: http://localhost:5678

Make sure your project root has a .env file based on .env.example
with valid values for AUTOCOMPLY_OPENAI_KEY and AUTOCOMPLY_GEMINI_KEY.

### 🔌 API Overview

The main backend endpoints are documented in:

- [`docs/api_endpoints.md`](docs/api_endpoints.md)

These cover:

- JSON license validation (used by the React frontend)
- PDF license validation (used by n8n and future uploads)
- Optional event publishing to n8n for Slack alerts

### 📡 API Reference

For details on the public backend endpoints (JSON validation and PDF
validation), see:

- [`docs/api_reference.md`](docs/api_reference.md)

For an overview of all docs in one place, see:

- [`docs/index.md`](docs/index.md)

### 🎤 Demo Script

For a 3–5 minute guided walk-through you can use in interviews or live
demos, see:

- [`docs/demo_script.md`](docs/demo_script.md)

### 🖥️ Frontend Walkthrough

For an overview of the React UI (manual entry form, PDF upload, and
compliance card), see:

- [`docs/frontend_walkthrough.md`](docs/frontend_walkthrough.md)

### 📚 Case Study

For a narrative overview that ties AutoComply AI back to a real
enterprise controlled substance and license feature, see:

- [`docs/case_study_autocomply.md`](docs/case_study_autocomply.md)

### 🗺️ Roadmap

For how AutoComply AI can evolve from the current sandbox into a
full GenAI-powered compliance co-pilot, see:

- [`docs/roadmap.md`](docs/roadmap.md)

## 🔗 Project Links

- GitHub repository: this project
- Live demo (frontend): _[add URL once deployed via Vercel]_
- API base (backend): _[add URL once deployed via Render/Fly.io]_
- Author:
  - LinkedIn: <https://www.linkedin.com/in/sourabh-patil1995/>
  - Portfolio: <https://sourpat.github.io/sourabh-portfolio/>
