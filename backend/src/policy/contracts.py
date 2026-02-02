from __future__ import annotations

import json
from typing import Any, Dict, List, Optional

from src.core.db import execute_sql, execute_update
from src.policy.models import AiDecisionContract, ContractRuleSet


def _row_to_contract(row: Dict[str, Any]) -> AiDecisionContract:
    rules = ContractRuleSet.model_validate(json.loads(row.get("rules_json") or "{}"))
    return AiDecisionContract(
        id=row.get("id"),
        version=str(row.get("version")),
        status=row.get("status"),
        created_at=row.get("created_at"),
        created_by=row.get("created_by"),
        effective_from=row.get("effective_from"),
        rules=rules,
    )


def list_contracts() -> List[AiDecisionContract]:
    rows = execute_sql(
        """
        SELECT id, version, status, created_at, created_by, effective_from, rules_json
        FROM ai_decision_contract
        ORDER BY effective_from DESC, version DESC
        """
    )
    return [_row_to_contract(row) for row in rows]


def get_contract_by_version(version: str) -> Optional[AiDecisionContract]:
    rows = execute_sql(
        """
        SELECT id, version, status, created_at, created_by, effective_from, rules_json
        FROM ai_decision_contract
        WHERE version = :version
        LIMIT 1
        """,
        {"version": version},
    )
    if not rows:
        return None
    return _row_to_contract(rows[0])


def get_active_contract() -> Optional[AiDecisionContract]:
    rows = execute_sql(
        """
        SELECT id, version, status, created_at, created_by, effective_from, rules_json
        FROM ai_decision_contract
        WHERE status = 'active'
        ORDER BY effective_from DESC, version DESC
        LIMIT 1
        """
    )
    if not rows:
        return None
    return _row_to_contract(rows[0])


def seed_contract_if_missing(contract: AiDecisionContract) -> None:
    existing = execute_sql(
        "SELECT 1 FROM ai_decision_contract WHERE version = :version",
        {"version": contract.version},
    )
    if existing:
        return

    execute_update(
        """
        INSERT INTO ai_decision_contract (
            version, status, created_at, created_by, effective_from, rules_json
        ) VALUES (
            :version, :status, :created_at, :created_by, :effective_from, :rules_json
        )
        """,
        {
            "version": contract.version,
            "status": contract.status,
            "created_at": contract.created_at,
            "created_by": contract.created_by,
            "effective_from": contract.effective_from,
            "rules_json": json.dumps(contract.rules.model_dump()),
        },
    )
