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

### 🎥 Demo Script

For a step-by-step 5–8 minute walkthrough of the project (manual JSON
validation, PDF validation, and regulatory context), see:

- [`docs/demo_script_autocomply.md`](docs/demo_script_autocomply.md)
