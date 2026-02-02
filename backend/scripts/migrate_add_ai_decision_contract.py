"""
Migration: Add ai_decision_contract table and seed v1.

Run:
    cd backend
    .venv/Scripts/python scripts/migrate_add_ai_decision_contract.py
"""

import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from src.policy.migrations import ensure_ai_decision_contract


def migrate() -> None:
    print("[Migrate] Ensuring ai_decision_contract table and seed...")
    ensure_ai_decision_contract()
    print("[Migrate] ✅ Migration complete")


if __name__ == "__main__":
    migrate()
