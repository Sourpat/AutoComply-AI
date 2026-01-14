# HITL Demo - Quick Test Guide

## Prerequisites

```powershell
# Terminal 1 - Start Backend
cd backend
pip install -r requirements.txt
python -m uvicorn src.api.main:app --reload --host 127.0.0.1 --port 8001

# Terminal 2 - Seed KB (wait for backend to start)
cd backend
python scripts/seed_kb.py
```

## Test Flow

### 1. Ask a Known Question (KB Match)

```bash
curl -X POST http://127.0.0.1:8001/api/v1/chat/ask \
  -H "Content-Type: application/json" \
  -d "{\"question\": \"What are the requirements for Schedule II controlled substances in Florida?\"}"
```

**Expected Response:**
```json
{
  "answer": "In Florida, Schedule II controlled substances require...",
  "decision_trace": {
    "kb_searched": true,
    "top_match_score": 0.95,
    "similarity_threshold": 0.78,
    "passed_similarity_gate": true,
    "passed_policy_gate": true,
    "gating_decision": "ANSWERED",
    "reason_code": null,
    "queue_item_id": null
  },
  "session_id": "...",
  "message_id": 1
}
```

### 2. Ask Unknown Question (Triggers Review Queue)

```bash
curl -X POST http://127.0.0.1:8001/api/v1/chat/ask \
  -H "Content-Type: application/json" \
  -d "{\"question\": \"What are the shipping requirements for Schedule III substances to California?\"}"
```

**Expected Response:**
```json
{
  "answer": "Thank you for your question. This query has been submitted for review...",
  "decision_trace": {
    "kb_searched": true,
    "top_match_score": 0.45,
    "similarity_threshold": 0.78,
    "passed_similarity_gate": false,
    "passed_policy_gate": true,
    "gating_decision": "NEEDS_REVIEW",
    "reason_code": "low_similarity",
    "queue_item_id": 1
  },
  "session_id": "...",
  "message_id": 2
}
```

### 3. List Review Queue Items

```bash
curl http://127.0.0.1:8001/api/v1/admin/review-queue/items?status=open
```

**Expected Response:**
```json
{
  "items": [
    {
      "id": 1,
      "question_text": "What are the shipping requirements for Schedule III substances to California?",
      "status": "open",
      "draft_answer": "**[DRAFT - Requires Human Review]**...",
      "reason_code": "low_similarity",
      "top_match_score": 0.45,
      "created_at": "2025-12-22T..."
    }
  ],
  "total": 1,
  "stats": {
    "open": 1,
    "in_review": 0,
    "published": 0,
    "total": 1
  }
}
```

### 4. Get Queue Item Detail

```bash
curl http://127.0.0.1:8001/api/v1/admin/review-queue/items/1
```

### 5. Publish Answer to KB

```bash
curl -X POST http://127.0.0.1:8001/api/v1/admin/review-queue/items/1/publish \
  -H "Content-Type: application/json" \
  -d "{
    \"final_answer\": \"For Schedule III substances shipping to California: 1) Valid DEA registration for Schedule III, 2) California state pharmacy license, 3) Proper documentation and manifests, 4) Compliance with CA-specific handling requirements.\",
    \"tags\": [\"california\", \"schedule-iii\", \"shipping\"]
  }"
```

**Expected Response:**
```json
{
  "success": true,
  "item_id": 1,
  "status": "published",
  "published_kb_id": 6,
  "message": "Answer successfully published to knowledge base"
}
```

### 6. Verify KB Entry Created

```bash
curl http://127.0.0.1:8001/api/v1/admin/kb/entries
```

### 7. Ask Same Question Again (Now Matches KB)

```bash
curl -X POST http://127.0.0.1:8001/api/v1/chat/ask \
  -H "Content-Type: application/json" \
  -d "{\"question\": \"What are the shipping requirements for Schedule III substances to California?\"}"
```

**Expected Response:**
```json
{
  "answer": "For Schedule III substances shipping to California...",
  "decision_trace": {
    "gating_decision": "ANSWERED",
    "top_match_score": 1.0,
    "passed_similarity_gate": true,
    "queue_item_id": null
  }
}
```

## Check Metrics

```bash
curl http://127.0.0.1:8001/api/v1/metrics/summary
```

**Expected:**
```json
{
  "total_questions": 3,
  "answered": 2,
  "total_kb_entries": 6,
  "pending_review": 0,
  "answer_rate": 66.7
}
```

## Swagger Docs

All endpoints are documented at: http://127.0.0.1:8001/docs

Key endpoint groups:
- **chat** - Chat interaction
- **admin, review-queue** - Review queue management  
- **admin, kb** - KB administration
- **metrics** - Analytics

## Decision Trace Keys (Consistent)

Every `/chat/ask` response includes `decision_trace` with:
- `kb_searched`: boolean
- `top_match_score`: float | null
- `top_3_matches`: array of {kb_id, canonical_question, score}
- `similarity_threshold`: float (0.78)
- `passed_similarity_gate`: boolean
- `passed_policy_gate`: boolean
- `gating_decision`: "ANSWERED" | "NEEDS_REVIEW"
- `reason_code`: "low_similarity" | "policy_gate" | "no_kb_match" | null
- `queue_item_id`: int | null
- `model_metadata`: object

## Review Queue Workflow States

1. **OPEN** - Awaiting assignment
2. **IN_REVIEW** - Assigned to reviewer (via `/assign` endpoint)
3. **PUBLISHED** - Approved and published to KB (via `/publish` endpoint)

`/publish` atomically:
- Stores final_answer in ReviewQueueItem
- Creates KBEntry with embedding
- Updates question_event status to ANSWERED
- Sets ReviewQueueItem status to PUBLISHED
