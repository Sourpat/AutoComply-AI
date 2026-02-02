from __future__ import annotations

from typing import List

from fastapi import APIRouter, HTTPException

from src.policy.contracts import get_active_contract, get_contract_by_version, list_contracts
from src.policy.models import AiDecisionContract

router = APIRouter(prefix="/api/policy", tags=["policy-contracts"])


@router.get("/contracts", response_model=List[AiDecisionContract])
def list_contracts_endpoint() -> List[AiDecisionContract]:
    return list_contracts()


@router.get("/contracts/active", response_model=AiDecisionContract)
def get_active_contract_endpoint() -> AiDecisionContract:
    contract = get_active_contract()
    if not contract:
        raise HTTPException(status_code=404, detail="Active contract not found")
    return contract


@router.get("/contracts/{version}", response_model=AiDecisionContract)
def get_contract_by_version_endpoint(version: str) -> AiDecisionContract:
    contract = get_contract_by_version(version)
    if not contract:
        raise HTTPException(status_code=404, detail="Contract version not found")
    return contract
