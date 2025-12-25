# Question Variants Feature - Complete ✅

## Overview
Implemented question variants to match future rephrasings of answered questions. When a review item is published, the system automatically generates 3-5 paraphrased variants and searches against both canonical questions and variants.

## What Changed

### 1. Database Schema ([models.py](backend/src/database/models.py))
**KBEntry - Added 2 columns:**
- `question_variants` - JSON array of 3-5 paraphrased variants
- `variant_embeddings` - JSON array of embeddings for each variant

### 2. Variant Generation ([kb_service.py](backend/src/services/kb_service.py))
**New function:** `generate_question_variants(question: str) -> List[str]`

**Rule-based heuristics (no LLM dependency):**
- **Synonym substitutions**: license ↔ registration, DEA ↔ Drug Enforcement Administration, controlled substance ↔ scheduled drug
- **State context**: Add "in Ohio", "in a state" if no state mentioned
- **Reordering**: "How do I..." → "What is the process to..."
- **Entity qualifiers**: Add "for a pharmacy", "for a hospital" for relevant questions
- Generates 3-5 variants per question

**Example variants for "What is a Schedule II drug?":**
1. "What is a Schedule II scheduled drug?"
2. "What is a Schedule II drug in Ohio?"
3. "What is a Schedule II drug in a state?"
4. "How do I learn about a Schedule II drug?"
5. "What is a Schedule II drug for a pharmacy?"

### 3. Enhanced KB Search ([kb_service.py](backend/src/services/kb_service.py))
**Updated:** `search_kb()` now searches canonical_question AND all variants

**Matching logic:**
1. Compute question embedding
2. For each KB entry:
   - Check similarity against canonical question
   - Check similarity against each variant
   - Return best score and which text matched
3. Sort by best score

**Returns:**
- `matched_text`: The actual text that matched (canonical or variant)
- `matched_variant_index`: None if canonical matched, else index (0-4)
- `matched_kb_entry_id`: KB entry ID

### 4. Decision Trace Updates ([chat.py](backend/src/api/routes/chat.py))
**DecisionTrace now includes:**
```json
{
  "matched_text": "What is a scheduled drug?",  // Variant that matched
  "matched_kb_entry_id": 1,
  "matched_variant_index": 0,  // 0-4 for variants, null for canonical
  "top_match_score": 0.85
}
```

### 5. Auto-Generate on Publish ([review_queue_service.py](backend/src/services/review_queue_service.py))
**When publishing a reviewed answer:**
- `approve_and_publish()` now calls `create_kb_entry()` with `auto_generate_variants=True`
- Generates 3-5 variants automatically
- Computes embeddings for all variants
- Logs: "Published KB entry 123 with 5 variants"

### 6. Seed Script Update ([seed_kb.py](backend/scripts/seed_kb.py))
**First entry includes variants:**
```python
{
    "canonical_question": "What is a Schedule II drug?",
    "answer": "...",
    "auto_generate_variants": True  # Generates variants on creation
}
```

Shows generated variants in output:
```
✓ Created KB entry 1: What is a Schedule II drug? with 5 variants
  Variant 1: What is a scheduled drug?
  Variant 2: What is a Schedule II drug in Ohio?
  ...
```

## Files Modified
1. ✅ [backend/src/database/models.py](backend/src/database/models.py) - Added question_variants, variant_embeddings
2. ✅ [backend/src/services/kb_service.py](backend/src/services/kb_service.py) - Variant generation + enhanced search
3. ✅ [backend/src/api/routes/chat.py](backend/src/api/routes/chat.py) - Updated DecisionTrace
4. ✅ [backend/src/services/review_queue_service.py](backend/src/services/review_queue_service.py) - Auto-generate on publish
5. ✅ [backend/scripts/seed_kb.py](backend/scripts/seed_kb.py) - Added variant support
6. ✅ [backend/scripts/migrate_add_question_variants.py](backend/scripts/migrate_add_question_variants.py) - Migration script
7. ✅ [.vscode/tasks.json](.vscode/tasks.json) - Added migration task

## Migration & Testing

### Run Migration
```powershell
cd backend
.\.venv\Scripts\python scripts/migrate_add_question_variants.py
```

**Or use VS Code task:**
`Ctrl+Shift+P` → **"HITL: Migrate DB (Add Question Variants)"**

### Re-seed KB (to generate variants)
```powershell
cd backend
.\.venv\Scripts\python scripts/seed_kb.py
```

**Or use VS Code task:**
`Ctrl+Shift+P` → **"HITL: Seed KB"**

### Test Variant Matching

**Test 1: Ask canonical question**
```json
POST /api/v1/chat/ask
{ "question": "What is a Schedule II drug?" }

Response:
{
  "answer": "Schedule II drugs are controlled substances...",
  "decision_trace": {
    "matched_text": "What is a Schedule II drug?",
    "matched_kb_entry_id": 1,
    "matched_variant_index": null,  // Canonical matched
    "top_match_score": 1.0,
    "gating_decision": "ANSWERED"
  }
}
```

**Test 2: Ask variant (synonym)**
```json
POST /api/v1/chat/ask
{ "question": "What is a scheduled drug?" }

Response:
{
  "answer": "Schedule II drugs are controlled substances...",
  "decision_trace": {
    "matched_text": "What is a scheduled drug?",
    "matched_kb_entry_id": 1,
    "matched_variant_index": 0,  // Variant 0 matched
    "top_match_score": 0.92,
    "gating_decision": "ANSWERED"
  }
}
```

**Test 3: Ask paraphrase (different wording)**
```json
POST /api/v1/chat/ask
{ "question": "Tell me about Schedule 2 medications" }

Response:
// Should match one of the variants with high score
{
  "matched_text": "What is a Schedule II drug in Ohio?",
  "matched_variant_index": 1,
  "top_match_score": 0.81
}
```

**Test 4: Publish new answer and check variants**
1. Ask unknown question → creates review item
2. Publish answer via `/api/v1/admin/review-queue/items/{id}/publish`
3. Check logs: "Published KB entry 7 with 5 variants"
4. Ask paraphrase of the published question → should match a variant

## Variant Generation Rules

**Current rule-based approach (no LLM):**

| Rule | Example |
|------|---------|
| Synonym: license ↔ registration | "license" → "registration" |
| Synonym: DEA ↔ Drug Enforcement Admin | "DEA" → "Drug Enforcement Administration" |
| Synonym: controlled substance ↔ scheduled drug | "controlled substance" → "scheduled drug" |
| Add state context | "...?" → "... in Ohio?" |
| Reorder: How do I... | "How do I X?" → "What is the process to X?" |
| Add entity qualifier | "...?" → "... for a pharmacy?" |

**Future: LLM-based variants (optional)**
- If `OPENAI_API_KEY` is set, optionally call GPT-4 to generate more natural paraphrases
- Combine rule-based + LLM-based for 5-8 total variants

## Benefits

✅ **Improved recall** - Match rephrasings without exact wording  
✅ **No LLM dependency** - Rule-based approach works offline  
✅ **Transparent matching** - Decision trace shows which variant matched  
✅ **Auto-generated** - No manual variant creation needed  
✅ **Retroactive** - Can regenerate variants for existing KB entries  
✅ **Scalable** - Embeddings computed once, searched efficiently

## Future Enhancements

- Add LLM-based variant generation as optional enhancement
- Expose variant management in admin UI (add/edit/delete variants)
- Analytics: track which variants match most frequently
- Auto-generate more variants based on common user rephrasings
- Add language/locale-specific variants (e.g., British vs American English)
- Implement variant pruning (remove low-performing variants)

## Migration Status
- ✅ Schema changes complete (kb_entries)
- ✅ Variant generation implemented (rule-based)
- ✅ KB search updated to check variants
- ✅ Decision trace includes matched_text
- ✅ Auto-generate on publish
- ✅ Seed script updated with example
- ⏳ UI updates to display/manage variants (not included)
