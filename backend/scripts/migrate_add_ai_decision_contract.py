"""
Migration: Add ai_decision_contract table and seed v1.

Run:
    cd backend
    .venv/Scripts/python scripts/migrate_add_ai_decision_contract.py
"""

import json
import sys
import os
from datetime import datetime, timezone

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from src.core.db import execute_sql, execute_update


def migrate() -> None:
    print("[Migrate] Creating ai_decision_contract table...")

    execute_update(
        """
        CREATE TABLE IF NOT EXISTS ai_decision_contract (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            version TEXT UNIQUE NOT NULL,
            status TEXT NOT NULL,
            created_at TEXT NOT NULL,
            created_by TEXT NOT NULL,
            effective_from TEXT NOT NULL,
            rules_json TEXT NOT NULL
        );
        """
    )

    execute_update(
        """
        CREATE INDEX IF NOT EXISTS idx_ai_decision_contract_status
        ON ai_decision_contract(status);
        """
    )

    execute_update(
        """
        CREATE INDEX IF NOT EXISTS idx_ai_decision_contract_effective
        ON ai_decision_contract(effective_from);
        """
    )

    print("[Migrate] Seeding v1 contract if missing...")
    existing = execute_sql(
        "SELECT 1 FROM ai_decision_contract WHERE version = :version",
        {"version": "v1"},
    )

    if not existing:
        now = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
        rules = {
            "auto_decision_allowed": True,
            "human_review_required": False,
            "confidence_threshold": 0.75,
            "override_mandatory": False,
            "audit_level": "standard",
            "escalate_on": {"risk_level": ["high"]},
            "block_on": {"flags": ["conflicts"]},
        }

        execute_update(
            """
            INSERT INTO ai_decision_contract (
                version, status, created_at, created_by, effective_from, rules_json
            ) VALUES (
                :version, :status, :created_at, :created_by, :effective_from, :rules_json
            )
            """,
            {
                "version": "v1",
                "status": "active",
                "created_at": now,
                "created_by": "system",
                "effective_from": now,
                "rules_json": json.dumps(rules),
            },
        )
        print("[Migrate] ✅ Seeded ai_decision_contract v1")
    else:
        print("[Migrate] ⚠️  v1 already exists, skipping seed")

    print("[Migrate] ✅ Migration complete")


if __name__ == "__main__":
    migrate()
