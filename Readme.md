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
