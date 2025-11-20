# AutoComply AI – 5–8 Minute Demo Script

This script is designed so you (or a reviewer) can demo AutoComply AI
quickly without digging into the code. It focuses on:

1. Manual JSON validation (frontend)
2. PDF validation (API / future n8n)
3. Regulatory context in the verdict

---

## 0. Pre-requisites

For a fully local demo:

- Docker & Docker Compose installed
- Repo cloned: `git clone https://github.com/<you>/AutoComply-AI.git`
- From the project root, ensure you have a `.env` in `backend/`:
  - You can start by copying `.env.example` → `.env`
  - For the current stubbed version, no real API keys are required

To run locally with Docker:

```bash
docker compose up --build
```
