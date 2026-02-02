#!/bin/bash
# Production start script for AutoComply AI Backend
# 
# Usage:
#   export PORT=8001  # or any port from hosting provider
#   ./start.sh
#
# Environment variables:
#   PORT - Server port (defaults to 8001)
#   APP_ENV - Application environment (set to 'prod' here)
#   CORS_ORIGINS - Comma-separated list of allowed origins
#   DB_PATH - Database file path
#   EXPORT_DIR - Export files directory
#   OPENAI_API_KEY - OpenAI API key (required for AI features)
#
# Note: This script assumes production dependencies (requirements.render.txt)
#       are already installed. For local dev, use requirements.txt instead.

# Set production environment
export APP_ENV=prod

# Use PORT from environment, default to 8001
PORT=${PORT:-8001}

# Ensure AI decision contract table + seed exist (idempotent)
python scripts/migrate_add_ai_decision_contract.py

# Start uvicorn on all interfaces (0.0.0.0) to accept external connections
exec python -m uvicorn src.api.main:app --host 0.0.0.0 --port $PORT
