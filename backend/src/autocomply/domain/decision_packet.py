from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from src.autocomply.domain.verifier_store import get_case, list_events, list_notes

_EVENT_TYPE_MAP = {
    "verifier_assigned": "assigned",
    "verifier_unassigned": "unassigned",
    "verifier_action": "action",
    "case_action": "action",
    "action_taken": "action",
    "assigned": "assigned",
    "unassigned": "unassigned",
    "action": "action",
}


def _public_event_type(event_type: Optional[str]) -> Optional[str]:
    if event_type is None:
        return None
    return _EVENT_TYPE_MAP.get(event_type, event_type)
from src.autocomply.domain.attachments_store import list_attachments_for_submission
from src.api.routes.rag_regulatory import ExplainV1Request, build_explain_contract_v1
from src.autocomply.domain.explainability.versioning import get_knowledge_version


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _parse_payload(payload_json: Optional[str]) -> Any:
    if not payload_json:
        return None
    try:
        return json.loads(payload_json)
    except json.JSONDecodeError:
        return payload_json


def _build_explain_stub() -> Dict[str, Any]:
    return {
        "knowledge_version": get_knowledge_version(),
        "citations": [],
        "rationale": "Explain not available for this case.",
        "signals": [],
        "policy_hits": [],
    }


async def build_decision_packet(
    case_id: str,
    *,
    actor: Optional[str] = None,
    include_explain: bool = True,
) -> Dict[str, Any]:
    payload = get_case(case_id)
    if not payload:
        raise ValueError("Case not found")

    case = payload["case"]
    events = list_events(case_id)
    notes = list_notes(case_id)

    actions = []
    for event in events:
        event_type = _public_event_type(event.get("event_type"))
        if event_type in {"action", "note", "assigned", "unassigned"}:
            actions.append(
                {
                    "event_type": event_type,
                    "created_at": event.get("created_at"),
                    "payload": _parse_payload(event.get("payload_json")),
                }
            )
    for note in notes:
        actions.append(
            {
                "event_type": "note",
                "created_at": note.get("created_at"),
                "payload": {
                    "note": note.get("note"),
                    "actor": note.get("actor"),
                },
            }
        )

    timeline = [
        {
            "event_type": _public_event_type(event.get("event_type")),
            "created_at": event.get("created_at"),
            "payload": _parse_payload(event.get("payload_json")),
        }
        for event in events
    ]

    explain_payload = None
    if include_explain:
        try:
            explain = await build_explain_contract_v1(
                ExplainV1Request(submission_id=case.get("submission_id")),
            )
            citations = []
            for citation in explain.citations:
                citations.append(citation.model_dump())
            citations = sorted(
                citations,
                key=lambda c: (
                    str(c.get("source_title") or c.get("doc_id") or ""),
                    str(c.get("citation") or ""),
                    str(c.get("chunk_id") or ""),
                ),
            )
            explain_payload = {
                "knowledge_version": explain.knowledge_version,
                "citations": citations,
                "rationale": explain.summary,
                "signals": [
                    {
                        "key": field.key,
                        "category": field.category,
                        "reason": field.reason,
                    }
                    for field in explain.missing_fields
                ],
                "policy_hits": [rule.id for rule in explain.fired_rules],
            }
        except Exception:
            explain_payload = _build_explain_stub()

    attachments = []
    submission_id = case.get("submission_id")
    if submission_id:
        attachments = [
            {
                "id": record.get("attachment_id"),
                "filename": record.get("filename"),
                "content_type": record.get("content_type"),
                "size": record.get("byte_size"),
                "sha256": record.get("sha256"),
            }
            for record in list_attachments_for_submission(submission_id)
        ]

    return {
        "packet_version": "dp-v1",
        "case": {
            "case_id": case.get("case_id"),
            "status": case.get("status"),
            "priority": "medium",
            "jurisdiction": case.get("jurisdiction"),
            "created_at": case.get("created_at"),
            "assignee": case.get("assignee"),
            "locked": case.get("locked"),
        },
        "verifier": {
            "actor": actor,
            "generated_at": _now_iso(),
        },
        "finalization": {
            "is_final": bool(case.get("locked")),
            "decision": case.get("decision"),
        },
        "actions": actions,
        "timeline": timeline,
        "evidence": {
            "attachments": attachments,
        },
        "explain": explain_payload,
    }
