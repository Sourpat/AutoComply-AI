from typing import Dict

from src.rag.license_copilot_prompt import build_license_copilot_prompt
from src.rag.engine import rag_engine


class LicenseCopilotResult:
    def __init__(
        self,
        status: str,
        reason: str,
        missing_fields,
        regulatory_references,
        rag_explanation: str,
        artifacts_used,
        rag_sources,
    ) -> None:
        self.status = status
        self.reason = reason
        self.missing_fields = missing_fields
        self.regulatory_references = regulatory_references
        self.rag_explanation = rag_explanation
        self.artifacts_used = artifacts_used
        self.rag_sources = rag_sources


async def run_license_copilot(license_request: Dict) -> LicenseCopilotResult:
    license_type = license_request.get("license_type", "ohio_tddd")

    if license_type == "ohio_tddd":
        doc_id = "ohio_tddd_rules"
    elif license_type == "ny_pharmacy":
        doc_id = "ny_pharmacy_rules"
    else:
        doc_id = license_request.get("doc_id", "ohio_tddd_rules")

    prompt = build_license_copilot_prompt(
        license_type=license_type,
        payload=license_request,
    )

    rag_response = await rag_engine.run_explainer(
        prompt=prompt,
        context_filters={"doc_id": doc_id},
    )

    return LicenseCopilotResult(
        status=rag_response.status,
        reason=rag_response.reason,
        missing_fields=rag_response.missing_fields,
        regulatory_references=rag_response.regulatory_references,
        rag_explanation=rag_response.rag_explanation,
        artifacts_used=rag_response.artifacts_used,
        rag_sources=rag_response.rag_sources,
    )
