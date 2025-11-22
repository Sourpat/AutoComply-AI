from typing import List

from fastapi import APIRouter

from src.autocomply.domain.compliance_artifacts import (
    COMPLIANCE_ARTIFACTS,
    ComplianceArtifact,
)

router = APIRouter(
    prefix="/compliance",
    tags=["compliance"],
)


@router.get("/artifacts", response_model=List[ComplianceArtifact])
async def list_compliance_artifacts() -> List[ComplianceArtifact]:
    """
    Return the registry of compliance artifacts (Ohio TDDD, CSFs, addendums, etc.)
    with their current modeling/engine status.
    """
    return COMPLIANCE_ARTIFACTS
