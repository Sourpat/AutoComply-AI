# backend/src/api/routes/ops.py
"""
Ops Dashboard endpoints for Verification team.
Read-only endpoints that provide operational metrics and review queue analytics.

SECURITY: All endpoints require admin role via X-User-Role header.
"""

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel
from typing import Any, Annotated, Dict, List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func, case, text
from datetime import datetime, timedelta, timezone

from src.database.connection import get_db
from src.database.models import ReviewQueueItem, ReviewStatus, QuestionEvent, QuestionStatus
from src.autocomply.domain.submissions_store import get_submission_store, SubmissionStatus
from src.autocomply.domain.notification_store import (
    emit_event,
    ensure_schema,
    get_engine,
    list_events_by_submission,
)
from src.autocomply.domain import sla_policy
from src.autocomply.domain.verifier_store import get_case_by_submission_id
from src.autocomply.integrations.email_hooks import enqueue_email
from app.submissions.seed import seed_demo_submissions
import os
from src.api.dependencies.auth import AUTO_ROLE_HEADER, ROLE_HEADER, require_admin_role
from src.autocomply.domain.explainability.maintenance import prune_runs, vacuum_if_needed
from src.autocomply.domain.explainability.golden_runner import run_golden_suite
from src.autocomply.domain.explainability.versioning import get_knowledge_version
from src.autocomply.domain.evidence import pack_retriever
from src.autocomply.regulations.knowledge import get_regulatory_knowledge
from src.api.routes.ops_smoke import ops_smoke as ops_smoke_handler
from src.autocomply.domain.verifier_store import seed_cases

router = APIRouter(
    prefix="/api/v1/admin/ops",
    tags=["admin", "ops"],
    dependencies=[Depends(require_admin_role)],  # All endpoints require admin role
)

smoke_router = APIRouter(prefix="/api/ops", tags=["ops"])


# ============================================================================
# Response Models
# ============================================================================

class OpsKPIResponse(BaseModel):
    """KPI metrics for ops dashboard."""
    open_reviews: int
    high_risk_open_reviews: int
    avg_time_to_first_response_hours: Optional[float]
    auto_answered_rate: Optional[float]


class OpsReviewItemResponse(BaseModel):
    """Review item with ops-relevant fields."""
    id: int
    created_at: str
    jurisdiction: Optional[str]
    reason_code: Optional[str]
    risk_level: str
    status: str
    question_excerpt: str
    top_match_score: Optional[float]


class OpsTrendDataPoint(BaseModel):
    """Single day trend data."""
    date: str
    open_created: int
    published: int


class OpsSubmissionResponse(BaseModel):
    """CSF/License submission for verification queue."""
    submission_id: str
    csf_type: str
    status: str
    created_at: str
    updated_at: str
    title: str
    subtitle: str
    decision_status: Optional[str]
    risk_level: Optional[str]
    trace_id: str


class SeedSubmissionsResponse(BaseModel):
    inserted: int
    ids: List[str]


class SeedVerifierCasesResponse(BaseModel):
    inserted_cases: int
    inserted_events: int


class ExplainMaintenanceRequest(BaseModel):
    max_age_days: int = 30
    max_rows: int = 5000
    vacuum_threshold: int = 500


class GoldenRunRequest(BaseModel):
    version: str = "v1"


@smoke_router.post("/explain/maintenance")
async def explain_maintenance(
    payload: ExplainMaintenanceRequest,
    x_user_role: Annotated[str | None, Header(alias=ROLE_HEADER)] = None,
    x_autocomply_role: Annotated[str | None, Header(alias=AUTO_ROLE_HEADER)] = None,
) -> Dict[str, Any]:
    env = os.getenv("ENV", "local")
    if env not in {"local", "ci"}:
        require_admin_role(
            x_user_role=x_user_role,
            x_autocomply_role=x_autocomply_role,
        )

    result = prune_runs(
        max_age_days=payload.max_age_days,
        max_rows=payload.max_rows,
    )
    vacuum_ran = vacuum_if_needed(payload.vacuum_threshold)

    return {
        "ok": True,
        "deleted_rows": result.get("deleted_rows", 0),
        "remaining_rows": result.get("remaining_rows", 0),
        "vacuum_ran": vacuum_ran,
    }


@smoke_router.post("/golden/run")
async def golden_run(
    payload: GoldenRunRequest = GoldenRunRequest(),
    x_user_role: Annotated[str | None, Header(alias=ROLE_HEADER)] = None,
    x_autocomply_role: Annotated[str | None, Header(alias=AUTO_ROLE_HEADER)] = None,
) -> Dict[str, Any]:
    env = os.getenv("ENV", "local")
    if env not in {"local", "ci"}:
        require_admin_role(
            x_user_role=x_user_role,
            x_autocomply_role=x_autocomply_role,
        )

    result = await run_golden_suite(version=payload.version)
    if not result.get("ok"):
        raise HTTPException(status_code=500, detail={"message": "Golden suite failed", "result": result})

    return result


@smoke_router.get("/smoke")
async def ops_smoke_alias():
    return await ops_smoke_handler()


@smoke_router.post("/sla/run")
def run_sla_reminders(
    x_user_role: Annotated[str | None, Header(alias=ROLE_HEADER)] = None,
    x_autocomply_role: Annotated[str | None, Header(alias=AUTO_ROLE_HEADER)] = None,
) -> Dict[str, Any]:
    env = os.getenv("ENV", "local")
    if env not in {"local", "ci"}:
        require_admin_role(
            x_user_role=x_user_role,
            x_autocomply_role=x_autocomply_role,
        )

    store = get_submission_store()
    submissions = sorted(store.list_submissions(limit=10000), key=lambda item: item.submission_id)
    now = sla_policy.utc_now()
    now_iso = sla_policy.now_iso()

    emitted_count = 0
    escalated_count = 0
    by_type: Dict[str, int] = {}

    for submission in submissions:
        submission_id = submission.submission_id
        case = get_case_by_submission_id(submission_id)
        case_id = case.get("case_id") if case else None

        def maybe_emit(event_type: str, title: str, message: str, payload: Dict[str, Any]) -> None:
            nonlocal emitted_count
            event = emit_event(
                submission_id=submission_id,
                case_id=case_id,
                actor_type="system",
                actor_id="sla",
                event_type=event_type,
                title=title,
                message=message,
                payload=payload,
                dedupe_by_day=True,
            )
            if event:
                emitted_count += 1
                by_type[event_type] = by_type.get(event_type, 0) + 1
                submission.sla_last_notified_at = now_iso
                escalation_level = payload.get("escalation_level")
                if isinstance(escalation_level, int) and escalation_level >= 2:
                    enqueue_email(event)

        status_value = (
            submission.status.value
            if isinstance(submission.status, SubmissionStatus)
            else submission.status
        )
        if status_value in {SubmissionStatus.APPROVED.value, SubmissionStatus.REJECTED.value}:
            continue

        first_touch_due_at = submission.sla_first_touch_due_at
        needs_info_due_at = submission.sla_needs_info_due_at
        decision_due_at = submission.sla_decision_due_at

        if not (first_touch_due_at or needs_info_due_at or decision_due_at):
            continue

        def _due_state(due_at: str | None) -> tuple[bool, bool]:
            if not due_at:
                return False, False
            due_dt = sla_policy.parse_iso(due_at)
            delta_seconds = (due_dt - now).total_seconds()
            if delta_seconds < 0:
                return False, True
            if delta_seconds <= sla_policy.DUE_SOON_HOURS * 3600:
                return True, False
            return False, False

        priority_buckets = [
            (
                "needs_info",
                needs_info_due_at,
                "Needs info due soon",
                "Submitter response is due soon.",
                "Needs info overdue",
                "Submitter response SLA is overdue.",
            ),
            (
                "decision",
                decision_due_at,
                "Decision due soon",
                "Final decision SLA is due soon.",
                "Decision overdue",
                "Final decision SLA is overdue.",
            ),
            (
                "first_touch",
                first_touch_due_at,
                "First touch due soon",
                "Verifier has a first-touch SLA due soon.",
                "First touch overdue",
                "Verifier first-touch SLA is overdue.",
            ),
        ]

        selected = None
        for sla_type, due_at, due_title, due_message, overdue_title, overdue_message in priority_buckets:
            if not due_at:
                continue
            due_soon, overdue = _due_state(due_at)
            if overdue:
                selected = ("sla_overdue", sla_type, due_at, overdue_title, overdue_message)
                break
            if due_soon:
                selected = ("sla_due_soon", sla_type, due_at, due_title, due_message)
                break

        if not selected:
            continue

        event_type, sla_type, due_at, title, message = selected
        payload: Dict[str, Any] = {"sla_type": sla_type, "due_at": due_at}
        if event_type == "sla_overdue":
            overdue = sla_policy.overdue_hours(due_at, now=now)
            level = sla_policy.escalation_level_for_overdue(overdue)
            if level > submission.sla_escalation_level:
                submission.sla_escalation_level = level
                escalated_count += 1
            payload["escalation_level"] = submission.sla_escalation_level

        maybe_emit(event_type, title, message, payload)

    return {
        "scanned_count": len(submissions),
        "emitted_count": emitted_count,
        "escalated_count": escalated_count,
        "by_type": by_type,
    }


def _get_sla_tracked_submission_ids(submissions: List[Any]) -> set[str]:
    tracked: set[str] = set()
    for submission in submissions:
        if getattr(submission, "sla_escalation_level", 0) > 0:
            tracked.add(submission.submission_id)

    ensure_schema()
    engine = get_engine()
    with engine.begin() as conn:
        rows = conn.execute(
            text(
                """
                SELECT DISTINCT submission_id
                FROM submission_events
                WHERE event_type LIKE :sla_prefix
                """
            ),
            {"sla_prefix": "sla_%"},
        ).mappings().all()
    tracked.update(row["submission_id"] for row in rows)
    return tracked


def _infer_submission_status(submission: Any) -> Optional[str]:
    status_value = (
        submission.status.value
        if isinstance(submission.status, SubmissionStatus)
        else submission.status
    )
    if status_value:
        return status_value

    events = list_events_by_submission(submission.submission_id, limit=10)
    for event in events:
        event_type = event.get("event_type")
        if event_type == "verifier_requested_info":
            return SubmissionStatus.NEEDS_INFO.value
        if event_type == "verifier_approved":
            return SubmissionStatus.APPROVED.value
        if event_type == "verifier_rejected":
            return SubmissionStatus.REJECTED.value
    return None


def _collect_sla_stats_from_events() -> Dict[str, int]:
    """Count distinct submissions in SLA buckets based on current submission state."""
    store = get_submission_store()
    submissions = store.list_submissions(limit=10000)
    now = sla_policy.utc_now()

    # Stats are scoped to SLA-tracked submissions to avoid seeded/demo data inflating KPI during test suite runs.
    tracked_ids = _get_sla_tracked_submission_ids(submissions)
    if not tracked_ids:
        return {
            "verifier_due_soon": 0,
            "verifier_overdue": 0,
            "needs_info_due_soon": 0,
            "needs_info_overdue": 0,
            "decision_due_soon": 0,
            "decision_overdue": 0,
        }

    needs_info_due_soon: set[str] = set()
    needs_info_overdue: set[str] = set()
    decision_due_soon: set[str] = set()
    decision_overdue: set[str] = set()
    verifier_due_soon: set[str] = set()
    verifier_overdue: set[str] = set()

    for submission in submissions:
        submission_id = submission.submission_id
        if submission_id not in tracked_ids:
            continue

        status_value = _infer_submission_status(submission)
        if status_value in {SubmissionStatus.APPROVED.value, SubmissionStatus.REJECTED.value}:
            continue

        first_touch_due_at = submission.sla_first_touch_due_at
        needs_info_due_at = submission.sla_needs_info_due_at
        decision_due_at = submission.sla_decision_due_at

        if status_value == SubmissionStatus.NEEDS_INFO.value:
            if needs_info_due_at:
                due_dt = sla_policy.parse_iso(needs_info_due_at)
                delta = (due_dt - now).total_seconds()
                if delta < 0:
                    needs_info_overdue.add(submission_id)
                elif delta <= sla_policy.DUE_SOON_HOURS * 3600:
                    needs_info_due_soon.add(submission_id)

        if decision_due_at:
            due_dt = sla_policy.parse_iso(decision_due_at)
            delta = (due_dt - now).total_seconds()
            if delta < 0:
                decision_overdue.add(submission_id)
                verifier_overdue.add(submission_id)
            elif delta <= sla_policy.DUE_SOON_HOURS * 3600:
                decision_due_soon.add(submission_id)
                verifier_due_soon.add(submission_id)

        if first_touch_due_at:
            due_dt = sla_policy.parse_iso(first_touch_due_at)
            delta = (due_dt - now).total_seconds()
            if delta < 0:
                verifier_overdue.add(submission_id)
            elif delta <= sla_policy.DUE_SOON_HOURS * 3600:
                verifier_due_soon.add(submission_id)

    return {
        "verifier_due_soon": len(verifier_due_soon),
        "verifier_overdue": len(verifier_overdue),
        "needs_info_due_soon": len(needs_info_due_soon),
        "needs_info_overdue": len(needs_info_overdue),
        "decision_due_soon": len(decision_due_soon),
        "decision_overdue": len(decision_overdue),
    }


@smoke_router.get("/sla/stats")
def get_sla_stats(
    x_user_role: Annotated[str | None, Header(alias=ROLE_HEADER)] = None,
    x_autocomply_role: Annotated[str | None, Header(alias=AUTO_ROLE_HEADER)] = None,
) -> Dict[str, Any]:
    env = os.getenv("ENV", "local")
    if env not in {"local", "ci"}:
        require_admin_role(
            x_user_role=x_user_role,
            x_autocomply_role=x_autocomply_role,
        )
    return _collect_sla_stats_from_events()


@smoke_router.get("/kb-stats")
async def kb_stats() -> Dict[str, Any]:
    if pack_retriever.is_pack_mode():
        stats = pack_retriever.get_pack_stats()
        return {
            "ok": True,
            "knowledge_version": stats.get("knowledge_version"),
            "docs_total": stats.get("docs_total"),
            "chunks_total": stats.get("chunks_total"),
            "jurisdictions": stats.get("jurisdictions", {}),
            "last_ingested_at": None,
            "notes": "knowledge_pack_mode",
        }

    knowledge = get_regulatory_knowledge()
    knowledge_version = get_knowledge_version()
    sources = getattr(knowledge, "_sources_by_id", None)
    notes: List[str] = []

    if not isinstance(sources, dict):
        return {
            "ok": False,
            "knowledge_version": knowledge_version,
            "docs_total": None,
            "chunks_total": None,
            "jurisdictions": {},
            "last_ingested_at": None,
            "notes": "Knowledge inventory unavailable",
        }

    source_list = list(sources.values())
    if not source_list:
        notes.append("No regulatory sources loaded")

    doc_ids = {getattr(src, "id", None) for src in source_list if getattr(src, "id", None)}
    docs_total = len(doc_ids) if doc_ids else None
    chunks_total = len(source_list) if source_list else None

    jurisdictions: Dict[str, int] = {}
    for src in source_list:
        jurisdiction = getattr(src, "jurisdiction", None) or "unknown"
        jurisdictions[jurisdiction] = jurisdictions.get(jurisdiction, 0) + 1

    ok = docs_total is not None and chunks_total is not None
    return {
        "ok": ok,
        "knowledge_version": knowledge_version,
        "docs_total": docs_total,
        "chunks_total": chunks_total,
        "jurisdictions": jurisdictions,
        "last_ingested_at": None,
        "notes": "; ".join(notes) if notes else None,
    }


@smoke_router.post("/seed-submissions", response_model=SeedSubmissionsResponse)
async def seed_submissions() -> SeedSubmissionsResponse:
    env = os.getenv("ENV", "local")
    if env not in {"local", "ci"}:
        raise HTTPException(status_code=403, detail="Seed endpoint only available in local or ci environment")

    store = get_submission_store()
    inserted = seed_demo_submissions(store)

    return SeedSubmissionsResponse(
        inserted=len(inserted),
        ids=[item["id"] for item in inserted],
    )


@smoke_router.post("/seed-verifier-cases", response_model=SeedVerifierCasesResponse)
async def seed_verifier_cases() -> SeedVerifierCasesResponse:
    env = os.getenv("ENV", "local")
    if env not in {"local", "ci"}:
        raise HTTPException(status_code=403, detail="Seed endpoint only available in local or ci environment")

    result = seed_cases()
    return SeedVerifierCasesResponse(
        inserted_cases=result.get("inserted_cases", 0),
        inserted_events=result.get("inserted_events", 0),
    )


# ============================================================================
# Helper Functions
# ============================================================================

def infer_risk_level(reason_code: Optional[str], status: str) -> str:
    """Infer risk level from reason code and status."""
    if not reason_code:
        return "LOW"
    
    reason_lower = reason_code.lower()
    
    # HIGH risk
    if "jurisdiction" in reason_lower or "mismatch" in reason_lower:
        return "HIGH"
    if "unsafe" in reason_lower or "policy" in reason_lower:
        return "HIGH"
    if "internal_error" in reason_lower or "system_error" in reason_lower:
        return "HIGH"
    
    # MEDIUM risk
    if "unknown" in reason_lower or "no_match" in reason_lower:
        return "MEDIUM"
    if "low_similarity" in reason_lower:
        return "MEDIUM"
    
    return "LOW"


def extract_jurisdiction(question_event: Optional[QuestionEvent]) -> Optional[str]:
    """Extract jurisdiction/state from question event metadata."""
    if not question_event:
        return None
    
    # Try to get from conversation
    conversation = question_event.conversation
    if conversation and conversation.metadata:
        metadata = conversation.metadata
        if isinstance(metadata, dict):
            return metadata.get("jurisdiction") or metadata.get("state")
    
    # Try to get from triage metadata
    if question_event.triage_metadata and isinstance(question_event.triage_metadata, dict):
        return question_event.triage_metadata.get("jurisdiction") or question_event.triage_metadata.get("state")
    
    return None


# ============================================================================
# Endpoints
# ============================================================================

@router.get("/summary", response_model=OpsKPIResponse)
async def get_ops_summary(db: Session = Depends(get_db)) -> OpsKPIResponse:
    """
    Get KPI summary for ops dashboard.
    
    Returns:
    - Open reviews count
    - High risk open reviews count  
    - Avg time to first response (last 7 days)
    - Auto-answered rate (last 7 days)
    """
    now = datetime.now(timezone.utc)
    seven_days_ago = now - timedelta(days=7)
    
    # Open reviews
    open_count = db.query(ReviewQueueItem).filter(
        ReviewQueueItem.status == ReviewStatus.OPEN
    ).count()
    
    # High risk open reviews (infer from reason_code)
    open_items = db.query(ReviewQueueItem).filter(
        ReviewQueueItem.status == ReviewStatus.OPEN
    ).all()
    
    high_risk_count = 0
    for item in open_items:
        question_event = item.question_event
        if question_event and question_event.reason_code:
            reason_code = question_event.reason_code.value
            if infer_risk_level(reason_code, item.status.value) == "HIGH":
                high_risk_count += 1
    
    # Avg time to first response (created -> assigned_at or approved_at)
    recent_items = db.query(ReviewQueueItem).filter(
        ReviewQueueItem.created_at >= seven_days_ago,
        ReviewQueueItem.assigned_at.isnot(None)
    ).all()
    
    if recent_items:
        total_hours = 0
        for item in recent_items:
            time_diff = item.assigned_at - item.created_at
            total_hours += time_diff.total_seconds() / 3600
        avg_hours = total_hours / len(recent_items)
    else:
        avg_hours = None
    
    # Auto-answered rate (from QuestionEvent)
    total_questions = db.query(QuestionEvent).filter(
        QuestionEvent.created_at >= seven_days_ago
    ).count()
    
    needs_review_count = db.query(QuestionEvent).filter(
        QuestionEvent.created_at >= seven_days_ago,
        QuestionEvent.status == QuestionStatus.NEEDS_REVIEW
    ).count()
    
    if total_questions > 0:
        answered_count = total_questions - needs_review_count
        auto_answered_rate = answered_count / total_questions
    else:
        auto_answered_rate = None
    
    return OpsKPIResponse(
        open_reviews=open_count,
        high_risk_open_reviews=high_risk_count,
        avg_time_to_first_response_hours=avg_hours,
        auto_answered_rate=auto_answered_rate
    )


@router.get("/reviews", response_model=List[OpsReviewItemResponse])
async def get_ops_reviews(
    days: int = 14,
    limit: int = 100,
    db: Session = Depends(get_db)
) -> List[OpsReviewItemResponse]:
    """
    Get review items for ops dashboard with enriched metadata.
    
    Query params:
    - days: Look back period (default 14)
    - limit: Max items to return (default 100)
    """
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    
    items = db.query(ReviewQueueItem).filter(
        ReviewQueueItem.created_at >= cutoff
    ).order_by(
        ReviewQueueItem.created_at.desc()
    ).limit(limit).all()
    
    result = []
    for item in items:
        # Use the relationship to get question event
        question_event = item.question_event
        
        question_text = question_event.question_text if question_event else "N/A"
        question_excerpt = question_text[:120] + "..." if len(question_text) > 120 else question_text
        
        jurisdiction = extract_jurisdiction(question_event)
        
        # Get reason_code from question_event if available
        reason_code = question_event.reason_code.value if question_event and question_event.reason_code else None
        
        risk_level = infer_risk_level(reason_code, item.status.value)
        
        result.append(OpsReviewItemResponse(
            id=item.id,
            created_at=item.created_at.isoformat(),
            jurisdiction=jurisdiction,
            reason_code=reason_code,
            risk_level=risk_level,
            status=item.status.value,
            question_excerpt=question_excerpt,
            top_match_score=question_event.top_match_score if question_event else None
        ))
    
    return result


@router.get("/trends", response_model=List[OpsTrendDataPoint])
async def get_ops_trends(
    days: int = 14,
    db: Session = Depends(get_db)
) -> List[OpsTrendDataPoint]:
    """
    Get daily trend data for ops dashboard.
    
    Returns:
    - Daily count of open items created
    - Daily count of published items
    """
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    
    # Get items created per day
    created_items = db.query(
        func.date(ReviewQueueItem.created_at).label("date"),
        func.count(ReviewQueueItem.id).label("count")
    ).filter(
        ReviewQueueItem.created_at >= cutoff,
        ReviewQueueItem.status == ReviewStatus.OPEN
    ).group_by(
        func.date(ReviewQueueItem.created_at)
    ).all()
    
    # Get items published per day
    published_items = db.query(
        func.date(ReviewQueueItem.published_at).label("date"),
        func.count(ReviewQueueItem.id).label("count")
    ).filter(
        ReviewQueueItem.published_at >= cutoff,
        ReviewQueueItem.status == ReviewStatus.PUBLISHED
    ).group_by(
        func.date(ReviewQueueItem.published_at)
    ).all()
    
    # Create complete date range
    result_dict = {}
    current_date = cutoff.date()
    end_date = datetime.now(timezone.utc).date()
    
    while current_date <= end_date:
        result_dict[current_date] = {
            "date": current_date.isoformat(),
            "open_created": 0,
            "published": 0
        }
        current_date += timedelta(days=1)
    
    # Fill in created counts
    for row in created_items:
        if row.date in result_dict:
            result_dict[row.date]["open_created"] = row.count
    
    # Fill in published counts
    for row in published_items:
        if row.date in result_dict:
            result_dict[row.date]["published"] = row.count
    
    # Convert to list and sort
    result = [
        OpsTrendDataPoint(**data)
        for data in sorted(result_dict.values(), key=lambda x: x["date"])
    ]
    
    return result


@router.get("/submissions", response_model=List[OpsSubmissionResponse])
async def get_ops_submissions(
    status: Optional[str] = None,
    limit: int = 100
) -> List[OpsSubmissionResponse]:
    """
    Get CSF/License submissions for verification work queue.
    
    Query params:
    - status: Filter by status (submitted, in_review, approved, rejected, blocked)
    - limit: Max items to return (default 100)
    """
    store = get_submission_store()
    
    # Parse status filter if provided
    status_filter = None
    if status:
        try:
            status_filter = [SubmissionStatus(status)]
        except ValueError:
            # Invalid status, return empty list
            return []
    
    submissions = store.list_submissions(
        status=status_filter,
        limit=limit
    )
    
    result = []
    for submission in submissions:
        result.append(OpsSubmissionResponse(
            submission_id=submission.submission_id,
            csf_type=submission.csf_type,
            status=submission.status,
            created_at=submission.created_at,
            updated_at=submission.updated_at,
            title=submission.title,
            subtitle=submission.subtitle,
            decision_status=submission.decision_status,
            risk_level=submission.risk_level,
            trace_id=submission.trace_id
        ))
    
    return result
