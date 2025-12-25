# Chat UX Improvement - ChatGPT-Style Responses

## Overview
Updated the chat UI to display clean, ChatGPT-style responses instead of showing the detailed reviewer markdown template to end users.

## Changes Made

### 1. Backend API (`backend/src/api/routes/chat.py`)

#### Updated `ChatResponse` Model
Added optional `reviewer_draft` field to separate user-facing messages from reviewer content:

```python
class ChatResponse(BaseModel):
    """Response from the chatbot."""
    answer: str
    decision_trace: DecisionTrace
    session_id: str
    message_id: int
    reviewer_draft: Optional[str] = None  # Detailed markdown draft for reviewers (only for NEEDS_REVIEW)
```

#### Modified `ask_question()` Endpoint
- When `NEEDS_REVIEW`, the `answer` field now contains a short, user-friendly message
- The detailed markdown draft is stored in `reviewer_draft` (not shown in chat UI)
- Review queue items still receive the full draft for admin review

**User sees:**
```
Thank you for your question. This query has been submitted for review by our compliance team. 
We'll update our knowledge base with the answer and it will be available for future queries.
```

**Reviewer sees (in admin queue):**
```markdown
**DRAFT ANSWER** (Requires Review)

[Detailed markdown with assumptions, references, disclaimers, etc.]
```

### 2. Frontend Types (`frontend/src/api/chatClient.ts`)

Updated `ChatResponse` interface to match backend:

```typescript
export interface ChatResponse {
  answer: string;
  decision_trace: DecisionTrace;
  session_id: string;
  message_id: number;
  reviewer_draft?: string;  // Optional, only for NEEDS_REVIEW
}
```

### 3. Chat UI (`frontend/src/components/ChatBot.tsx`)

**No changes needed!** The existing implementation already:
- Displays `response.answer` in chat bubbles ✅
- Shows `decision_trace` in collapsible details section ✅
- Does NOT display `reviewer_draft` (it's not wired up) ✅

## User Experience

### Before
When a question needed review, users saw:
```markdown
**DRAFT ANSWER** (Requires Review)

**Assumptions Made:**
- Assuming facility type: hospital
- Assuming jurisdiction: federal regulations

**Draft Answer:**
Based on available information...

**References:**
1. CFR 21 Part 1307
2. DEA Practitioner Manual

**⚠️ DISCLAIMER:** This is a draft...
```

### After
Users now see a clean message:
```
Thank you for your question. This query has been submitted for review by our compliance team. 
We'll update our knowledge base with the answer and it will be available for future queries.
```

And can optionally expand the decision trace:
```
🔍 Decision Trace
  Decision: NEEDS_REVIEW
  Reason: no_kb_match
  Queue Item ID: #42
```

## What Hasn't Changed

1. **Review Queue**: Admin users still see the full markdown draft when reviewing questions
2. **Decision Trace**: Still available in collapsible section for transparency
3. **KB Answers**: Published answers still return immediately with full content
4. **Draft Generation**: The `generate_draft_answer()` function still creates detailed drafts for reviewers

## Future Enhancements

The `reviewer_draft` field is now available in the API response, which enables:
- Admin/developer modes in the chat UI to see drafts
- Debugging tools to inspect what draft was generated
- A/B testing different draft formats
- Chat history exports with both user-facing and reviewer content

## Testing

1. **Ask a known question** → Should return published KB answer (unchanged)
2. **Ask a new/unknown question** → Should show short "submitted for review" message
3. **Check decision trace** → Should still show full gating decision details
4. **Check review queue** → Should still have detailed draft for reviewer
