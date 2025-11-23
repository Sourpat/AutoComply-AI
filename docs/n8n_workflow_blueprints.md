# n8n Workflow Blueprints – AutoComply AI

This doc describes how to wire AutoComply AI into **n8n** to support:

1. DevSupport debugging (`codex_dev_support_webhook`)
2. Regulatory operations digest (`regops_daily_digest`)
3. Form / case escalation (`form_copilot_escalation`)

All workflows assume:

- Backend base URL = `API_BASE` (e.g. `https://autocomply-api.example.com`)
- `/mnt/data/...` document paths are treated as URLs by the runtime.

---

## 1. `codex_dev_support_webhook`

**Goal:** Receive `CODEX_COMMAND` events, enrich them with engine/RAG calls, and send a DevSupport summary to Slack/Teams/email.

### Trigger

- **Webhook node** in n8n:
  - Method: `POST`
  - Path: `/codex/devsupport`
  - Body: `application/json` containing at least:

```json
{
  "command": "explain_csf_practitioner_decision",
  "payload": {
    "form": { "...": "..." },
    "decision": { "...": "..." },
    "explanation": "short explanation",
    "source_document": "/mnt/data/Online Controlled Substance Form - Practitioner Form with addendums.pdf"
  }
}
```

You can send this from:

- A log shipper,
- Another service,
- Or just test manually via Copy cURL.

### Nodes

1. **Webhook (trigger)**
   - Receives the CODEX_COMMAND event.

2. **Function: classify event**
   - Decide which engine family is involved (csf, ohio_tddd, pdma) based on command.

3. **HTTP Request: call explain API (optional)**
   - If the event doesn’t already contain a detailed explanation, call:
     - `/csf/explain`
     - `/ohio-tddd/explain`
     - `/pdma-sample/explain`

4. **HTTP Request: RAG regulatory explain (optional)**
   - For deeper context, call:

```
POST API_BASE/rag/regulatory-explain
Content-Type: application/json

{
  "question": "Explain this decision for DevSupport, referencing the relevant policy.",
  "decision": { ... },
  "regulatory_references": ["pdma_sample_eligibility"]
}
```

5. **HTTP Request: fetch artifacts (optional)**
   - Call `GET API_BASE/compliance/artifacts` to attach artifact metadata.

6. **LLM node: summarize for DevSupport**
   - Prompt: “You are a DevSupport assistant. Summarise why this decision was made, what rules fired, and link to any useful documents. Use the /mnt/data/... URLs as-is.”

7. **Slack / Teams / Email node**
   - Deliver summary to a #autocomply-devsupport or similar channel.

## 2. `regops_daily_digest`

**Goal:** Nightly summary of interesting decisions and patterns for Regulatory Ops.

### Trigger

- **Cron node**
  - Every day at e.g. 06:00.

### Nodes

1. **Cron (trigger)**

2. **HTTP Request: health & basic info**
   - `GET API_BASE/health`
   - `GET API_BASE/compliance/artifacts`

3. **HTTP Request: log store / CODEX feed**
   - Query a log source (e.g., your logging system or a previous n8n workflow) for recent CODEX_COMMAND events:
     - `evaluate_csf_*`
     - `evaluate_ohio_tddd`
     - `evaluate_pdma_sample`
     - `rag_regulatory_explain_*`

4. **Function: aggregate**
   - Count by:
     - engine family,
     - status (allowed, blocked, manual_review),
     - jurisdiction (FL, OH, etc.),
     - artifact IDs.

5. **LLM node: generate digest**
   - Input:
     - Aggregated stats,
     - Example events (anonymised),
     - Artifact list (including /mnt/data/...).
   - Output:
     - Short narrative:
       - “Yesterday we saw 12 blocked PDMA samples (all government accounts).”
       - “Ohio TDDD decisions involving out-of-state shipping are trending up.”
       - “Key artifacts referenced: Ohio TDDD HTML, PDMA policy PDF.”

6. **Email / Slack node**
   - Subject: “AutoComply AI – Regulatory Daily Digest”
   - Include links to:
     - RAG sandbox,
     - Specific /mnt/data/... docs (rendered as URLs by runtime).

## 3. `form_copilot_escalation`

**Goal:** When users are stuck or see confusing results in the UI, escalate to a human with full context.

### Trigger

- UI or an internal service calls an n8n webhook with:

```json
{
  "form_type": "pdma_sample",
  "form": { "...": "..." },
  "decision": { "...": "..." },
  "user_question": "Why is this blocked?",
  "source_document": "/mnt/data/FLORIDA TEST.pdf",
  "regulatory_references": ["pdma_sample_eligibility"]
}
```

### Nodes

1. **Webhook (trigger)**

2. **Function: normalise input**
   - Attach timestamp, environment (prod/stage), and user metadata as needed.

3. **HTTP Request: RAG explain**
   - `POST API_BASE/rag/regulatory-explain` with the user’s question.

4. **LLM node: “escalation pack”**
   - Prompt the LLM to generate:
     - Subject line,
     - Short summary,
     - Bullet points:
       - Key facts about the form,
       - Engine verdict & reasons,
       - RAG explanation,
       - Links to /mnt/data/... docs.

5. **Create ticket / send email**
   - JIRA / ServiceNow / shared mailbox:
     - Attach JSON payload,
     - Attach LLM-generated summary,
     - Include URLs for:
       - RAG playground,
       - Relevant /mnt/data/... documents.

## 4. Notes on /mnt/data/... URLs

Across all workflows:

- Treat `source_document` and artifact `source_document` fields as URLs.
- Example values:
  - `/mnt/data/Online Controlled Substance Form - Practitioner Form with addendums.pdf`
  - `/mnt/data/Online Controlled Substance Form - Hospital Pharmacy.pdf`
  - `/mnt/data/Online Controlled Substance Form - Surgery Center form.pdf`
  - `/mnt/data/Online Controlled Substance Form - Researcher form.pdf`
  - `/mnt/data/Online Controlled Substance Form - EMS form.pdf`
  - `/mnt/data/FLORIDA TEST.pdf`
  - `/mnt/data/addendums.pdf`
  - `/mnt/data/Ohio TDDD.html`
  - `/mnt/data/Controlledsubstance_userflow.png`
  - `/mnt/data/Controlled_Substances_Form_Flow_Updated.png`

The environment will transform these into actual accessible URLs. n8n does not
need any special handling beyond passing them into HTTP or browser tools.

These blueprints make it straightforward to hook AutoComply AI into real
DevSupport and RegOps workflows, using the same engines, RAG endpoint, and
document store that power the React sandboxes.
