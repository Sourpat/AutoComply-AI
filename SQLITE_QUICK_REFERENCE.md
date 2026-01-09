# SQLite Persistence - Quick Reference

## Initialization

```python
from src.core.db import init_db

# Initialize database (run once or on startup)
init_db()
```

## Query Operations

### SELECT
```python
from src.core.db import execute_sql

# Get all new cases
cases = execute_sql(
    "SELECT * FROM cases WHERE status = :status ORDER BY created_at DESC",
    {"status": "new"}
)

# Get case by ID
case = execute_sql("SELECT * FROM cases WHERE id = :id", {"id": "case_123"})
if case:
    case_data = case[0]  # First result
```

### INSERT
```python
from src.core.db import execute_insert
import uuid
from datetime import datetime

# Insert case
case_id = str(uuid.uuid4())
execute_insert("""
    INSERT INTO cases (
        id, created_at, updated_at, decision_type, 
        title, status, priority, submission_id
    ) VALUES (
        :id, :created_at, :updated_at, :decision_type,
        :title, :status, :priority, :submission_id
    )
""", {
    "id": case_id,
    "created_at": datetime.utcnow().isoformat(),
    "updated_at": datetime.utcnow().isoformat(),
    "decision_type": "csf_practitioner",
    "title": "CSF Practitioner Review",
    "status": "new",
    "priority": "normal",
    "submission_id": "sub_123"
})
```

### UPDATE
```python
from src.core.db import execute_update

# Update case status
updated_count = execute_update("""
    UPDATE cases 
    SET status = :status, updated_at = :updated_at 
    WHERE id = :id
""", {
    "status": "in_review",
    "updated_at": datetime.utcnow().isoformat(),
    "id": case_id
})
```

### DELETE
```python
from src.core.db import execute_delete

# Delete case
deleted_count = execute_delete(
    "DELETE FROM cases WHERE id = :id",
    {"id": case_id}
)
```

## Transaction Management

```python
from src.core.db import get_db
from sqlalchemy import text

# Multi-operation transaction
with get_db() as db:
    # Insert case
    db.execute(text("""
        INSERT INTO cases (id, created_at, ...) 
        VALUES (:id, :created_at, ...)
    """), case_params)
    
    # Insert audit event
    db.execute(text("""
        INSERT INTO audit_events (id, case_id, created_at, ...) 
        VALUES (:id, :case_id, :created_at, ...)
    """), audit_params)
    
    # Both committed together automatically
```

## JSON Handling

### Store JSON
```python
import json

execute_insert("""
    INSERT INTO cases (id, metadata, created_at, updated_at, ...)
    VALUES (:id, :metadata, :created_at, :updated_at, ...)
""", {
    "id": case_id,
    "metadata": json.dumps({"tags": ["urgent", "review"], "notes": "High priority"}),
    # ... other fields
})
```

### Read JSON
```python
import json

cases = execute_sql("SELECT * FROM cases WHERE id = :id", {"id": case_id})
if cases:
    metadata = json.loads(cases[0]["metadata"]) if cases[0]["metadata"] else {}
    tags = metadata.get("tags", [])
```

## Common Patterns

### Get Case with Evidence
```python
case_with_evidence = execute_sql("""
    SELECT 
        c.*,
        GROUP_CONCAT(e.id) as evidence_ids
    FROM cases c
    LEFT JOIN evidence_items e ON e.case_id = c.id
    WHERE c.id = :case_id
    GROUP BY c.id
""", {"case_id": case_id})
```

### Get Case with Audit Timeline
```python
case_timeline = execute_sql("""
    SELECT 
        c.*,
        json_group_array(
            json_object(
                'id', a.id,
                'created_at', a.created_at,
                'event_type', a.event_type,
                'message', a.message
            )
        ) as audit_events
    FROM cases c
    LEFT JOIN audit_events a ON a.case_id = c.id
    WHERE c.id = :case_id
    GROUP BY c.id
""", {"case_id": case_id})
```

### List Cases with Filters
```python
filters = {"status": "new", "decision_type": "csf_practitioner"}
cases = execute_sql("""
    SELECT * FROM cases 
    WHERE status = :status 
    AND decision_type = :decision_type
    ORDER BY created_at DESC
    LIMIT 50
""", filters)
```

### Bulk Insert Evidence
```python
with get_db() as db:
    for evidence in evidence_list:
        db.execute(text("""
            INSERT INTO evidence_items (
                id, case_id, created_at, title, 
                snippet, citation, source_id
            ) VALUES (
                :id, :case_id, :created_at, :title,
                :snippet, :citation, :source_id
            )
        """), {
            "id": evidence["id"],
            "case_id": case_id,
            "created_at": datetime.utcnow().isoformat(),
            "title": evidence["title"],
            "snippet": evidence["snippet"],
            "citation": evidence.get("citation"),
            "source_id": evidence.get("source_id")
        })
```

## Database Location

**Default:** `backend/app/data/autocomply.db`

**Change via environment:**
```bash
# .env file
DATABASE_URL=sqlite:///./custom/path/db.sqlite
```

## Useful SQLite Commands

```bash
# Open database in SQLite CLI
cd backend/app/data
sqlite3 autocomply.db

# Show tables
.tables

# Show schema
.schema cases

# Query
SELECT * FROM cases LIMIT 5;

# Exit
.quit
```

## Error Handling

```python
from src.core.db import execute_sql

try:
    cases = execute_sql("SELECT * FROM cases WHERE id = :id", {"id": case_id})
    if not cases:
        print("Case not found")
except Exception as e:
    print(f"Database error: {e}")
```

## Performance Tips

1. **Use indexes** - Already created for common queries
2. **Batch operations** - Use transactions for multiple inserts
3. **Limit results** - Add `LIMIT` clause to large queries
4. **Use prepared statements** - Always use parameter binding (`:param`)
5. **Avoid SELECT *** - Specify needed columns

## Schema Version Check

```python
versions = execute_sql("SELECT * FROM schema_version ORDER BY version")
for v in versions:
    print(f"v{v['version']}: {v['description']}")
```
