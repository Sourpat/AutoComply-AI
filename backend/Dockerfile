# ---------- Base image ----------
FROM python:3.10-slim AS base

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
COPY requirements.txt /app/requirements.txt
RUN pip install --upgrade pip && \
    pip install -r /app/requirements.txt

# ---------- App code ----------
COPY . /app

# Expose FastAPI port
EXPOSE 8000

# ---------- Run ----------
# NOTE: main:app must match backend/src/api/main.py (app = FastAPI())
CMD ["uvicorn", "src.api.main:app", "--host", "0.0.0.0", "--port", "8000"]
