# AutoComply AI – n8n Workflows & Orchestration

This document defines how AutoComply AI can be orchestrated with **n8n** to
provide automated compliance checks, explanations, and notifications on top of
the core FastAPI decision engine, explain endpoints, and RAG pipeline.

The workflows described here are intentionally implementation-agnostic but
concrete enough to be used as a blueprint for building actual n8n flows.

---

## 1. Core Backend Endpoints Used by n8n

n8n integrates with AutoComply AI purely via HTTP nodes:

- **Health / status**
  - `GET /health`

- **Compliance artifacts**
  - `GET /compliance/artifacts`

- **CSF evaluation & explain**
  - `POST /csf/practitioner/evaluate`
  - `POST /csf/hospital/evaluate`
  - `POST /csf/researcher/evaluate`
  - `POST /csf/surgery-center/evaluate`
  - `POST /csf/ems/evaluate`
  - `POST /csf/explain`

- **Ohio TDDD evaluation & explain**
  - `POST /ohio-tddd/evaluate`
  - `POST /ohio-tddd/explain`

- **RAG regulatory explain**
  - `POST /rag/regulatory-explain`

RAG behavior is controlled by:

- `AUTOCOMPLY_ENABLE_RAG` (env flag)
- `OPENAI_API_KEY` (when real LangChain RAG is enabled)

In CI or lightweight environments, `/rag/regulatory-explain` runs in **stub
mode** and does not require external API keys.

---

## 2. Workflow 1 – “PR Merge Compliance Summary” (GitHub → n8n → Slack/Email)

### Purpose

When a pull request touching compliance logic (CSF / Ohio / RAG) is merged,
automatically:

1. Ping the AutoComply backend to ensure it is healthy.
2. Run a small set of smoke evaluations (CSF + Ohio).
3. Generate a human-readable summary and explanation.
4. Post to a Slack channel or email distribution list for compliance / devs.

### Trigger

- **Node:** GitHub Webhook
- **Event:** `pull_request` with `action=closed` and `merged=true`
- **Filter:** PR touches any of:
  - `autocomply/domain/csf_*.py`
  - `autocomply/domain/ohio_tddd.py`
  - `autocomply/domain/rag_regulatory_explain.py`
  - `src/api/routes/csf_*.py`
  - `src/api/routes/ohio_tddd*.py`
  - `src/api/routes/rag_regulatory.py`

### High-Level Flow

1. **GitHub Webhook → n8n**

   Receive PR payload with:
   - Repo name / branch
   - PR title, number, author
   - List of changed files

2. **Check backend health**

   - Node: HTTP Request → `GET {API_BASE}/health`
   - If status ≠ 200:
     - Short-circuit and send “backend unhealthy” alert to Slack/email.
     - Include PR info and health error.

3. **Run CSF smoke checks**

   Example nodes:

   - HTTP → `POST /csf/practitioner/evaluate` with a minimal valid payload.
   - HTTP → `POST /csf/practitioner/evaluate` with a payload that should hit
     a **manual_review** path (e.g., FL + Schedule II).
   - HTTP → `POST /csf/explain` on each decision to get engine-level
     explanations.

   Store results in n8n workflow data:
   - status (`ok_to_ship`, `blocked`, `manual_review`)
   - `reason`
   - `regulatory_references`

4. **Run Ohio TDDD smoke checks**

   - HTTP → `POST /ohio-tddd/evaluate`
     - Valid in-state application (`ship_to_state="OH"`) → expect `approved`.
     - Out-of-state shipping (`ship_to_state="PA"`) → expect `manual_review`.
   - HTTP → `POST /ohio-tddd/explain` to get reasons.

5. **Optional: Deep RAG explanations**

   For each decision (CSF + Ohio), call:

   - HTTP → `POST /rag/regulatory-explain`

     Example body:

     ```json
     {
       "question": "Explain this decision for a quick PR merge summary.",
       "regulatory_references": ["csf_practitioner_form", "csf_fl_addendum"],
       "decision": { ...decision JSON... }
     }
     ```

   In stub mode, this returns deterministic placeholder text.
   In real RAG mode, it returns a doc-grounded explanation.

6. **Assemble summary**

   - Node: Function / Set to build a markdown summary:

     - PR info (title, number, author)
     - Backend health status
     - CSF smoke results (status + brief explanation)
     - Ohio TDDD smoke results
     - Optional RAG snippets

7. **Send to Slack / Email**

   - Node: Slack (chat.postMessage) OR Email node.
   - Channel: e.g. `#autocomply-ci` or `#compliance-dev`
   - Message: the markdown summary.

---

## 3. Workflow 2 – “On-demand CSF/Ohio Check from Slack” (Slash Command)

### Purpose

Allow compliance or support users to quickly test a CSF or Ohio TDDD scenario
from Slack using a slash command (e.g., `/csf-check` or `/tddd-check`).

### Trigger

- **Node:** Slack Slash Command
- **Command:** `/csf-check` or `/tddd-check`
- **Input format (examples):**

  ```txt
  /csf-check practitioner state=FL schedule=II
  /tddd-check ship_to_state=PA license_type=wholesale

High-Level Flow

Parse slash command text

Node: Function to parse:

CSF type (practitioner, hospital, etc.)

Basic flags:

state=FL

schedule=II

etc.

Construct a minimal form payload accordingly.

Call evaluation endpoint

Examples:

CSF:

POST /csf/practitioner/evaluate (or hospital/researcher etc.)

Ohio TDDD:

POST /ohio-tddd/evaluate

Call explain endpoint

POST /csf/explain or POST /ohio-tddd/explain

Use decision JSON returned from step 2.

Optional: Call RAG explain

POST /rag/regulatory-explain

Use:

regulatory_references from decision

decision JSON

question such as:
"Explain this decision for a non-technical support analyst."

Format Slack response

Node: Function to build a concise message:

Status (OK / Blocked / Manual review)

One-line reason

Key missing fields (if any)

Key regulatory references (e.g. csf_fl_addendum, ohio_tddd_registration)

Optional RAG snippet (1–2 sentences)

Respond to Slack

Node: Slack (respond to the original slash command).

Mode: ephemeral or channel message, depending on use case.

4. Workflow 3 – “Nightly Regulatory Snapshot”
Purpose

Produce a daily snapshot of AutoComply AI’s regulatory coverage and RAG health
for observability and documentation.

Trigger

Node: Cron (n8n)

Schedule: 1× per day (e.g., 02:00 UTC)

High-Level Flow

Check backend health

GET /health

If unhealthy: send simple failure email and exit.

Fetch coverage artifacts

GET /compliance/artifacts

Summarize:

Number of artifacts

Breakdown by jurisdiction (e.g., US-Multi, US-FL, US-OH)

Breakdown by artifact_type (form, addendum, guidance, etc.)

Run a simple RAG probe

POST /rag/regulatory-explain with a fixed question, e.g.:

{
  "question": "Briefly describe how the Florida addendum affects practitioner CSF decisions.",
  "regulatory_references": ["csf_practitioner_form", "csf_fl_addendum"],
  "decision": null
}


This returns:

Stub text (if RAG is disabled),

Or real grounded text (if enabled).

Generate nightly report

Include:

Health status

Coverage summary (counts per jurisdiction/type)

RAG mode (debug.mode from response)

RAG answer snippet

Send report

Output via:

Email

Slack

Or stored in e.g. Google Sheets / Notion via n8n nodes.

5. Implementation Notes

Security

Backend should be protected with an API key or network-level controls.

n8n HTTP nodes should attach required auth headers.

Environment

For production-like RAG runs, ensure:

AUTOCOMPLY_ENABLE_RAG=1

OPENAI_API_KEY is set

RAG dependencies are installed (see rag_setup.md)

Stub vs. real RAG

In test/staging environments, n8n can still call
/rag/regulatory-explain in stub mode for structure validation and
CI-style smoke checks.

In production, the same workflows can be switched to real RAG mode
without changing n8n logic; only environment configuration changes.
