from __future__ import annotations

from datetime import datetime, timezone
from typing import Dict, List

from src.autocomply.domain.submissions_store import (
    Submission,
    SubmissionPriority,
    SubmissionStatus,
    SubmissionStore,
)


def _iso_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def seed_demo_submissions(store: SubmissionStore) -> List[Dict[str, str]]:
    now = _iso_now()

    demo_submissions = [
        {
            "submission_id": "demo-sub-1",
            "csf_type": "practitioner",
            "tenant": "ohio",
            "title": "Practitioner CSF – Demo Approved",
            "subtitle": "Approved: all required fields satisfied",
            "trace_id": "trace-demo-1",
            "decision_status": "approved",
            "risk_level": "Low",
            "priority": SubmissionPriority.MEDIUM,
            "payload": {
                "id": "demo-sub-1",
                "form": {
                    "dea_number": "AB1234567",
                    "dea_expiration": "2026-01-01",
                    "state_license_number": "SL-123",
                    "state_license_expiration": "2026-01-01",
                    "state": "OH",
                    "requested_schedules": ["II", "III"],
                },
            },
        },
        {
            "submission_id": "demo-sub-2",
            "csf_type": "practitioner",
            "tenant": "ohio",
            "title": "Practitioner CSF – Demo Review",
            "subtitle": "Needs review: schedules missing",
            "trace_id": "trace-demo-2",
            "decision_status": "needs_review",
            "risk_level": "Medium",
            "priority": SubmissionPriority.MEDIUM,
            "payload": {
                "id": "demo-sub-2",
                "form": {
                    "dea_number": "CD7654321",
                    "dea_expiration": "2026-02-01",
                    "state_license_number": "SL-456",
                    "state_license_expiration": "2026-02-01",
                    "state": "OH",
                },
            },
        },
        {
            "submission_id": "demo-sub-3",
            "csf_type": "hospital",
            "tenant": "ohio",
            "title": "Hospital CSF – Demo Blocked",
            "subtitle": "Blocked: missing TDDD certificate",
            "trace_id": "trace-demo-3",
            "decision_status": "blocked",
            "risk_level": "High",
            "priority": SubmissionPriority.HIGH,
            "payload": {
                "id": "demo-sub-3",
                "form": {
                    "state": "OH",
                    "facility_name": "Ohio General Hospital",
                    "facility_type": "hospital",
                    "authorized_schedules": ["II"],
                    "attestation_complete": "yes",
                    "tddd_expiration": "2025-05-01",
                },
            },
        },
    ]

    inserted: List[Dict[str, str]] = []
    for demo in demo_submissions:
        submission = Submission(
            submission_id=demo["submission_id"],
            csf_type=demo["csf_type"],
            tenant=demo["tenant"],
            status=SubmissionStatus.SUBMITTED,
            priority=demo["priority"],
            created_at=now,
            updated_at=now,
            title=demo["title"],
            subtitle=demo["subtitle"],
            trace_id=demo["trace_id"],
            payload=demo["payload"],
            decision_status=demo["decision_status"],
            risk_level=demo["risk_level"],
        )

        store._store[submission.submission_id] = submission
        inserted.append({"id": submission.submission_id, "trace_id": submission.trace_id})

    return inserted
