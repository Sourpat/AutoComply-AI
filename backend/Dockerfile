# ---------- Base image ----------
FROM python:3.12-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# System deps (for pdf2image / poppler etc.)
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        gcc \
        libc6-dev \
        poppler-utils \
    && rm -rf /var/lib/apt/lists/*

# ---------- Workdir & deps ----------
WORKDIR /app

# Install Python deps
# Use lean requirements for production (APP_ENV=prod), full requirements for dev
COPY requirements.txt requirements.render.txt /app/
ARG APP_ENV=dev
RUN pip install --upgrade pip && \
    if [ "$APP_ENV" = "prod" ]; then \
        echo "Installing production dependencies (lean)..." && \
        pip install -r /app/requirements.render.txt; \
    else \
        echo "Installing full dependencies (dev)..." && \
        pip install -r /app/requirements.txt; \
    fi

# ---------- App code ----------
COPY . /app

# Create data directories
RUN mkdir -p /app/data/exports

# Ensure start script is executable
RUN chmod +x /app/start.sh

# Expose FastAPI port
EXPOSE 8001

# ---------- Run ----------
# NOTE: main:app must match backend/src/api/main.py (app = FastAPI())
CMD ["/app/start.sh"]
