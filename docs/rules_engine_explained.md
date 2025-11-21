# Rules Engine Explained

A forthcoming version of this document will outline how the decision engine interprets YAML rules and orchestrates validations.

## Minimal Regulatory Knowledge Base (RAG Stub)

The current implementation includes a very small, in-memory
"regulatory knowledge base" under `src/rag/knowledge_base.py` and a
`RegulationRetriever` in `src/rag/retriever.py`.

These components:

- Store a few example snippets for:
  - DEA-level rules (e.g. Schedule II authority).
  - State-level rules (e.g. CA CSR).
  - Telemedicine / Ryan Haight style considerations.
- Provide simple filters by:
  - `jurisdiction` (e.g. `US-DEA`, `US-CA`)
  - Optional `topic` (e.g. `Schedule II`, `CSR`, `Telemedicine`).

This is **not** a full vector-based RAG system yet. It is a deliberate
intermediate step that:

1. Makes the regulatory context **explicit and testable**.
2. Provides a clear seam where a future embedding + vector store
   integration (Pinecone, Chroma, etc.) can be attached without changing
   the rest of the application.
3. Helps explain how AutoComply AI will attach **explainable context**
   (snippets + sources) to each license decision.

## EventPublisher Stub (Automation Hook)

The project includes an `EventPublisher` in `src/utils/events.py` with a
small configuration wrapper (`EventPublisherConfig`).

Responsibilities:

- Build normalized event payloads for license decisions
  (success flag, license ID, state, allow/deny, reason).
- Operate safely as a NO-OP when no automation configuration is set.
- Provide a clear seam where n8n workflows (Slack alerts, email, Airtable
  updates) can be wired in later.

Current behavior:

- Reads `AUTOCOMPLY_N8N_BASE_URL` and `AUTOCOMPLY_N8N_SLACK_WEBHOOK_PATH`
  from the environment.
- If not configured:
  - Logs the event payload at debug level.
  - Returns `False` from `publish_license_event`.
- If configured:
  - Logs the event payload at info level.
  - Returns `True` from `publish_license_event`.

Future behavior:

- Perform real HTTP POST calls to n8n webhooks (Slack, email, etc.).
- Add retry and error-handling logic.
- Optionally include correlation IDs and trace information for audit
  and observability.

This design keeps the automation hook **visible and testable** without
making the project depend on external services during development or CI.
