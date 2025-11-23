# RAG Setup – AutoComply AI

This document explains how to enable the real LangChain-based RAG pipeline
behind the `/rag/regulatory-explain` endpoint. By default, the project runs
in **stub mode** so that CI and local dev work without any external
dependencies or API keys.

## 1. Overview

Endpoint: `POST /rag/regulatory-explain`

Inputs:
- `question`: natural language question (e.g. "Explain why this CSF went to manual review.")
- `regulatory_references`: list of coverage artifact IDs
  (e.g. ["csf_practitioner_form", "csf_fl_addendum"])
- `decision`: optional raw decision JSON (CSF or Ohio TDDD)

Output:
- `answer`: text answer (stub or real RAG)
- `regulatory_references`: echo of the requested IDs
- `artifacts_used`: artifact IDs actually loaded
- `debug`: metadata (mode, counts, flags)

The implementation lives in:

```text
autocomply/domain/rag_regulatory_explain.py
src/api/routes/rag_regulatory.py
```

## 2. Modes

There are two main modes:

**Stub Mode (default)**

Env: `AUTOCOMPLY_ENABLE_RAG` unset or "0"

Behavior:

- No LangChain / LLM calls.
- The endpoint returns a deterministic, text-only answer that:
  - Echoes the `regulatory_references`,
  - Echoes the `question`,
  - Lists artifacts that would have been used.
- `debug.mode == "stub"`

This mode is used by:

- CI (pytest),
- Lightweight local dev,
- Environments without OpenAI keys or LangChain installed.

**Real RAG Mode**

Env: `AUTOCOMPLY_ENABLE_RAG="1"`

Requirements (installed in the backend environment):

```
langchain-openai>=0.1.0
langchain-community>=0.3.0
langchain-text-splitters>=0.3.0
chromadb>=0.5.0

pypdf>=4.0.0
unstructured>=0.15.0
unstructured[html]>=0.15.0
```

Required env vars:

- `OPENAI_API_KEY` – used by ChatOpenAI and OpenAIEmbeddings.

Behavior:

- Documents are loaded from source_document paths defined in coverage:
  - `/mnt/data/Online Controlled Substance Form - Practitioner Form with addendums.pdf`
  - `/mnt/data/Online Controlled Substance Form - Hospital Pharmacy.pdf`
  - `/mnt/data/Online Controlled Substance Form - Surgery Center form.pdf`
  - `/mnt/data/Online Controlled Substance Form - Researcher form.pdf`
  - `/mnt/data/Online Controlled Substance Form - EMS form.pdf`
  - `/mnt/data/FLORIDA TEST.pdf`
  - `/mnt/data/addendums.pdf`
  - `/mnt/data/Ohio TDDD.html`
- Documents are split into chunks and indexed in Chroma.
- A minimal RAG loop retrieves relevant chunks and asks ChatOpenAI
  to answer the question in the context of:
  - Regulatory text
  - The engine decision JSON (if provided)
- `debug.mode == "rag"` and `debug` includes counts:
  - `docs_loaded`
  - `chunks`

## 3. Using RAG from the frontend

All RAG calls go through `/rag/regulatory-explain`:

**RAG Playground (RagRegulatorySandbox component):**

- Lets you:
  - Type a question,
  - Select `regulatory_references` from the coverage registry,
  - Paste a decision JSON.

**Deep RAG explain in each sandbox:**

- Practitioner, Hospital, Researcher, Surgery Center, EMS CSF
- Ohio TDDD

Each component builds a context-specific question and calls the same
`/rag/regulatory-explain` endpoint, passing:

- `regulatory_references = decision.regulatory_references`
- `decision = the raw decision JSON`

In stub mode, these buttons return the deterministic stub text.
In real RAG mode, they produce grounded answers based on the underlying
PDF/HTML documents under `/mnt/data/....`

## 4. Local development workflow

**Default (stub) dev:**

- Do nothing; leave `AUTOCOMPLY_ENABLE_RAG` unset.
- Run backend with:

  ```
  uvicorn src.api.main:app --reload
  ```

- All tests and endpoints work without OpenAI / LangChain.

**Enable real RAG locally:**

- Install extra dependencies (in your virtualenv):

  ```
  pip install \
    langchain-openai langchain-community langchain-text-splitters \
    chromadb pypdf "unstructured[html]"
  ```

- Set env vars (example):

  ```
  export AUTOCOMPLY_ENABLE_RAG=1
  export OPENAI_API_KEY=sk-...
  ```

- Restart the backend and call:
  - `/rag/regulatory-explain`
  - RAG playground in the UI
  - Deep RAG explain from any sandbox

**CI considerations:**

- CI should not set `AUTOCOMPLY_ENABLE_RAG`.
- Tests in `tests/test_rag_regulatory_explain_api.py` assert stub behavior.
- If you ever add tests for real RAG, gate them behind an env flag.

## 5. Notes on /mnt/data paths

- The `source_document` field in `ComplianceArtifact` uses local paths
  (e.g. `/mnt/data/FLORIDA TEST.pdf`).
- The backend treats these as local filesystem paths when loading docs.
- DevSupport / Codex agents treat the same strings as url values in tool
  calls; the orchestration layer transforms the local path into an actual URL.
- This makes `/mnt/data/...` the single source of truth:
  - For the engine & RAG backend,
  - For UI, Codex, and other agents that need to open the same documents.
