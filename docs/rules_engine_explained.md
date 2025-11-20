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
