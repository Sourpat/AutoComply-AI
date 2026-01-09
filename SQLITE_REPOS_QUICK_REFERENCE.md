# SQLite Repositories - Quick Reference

## Using the Repositories

### Workflow Cases

```python
from app.workflow.repo import (
    create_case, get_case, list_cases, update_case, delete_case,
    add_audit_event, list_audit_events, upsert_evidence
)
from app.workflow.models import (
    CaseCreateInput, CaseUpdateInput, CaseListFilters,
    AuditEventCreateInput, EvidenceItem, CaseStatus, AuditEventType
)

# Create a case
case = create_case(CaseCreateInput(
    decisionType="csf",
    title="Prescribing Authority Review",
    summary="Dr. Smith CNP controlled substances",
    evidence=[
        EvidenceItem(
            id="ev-1",
            title="OAC 4723-9-10",
            snippet="CNPs may prescribe...",
            citation="OAC 4723-9-10",
            sourceId="doc-123",
            includedInPacket=True,
        )
    ]
))

# Get a case
case = get_case("550e8400-e29b-41d4-a716-446655440000")

# List cases with filters
cases = list_cases(CaseListFilters(
    status=CaseStatus.IN_REVIEW,
    assignedTo="reviewer@example.com"
))

# Update case
updated = update_case(case_id, CaseUpdateInput(
    status=CaseStatus.APPROVED,
    reviewerNotes="Approved based on evidence"
))

# Delete case (CASCADE deletes evidence and events)
deleted = delete_case(case_id)

# Add audit event
event = add_audit_event(AuditEventCreateInput(
    caseId=case_id,
    eventType=AuditEventType.STATUS_CHANGED,
    actor="reviewer@example.com",
    source="web",
    message="Status changed to approved",
    meta={"old_status": "in_review", "new_status": "approved"}
))

# List audit events (newest first)
events = list_audit_events(case_id)

# Update evidence
case = upsert_evidence(
    case_id=case_id,
    packet_evidence_ids=["ev-1", "ev-2", "ev-3"]  # Curate packet
)
```

### Submissions

```python
from app.submissions.repo import (
    create_submission, get_submission, list_submissions
)
from app.submissions.models import (
    SubmissionCreateInput, SubmissionListFilters
)

# Create submission
submission = create_submission(SubmissionCreateInput(
    decisionType="csf",
    submittedBy="user@example.com",
    accountId="account-123",
    locationId="location-456",
    formData={
        "practitionerName": "Dr. Jane Smith",
        "licenseNumber": "NP.12345",
        "question": "Can I prescribe controlled substances?"
    },
    evaluatorOutput={
        "decision": "approved",
        "confidence": 0.95
    }
))

# Get submission
submission = get_submission("550e8400-e29b-41d4-a716-446655440000")

# List submissions with filters
submissions = list_submissions(SubmissionListFilters(
    decisionType="csf",
    submittedBy="user@example.com"
))
```

## Database Queries

### Direct SQL (for advanced use)

```python
from src.core.db import execute_sql, execute_insert, execute_update, execute_delete

# SELECT
rows = execute_sql(
    "SELECT * FROM cases WHERE status = :status ORDER BY created_at DESC LIMIT :limit",
    {"status": "in_review", "limit": 10}
)

# INSERT
case_id = execute_insert(
    "INSERT INTO cases (id, title, status) VALUES (:id, :title, :status)",
    {"id": "123", "title": "Test", "status": "new"}
)

# UPDATE
count = execute_update(
    "UPDATE cases SET status = :status WHERE id = :id",
    {"status": "approved", "id": "123"}
)

# DELETE
count = execute_delete(
    "DELETE FROM cases WHERE id = :id",
    {"id": "123"}
)
```

## Database Schema

### Cases Table
```sql
CREATE TABLE cases (
    id TEXT PRIMARY KEY,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    decision_type TEXT NOT NULL,
    title TEXT NOT NULL,
    summary TEXT,
    status TEXT NOT NULL DEFAULT 'new',
    assigned_to TEXT,
    assigned_at TEXT,
    due_at TEXT,
    submission_id TEXT,
    evidence_count INTEGER DEFAULT 0,
    packet_evidence_ids TEXT DEFAULT '[]',  -- JSON array
    metadata TEXT DEFAULT '{}',             -- JSON object
    reviewer_notes TEXT,
    admin_notes TEXT
);
```

### Evidence Items Table
```sql
CREATE TABLE evidence_items (
    id TEXT PRIMARY KEY,
    case_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    title TEXT NOT NULL,
    snippet TEXT NOT NULL,
    citation TEXT,
    source_id TEXT,
    tags TEXT DEFAULT '[]',         -- JSON array
    metadata TEXT DEFAULT '{}',     -- JSON object
    included_in_packet INTEGER DEFAULT 0,  -- Boolean
    FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE
);
```

### Case Packet Table
```sql
CREATE TABLE case_packet (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    case_id TEXT NOT NULL,
    evidence_id TEXT NOT NULL,
    added_at TEXT NOT NULL,
    added_by TEXT,
    FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE,
    FOREIGN KEY (evidence_id) REFERENCES evidence_items(id) ON DELETE CASCADE
);
```

### Audit Events Table
```sql
CREATE TABLE audit_events (
    id TEXT PRIMARY KEY,
    case_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    event_type TEXT NOT NULL,
    actor_role TEXT,
    actor_name TEXT,
    message TEXT,
    submission_id TEXT,
    meta TEXT DEFAULT '{}',  -- JSON object
    FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE
);
```

### Submissions Table
```sql
CREATE TABLE submissions (
    id TEXT PRIMARY KEY,
    created_at TEXT NOT NULL,
    decision_type TEXT NOT NULL,
    submitted_by TEXT,
    account_id TEXT,
    location_id TEXT,
    form_data TEXT DEFAULT '{}',         -- JSON object
    raw_payload TEXT,                    -- JSON object
    evaluator_output TEXT,               -- JSON object
    status TEXT DEFAULT 'submitted'
);
```

## Common Patterns

### 1. Creating Case with Evidence
```python
case = create_case(CaseCreateInput(
    decisionType="csf",
    title="Review Case",
    evidence=[
        EvidenceItem(
            id="ev-1",
            title="Evidence 1",
            snippet="Content...",
            includedInPacket=True  # Auto-added to packet
        ),
        EvidenceItem(
            id="ev-2",
            title="Evidence 2",
            snippet="Content...",
            includedInPacket=False  # Not in packet initially
        )
    ]
))
# Result: case.packetEvidenceIds == ["ev-1"]
```

### 2. Curating Evidence Packet
```python
# Option 1: Update packet IDs only
case = upsert_evidence(
    case_id=case_id,
    packet_evidence_ids=["ev-1", "ev-2", "ev-3"]
)

# Option 2: Replace all evidence
case = upsert_evidence(
    case_id=case_id,
    evidence=[
        EvidenceItem(id="ev-new", title="New Evidence", snippet="..."),
    ]
)
```

### 3. Building Audit Trail
```python
# Status change
add_audit_event(AuditEventCreateInput(
    caseId=case_id,
    eventType=AuditEventType.STATUS_CHANGED,
    actor="reviewer@example.com",
    message="Status changed to approved",
    meta={"old": "in_review", "new": "approved"}
))

# Assignment
add_audit_event(AuditEventCreateInput(
    caseId=case_id,
    eventType=AuditEventType.ASSIGNED,
    actor="admin@example.com",
    message="Assigned to reviewer",
    meta={"assignee": "reviewer@example.com"}
))

# Comment
add_audit_event(AuditEventCreateInput(
    caseId=case_id,
    eventType=AuditEventType.COMMENT_ADDED,
    actor="reviewer@example.com",
    message="Added review notes",
    meta={"comment": "Evidence is sufficient"}
))
```

### 4. Filtering and Pagination
```python
# Filter by status
in_review = list_cases(CaseListFilters(status=CaseStatus.IN_REVIEW))

# Filter by assignee
my_cases = list_cases(CaseListFilters(assignedTo="me@example.com"))

# Multiple filters
csf_in_review = list_cases(CaseListFilters(
    decisionType="csf",
    status=CaseStatus.IN_REVIEW,
    assignedTo="reviewer@example.com"
))

# Results are always sorted newest first
```

## Database Initialization

### On App Startup
```python
# In main.py
from src.core.db import init_db

@app.on_event("startup")
async def startup_event():
    init_db()  # Creates tables if not exist
```

### Manual Testing
```python
from src.core.db import init_db

# Initialize database
init_db()

# Database created at: backend/app/data/autocomply.db
```

### Reset for Testing
```python
from app.workflow.repo import reset_store
from app.submissions.repo import clear_all_submissions

# Clear all data
reset_store()  # Deletes all cases, evidence, events
clear_all_submissions()  # Deletes all submissions
```

## Troubleshooting

### Database Not Found
```bash
# Ensure database file exists
ls backend/app/data/autocomply.db

# If missing, run init_db()
python -c "from src.core.db import init_db; init_db()"
```

### Schema Errors
```bash
# Check schema files exist
ls backend/app/workflow/schema.sql
ls backend/app/submissions/schema.sql

# Re-run initialization
python -c "from src.core.db import init_db; init_db()"
```

### Testing Persistence
```bash
# Run test suite
cd backend
.venv/Scripts/python test_sqlite_repos.py

# Should output: ✅ ALL TESTS PASSED!
```

## Performance Tips

1. **Use Filters:** Always filter at database level, not in Python
   ```python
   # Good - filters in SQL
   cases = list_cases(CaseListFilters(status=CaseStatus.IN_REVIEW))
   
   # Bad - loads all then filters
   all_cases = list_cases()
   in_review = [c for c in all_cases if c.status == CaseStatus.IN_REVIEW]
   ```

2. **Batch Operations:** Use transactions for multiple operations
   ```python
   from src.core.db import get_db
   
   with get_db() as session:
       # Multiple operations in single transaction
       create_case(...)
       add_audit_event(...)
       upsert_evidence(...)
   ```

3. **Indexes:** Schema includes indexes on common queries
   - `cases_status_idx` - Filter by status
   - `cases_assigned_to_idx` - Filter by assignee
   - `cases_created_at_idx` - Sort by date
   - `audit_events_case_id_idx` - Load events for case
   - `evidence_items_case_id_idx` - Load evidence for case

---

**Database Location:** `backend/app/data/autocomply.db`

**Schema Version:** 1 (tracked in `schema_version` table)

**Documentation:** See [SQLITE_MIGRATION_COMPLETE.md](./SQLITE_MIGRATION_COMPLETE.md)
