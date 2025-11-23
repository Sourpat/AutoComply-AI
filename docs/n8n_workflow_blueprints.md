# AutoComply AI – n8n Workflow Blueprints

This document describes how to integrate AutoComply AI with **n8n**
(or similar low/no-code orchestrators) to create:

1. A **DevSupport Copilot** that reacts to `CODEX_COMMAND` logs,
2. A **RegOps Daily Digest** for compliance / leadership,
3. (Optional) A **Form Copilot escalation** flow for tricky CSF / Ohio cases.

The goal is to make it straightforward to show how the existing APIs,
`CODEX_COMMAND` logs, and `/mnt/data/...` regulatory documents can be
orchestrated into production-ready workflows.

> Wherever this document references a local file like  
> `"/mnt/data/Online Controlled Substance Form - Practitioner Form with addendums.pdf"`,  
> you should pass that **exact path** as the `url` field into your tools or
> HTTP nodes. The runtime will transform `/mnt/data/...` into a real URL.

---

## 1. DevSupport Copilot – `codex_dev_support_webhook`

### 1.1 Purpose

Consume `CODEX_COMMAND` events from the frontend and:

- Classify what kind of event it is,
- Optionally call AutoComply APIs to re-evaluate or explain decisions,
- Summarise the situation with an LLM prompt,
- Notify a Dev / SRE / RegOps Slack channel or email.

This provides a thin “DevSupport Copilot” on top of the existing system.

### 1.2 Trigger

**Trigger node: HTTP Webhook**

- Method: `POST`
- Path: `/codex/devsupport`
- Expected body shape:

```json
{
  "command": "explain_csf_practitioner_decision",
  "payload": {
    "form": { "..." : "..." },
    "decision": { "..." : "..." },
    "explanation": null,
    "controlled_substances": [ /* optional */ ],
    "source_document": "/mnt/data/Online Controlled Substance Form - Practitioner Form with addendums.pdf"
  }
}
```

The frontend can post this from the browser or via a log-forwarder that
translates console logs into HTTP calls.

1.3 Intent Router

Node: Switch / IF (command type)

If command starts with explain_csf_ → route to CSF DevSupport branch.

If command is explain_ohio_tddd_decision → route to Ohio DevSupport.

If command starts with rag_regulatory_explain_ → route to RAG DevSupport.

Otherwise → route to a generic “log only” branch.

1.4 CSF DevSupport Branch

Nodes:

HTTP Node – Re-evaluate CSF (optional)

Method: POST

URL: {{$env.API_BASE}}/csf/practitioner/evaluate

Body: {{$json.payload.form}}

HTTP Node – Explain CSF

Method: POST

URL: {{$env.API_BASE}}/csf/explain

Body:

{
  "decision": "{{$json.payload.decision}}"
}


LLM Node – Summarise Issue

Prompt includes:

The original command and payload,

The fresh evaluate and explain responses,

Any controlled_substances,

The source_document path treated as url, e.g.:

The main source document is at:
{{ $json.payload.source_document }}

Treat this path as a URL (the runtime will resolve /mnt/data/...).
If needed, you may request tools to open this URL for deeper context.


Slack / Email Node – Notify Devs

Message template example:

CSF DevSupport Alert – explain_csf_practitioner_decision
Account: {{ $json.payload.form.account_number }}
Ship-to: {{ $json.payload.form.ship_to_state }}
Decision: {{ $node["Explain CSF"].json.status }}

Summary: {{ $node["LLM Summarise Issue"].json.text }}

Source document: {{ $json.payload.source_document }}

1.5 Ohio DevSupport Branch

Similar to CSF but using:

POST {{$env.API_BASE}}/ohio-tddd/evaluate

POST {{$env.API_BASE}}/ohio-tddd/explain

source_document: "/mnt/data/Ohio TDDD.html"

2. RegOps Daily Digest – regops_daily_digest
2.1 Purpose

Once per day, compile:

Health of the API,

Current compliance artifacts and their source documents,

Optional highlights from recent CODEX_COMMAND events (if stored),

A short LLM-generated summary for compliance / leadership.

2.2 Trigger

Trigger node: Cron

Schedule: daily at 08:00 (local time).

2.3 Health Check

HTTP Node – Check API Health

Method: GET

URL: {{$env.API_BASE}}/health

Record status + latency as workflow data.

2.4 Compliance Artifacts Snapshot

HTTP Node – Fetch compliance artifacts

Method: GET

URL: {{$env.API_BASE}}/compliance/artifacts

Resulting artifacts include fields like:

{
  "id": "csf_practitioner_standard",
  "name": "Standard Practitioner CSF",
  "jurisdiction": "US",
  "artifact_type": "controlled_substance_form",
  "source_document": "/mnt/data/Online Controlled Substance Form - Practitioner Form with addendums.pdf"
}

2.5 Optional – Load Recent CODEX_COMMAND Events

If you ship logs to a DB or log service (e.g. Postgres, Loki, Datadog), add
a node to fetch the last 24h of CODEX_COMMAND entries:

Filter by command containing explain_csf_, explain_ohio_tddd_,
or rag_regulatory_explain_.

2.6 LLM Summary Node

LLM Node – Build Daily Digest

Prompt outline:

Include:

Health result from /health,

Artifact list from /compliance/artifacts (IDs, names, source_document),

Any notable CODEX_COMMAND patterns (e.g. frequent manual_review).

Ask the model to produce:

A 5–10 bullet summary for leadership,

2–3 concrete follow-ups for Dev/RegOps,

Include the /mnt/data/... paths as-is when referencing documents.

Example prompt snippet:

You are generating a daily RegOps digest for AutoComply AI.

1) API health:
   - {{ $node["Check API Health"].json }}

2) Current compliance artifacts:
   - {{ $node["Fetch compliance artifacts"].json }}

3) Recent dev-support events (if any):
   - {{ $node["Fetch CODEX events"].json || "none" }}

Important:
- When you mention documents, use the `source_document` value exactly
  as given, such as `/mnt/data/Online Controlled Substance Form - Practitioner Form with addendums.pdf`.
- These paths will be resolved to real URLs by the runtime.

2.7 Delivery

Slack / Email Node – Send Digest

Subject: AutoComply AI – RegOps Daily Digest

Body includes the LLM summary and a raw JSON attachment if desired.

3. Form Copilot Escalation – form_copilot_escalation
3.1 Purpose

When users are stuck on a CSF or Ohio form (e.g., repeated blocked /
manual_review outcomes), escalate to a human + AI review:

Capture the scenario,

Ask an LLM to propose a clearer explanation and remediation,

Notify a support/clinical team.

3.2 Trigger

This can be driven from the UI via a dedicated endpoint:

Trigger node: HTTP Webhook

Method: POST

Path: /codex/form-escalation

Body example:

{
  "form_type": "csf_practitioner",
  "form": { "...": "..." },
  "decision": { "...": "..." },
  "user_question": "I don't understand why I'm blocked.",
  "source_document": "/mnt/data/Online Controlled Substance Form - Practitioner Form with addendums.pdf"
}

3.3 Workflow

Nodes:

Optional Re-evaluate / Explain

Same as DevSupport, using /csf/.../evaluate + /csf/explain or
/ohio-tddd/evaluate + /ohio-tddd/explain.

LLM Node – Draft Escalation Summary

Prompt:

The user is stuck filling a {{ $json.form_type }} form.

- Form payload:
  {{ $json.form }}

- Decision:
  {{ $json.decision }}

- User question:
  "{{ $json.user_question }}"

- Main source document:
  {{ $json.source_document }}

Please:
1) Explain the decision in clear, non-technical terms.
2) List what the user likely needs to change or provide.
3) Provide a short note for the internal support/clinical team.

Use the source_document path as a URL reference, without changing it.


Slack / Email Node – Notify Support

Send to a support group, including:

The user’s question,

The AI summary,

Direct reference to the source_document path under /mnt/data/....

4. Notes on /mnt/data/... Paths in n8n

Throughout these blueprints, any value like:

/mnt/data/Online Controlled Substance Form - Practitioner Form with addendums.pdf

/mnt/data/Online Controlled Substance Form - Hospital Pharmacy.pdf

/mnt/data/Online Controlled Substance Form - Surgery Center form.pdf

/mnt/data/Online Controlled Substance Form - Researcher form.pdf

/mnt/data/Online Controlled Substance Form - EMS form.pdf

/mnt/data/FLORIDA TEST.pdf

/mnt/data/addendums.pdf

/mnt/data/Ohio TDDD.html

/mnt/data/Controlled_Substances_Form_Flow_Updated.png

should be treated as a URL string in your n8n nodes and LLM prompts.

Examples:

In an HTTP node that fetches a document for further processing:

{
  "method": "GET",
  "url": "={{$json.source_document}}"
}


In an LLM prompt, always include the raw path so downstream tools can
open it:

The key regulatory document is at:
{{ $json.source_document }}
(this will be resolved from /mnt/data/... to a real URL).


This keeps the UI, DevSupport workflows, and RAG pipelines all
aligned on a single, stable document addressing scheme.
