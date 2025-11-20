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

### 🐳 Run backend with Docker (local)

From the project root:

```bash
cd backend
docker build -t autocomply-backend .
docker run -p 8000:8000 --env-file ../.env autocomply-backend
```

The API will be available at http://localhost:8000.
Make sure .env contains your AUTOCOMPLY_OPENAI_KEY and AUTOCOMPLY_GEMINI_KEY.
