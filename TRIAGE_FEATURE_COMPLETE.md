# Triage + Enhanced NEEDS_REVIEW - Complete ✅

## Overview
Added lightweight question triage before KB retrieval AND enhanced draft answer generation for review queue items with strict anti-hallucination rules.

## What Changed

### 1. Database Schema ([models.py](backend/src/database/models.py))
**QuestionEvent - Added 5 triage fields:**
- `intent_category` - Classification: 'license_inquiry', 'csf_question', 'compliance_inquiry', 'general', 'unclear'
- `risk_level` - Risk assessment: 'low', 'medium', 'high'
- `needs_clarification` - Boolean flag (0/1)
- `recommended_action` - Triage recommendation: 'ANSWER', 'ASK_CLARIFY', 'NEEDS_REVIEW', 'BLOCK'
- `triage_metadata` - JSON field storing confidence, reasoning, etc.

**ReviewQueueItem - Added 1 field:**
- `draft_metadata` - JSON field storing triage results, top_matches with scores and answers, reason_code

### 2. Triage Logic ([chat.py](backend/src/api/routes/chat.py))
**New function:** `triage_question(question: str) -> TriageResult`

**Rule-based heuristics:**
- **Too vague** (< 10 chars or < 3 words) → `ASK_CLARIFY`
- **High risk** keywords (urgent, emergency, audit) → risk_level = 'high' → `NEEDS_REVIEW`
- **Intent detection** via keywords:
  - license/registration → 'license_inquiry'
  - controlled substance/schedule/DEA → 'csf_question'
  - compliance/regulation → 'compliance_inquiry'
- **Missing specifics** (state/jurisdiction) → `ASK_CLARIFY`

### 3. Enhanced Draft Answer Generation ([chat.py](backend/src/api/routes/chat.py))
**Replaced:** `generate_draft_answer(question, kb_service)` → `generate_draft_answer(question, triage, top_3_matches)`

**Strict anti-hallucination rules:**
- ✅ **No hallucination** - Only references actual KB matches
- ✅ **Clear labeling** - "🟡 DRAFT ANSWER - REQUIRES HUMAN REVIEW" header
- ✅ **Assumptions section** - Lists what's missing, unclear, or assumed
- ✅ **References** - Shows all top 3 KB matches with scores (even low scores)
- ✅ **Safe disclaimer** - Warns against using draft without human review
- ✅ **Contextual guidance** - Suggests adapting KB answers if score >= 0.5, otherwise prompts reviewer to write from scratch

**Draft Structure:**
```markdown
## 🟡 DRAFT ANSWER - REQUIRES HUMAN REVIEW

**Question:**
> [user's question]

### Classification
- **Intent:** csf_question
- **Risk Level:** high
- **Triage Reasoning:** Detected as csf_question with high risk

### Assumptions & Missing Information
- ⚠️ High-risk question requires urgent review
- ⚠️ No specific state or jurisdiction mentioned

### Related Knowledge Base Entries

1. **[78.5% match]** What is a Schedule II drug?
   - KB Entry #1
   - Answer preview: Schedule II drugs are substances with high potential for abuse...

2. **[45.2% match]** How do I apply for DEA registration?
   - KB Entry #2
   - Similarity too low to use directly

3. **[32.1% match]** What are controlled substance requirements?
   - KB Entry #3
   - Similarity too low to use directly

### Suggested Answer

Consider adapting the answer from KB Entry #1:

```
[actual KB answer shown here]
```

**Reviewer:** Please modify the above answer to address the specific question.

### ⚠️ Important Disclaimer

This draft is automatically generated and **must be reviewed by a compliance expert** before publishing. Do not use this draft directly without human verification.

If this question involves legal interpretation, medical advice, or time-sensitive compliance requirements, escalate to appropriate subject matter experts.
```

### 4. Enhanced Gating Decision
**New flow:**
1. **Triage first** (before KB retrieval)
2. **If needs_clarification=true** → Return clarifying question immediately (no queue item)
3. **If risk_level=high or recommended_action=NEEDS_REVIEW** → Create review queue item with enhanced draft
4. **Otherwise** → Apply normal KB similarity + policy gates
5. **Store triage results** in QuestionEvent and decision_trace
6. **Store draft_metadata** in ReviewQueueItem for reviewer context

### 5. Review Queue Priority & Metadata
**Priority based on triage:**
- `risk_level=high` → priority = 10
- `risk_level=medium` → priority = 5
- `risk_level=low` → priority = 0

**draft_metadata structure:**
```json
{
  "triage": {
    "intent_category": "csf_question",
    "risk_level": "high",
    "needs_clarification": false,
    "recommended_action": "NEEDS_REVIEW",
    "confidence": 0.7,
    "reasoning": "Detected as csf_question with high risk"
  },
  "top_matches": [
    {
      "kb_id": 1,
      "question": "What is a Schedule II drug?",
      "score": 0.785,
      "answer": "Schedule II drugs are..."
    },
    ...
  ],
  "similarity_threshold": 0.78,
  "top_match_score": 0.785,
  "reason_code": "low_similarity"
}
```

Tags include: `["auto-generated", "csf_question", "risk_high"]`

### 6. Admin API Updates ([admin_review.py](backend/src/api/routes/admin_review.py))
**ReviewQueueItemResponse now includes:**
- `draft_metadata` field with full context for reviewer

## Files Modified
1. ✅ [backend/src/database/models.py](backend/src/database/models.py) - Added triage fields + draft_metadata
2. ✅ [backend/src/api/routes/chat.py](backend/src/api/routes/chat.py) - Added triage + enhanced draft generation
3. ✅ [backend/src/services/review_queue_service.py](backend/src/services/review_queue_service.py) - Added draft_metadata param
4. ✅ [backend/src/api/routes/admin_review.py](backend/src/api/routes/admin_review.py) - Return draft_metadata in responses
5. ✅ [backend/scripts/migrate_add_triage_fields.py](backend/scripts/migrate_add_triage_fields.py) - DB migration for both tables
6. ✅ [.vscode/tasks.json](.vscode/tasks.json) - Added migration task

## How to Use

### First Time Setup (after venv setup)
```powershell
# Run migration to add triage columns to existing DB
cd backend
.\.venv\Scripts\python scripts/migrate_add_triage_fields.py
```

**Or use VS Code task:**
- `Ctrl+Shift+P` → "Tasks: Run Task" → **"HITL: Migrate DB (Add Triage)"**

### Testing the Enhanced NEEDS_REVIEW Flow

**Test 1: Vague Question (ASK_CLARIFY)**
```json
POST /api/v1/chat/ask
{ "question": "How?" }

Response:
{
  "answer": "Could you provide more details about your question? For example, which state or regulation are you asking about?",
  "decision_trace": {
    "triage": {
      "needs_clarification": true,
      "recommended_action": "ASK_CLARIFY"
    },
    "gating_decision": "ASK_CLARIFY"
  }
}
```

**Test 2: High-Risk Question with Enhanced Draft (NEEDS_REVIEW)**
```json
POST /api/v1/chat/ask
{ "question": "Urgent audit deadline for DEA registration" }

Response:
{
  "answer": "Thank you for your question. Due to its complexity or urgency...",
  "decision_trace": {
    "triage": {
      "risk_level": "high",
      "recommended_action": "NEEDS_REVIEW"
    },
    "gating_decision": "NEEDS_REVIEW",
    "queue_item_id": 123
  }
}

// Then check the review queue:
GET /api/v1/admin/review-queue/items/123

{
  "id": 123,
  "question_text": "Urgent audit deadline for DEA registration",
  "draft_answer": "## 🟡 DRAFT ANSWER - REQUIRES HUMAN REVIEW\n\n**Question:**\n> Urgent audit deadline for DEA registration\n\n### Classification\n- **Intent:** csf_question\n- **Risk Level:** high\n- **Triage Reasoning:** Detected as csf_question with high risk\n\n### Assumptions & Missing Information\n- ⚠️ High-risk question requires urgent review\n- ⚠️ No specific state or jurisdiction mentioned\n\n### Related Knowledge Base Entries\n\n1. **[65.2% match]** What is DEA registration?\n   - KB Entry #3\n   - Answer preview: DEA registration is required for...\n\n### Suggested Answer\n\nConsider adapting the answer from KB Entry #3:\n\n```\n[actual KB answer shown]\n```\n\n**Reviewer:** Please modify the above answer to address the specific question.\n\n### ⚠️ Important Disclaimer\n\nThis draft is automatically generated and **must be reviewed by a compliance expert** before publishing...",
  "draft_metadata": {
    "triage": {
      "intent_category": "csf_question",
      "risk_level": "high",
      "recommended_action": "NEEDS_REVIEW",
      "confidence": 0.7,
      "reasoning": "Detected as csf_question with high risk"
    },
    "top_matches": [
      {
        "kb_id": 3,
        "question": "What is DEA registration?",
        "score": 0.652,
        "answer": "DEA registration is required for..."
      }
    ],
    "similarity_threshold": 0.78,
    "top_match_score": 0.652,
    "reason_code": "low_similarity"
  },
  "priority": 10,
  "status": "open",
  "tags": ["auto-generated", "csf_question", "risk_high"]
}
```

**Test 3: Unknown Question with No KB Matches**
```json
POST /api/v1/chat/ask
{ "question": "How do I transfer a pharmacy license between states?" }

// Creates review item with draft that shows:
// - No KB entries found
// - Assumptions about missing state info
// - Placeholder for reviewer to write from scratch
// - All safety disclaimers
```

## Benefits

✅ **No hallucination** - Draft only references actual KB matches with scores  
✅ **Reviewer context** - Full triage + match data in draft_metadata  
✅ **Clear guidance** - Assumptions, missing info, and next steps for reviewer  
✅ **Risk awareness** - High-priority items clearly labeled  
✅ **Safer drafts** - Multiple disclaimers prevent accidental publication of AI content  
✅ **Better audit trail** - Complete reasoning chain stored

## Future Enhancements

- Replace rule-based triage with LLM-based classifier
- Use LLM for draft generation with RAG over regulatory docs
- Add more intent categories (refund, documentation, training, etc.)
- Implement confidence-based routing (low confidence → human review)
- Add A/B testing for triage rules
- Expose triage analytics in metrics endpoint
- Add "similar answered questions" section to draft for context

## Migration Status
- ✅ Schema changes complete (question_events + review_queue_items)
- ✅ Triage logic implemented
- ✅ Enhanced draft generation implemented
- ✅ Decision trace updated
- ✅ Review queue priority based on risk
- ✅ draft_metadata stored and exposed via API
- ⏳ UI updates to display draft_metadata (not included in this change)
