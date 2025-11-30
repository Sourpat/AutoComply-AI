# AutoComply AI – API Endpoints

This document summarizes the primary API endpoints exposed by the
AutoComply AI backend. It focuses on the license validation flows that
power the frontend UI and the n8n automation layer.

Base URL (local dev):

- `http://localhost:8000`

With the global API prefix:

- `http://localhost:8000/api/v1`

---

## 1. JSON License Validation

Endpoint used by the React frontend for manual form entry.

- **Method:** `POST`
- **Path:** `/api/v1/license/validate/json`
- **Content-Type:** `application/json`

### Request (example)

```json
{
  "practice_type": "Standard",
  "state": "CA",
  "state_permit": "C987654",
  "state_expiry": "2028-08-15",
  "purchase_intent": "GeneralMedicalUse",
  "quantity": 10
}
```

### Response (example)

```json
{
  "success": true,
  "verdict": {
    "license_id": "CA-12345",
    "state": "CA",
    "allow_checkout": true,
    "reason": "License active and valid for this purchase intent.",
    "regulatory_context": [
      {
        "id": "dea-sched-ii-us",
        "jurisdiction": "US-DEA",
        "topic": "Schedule II",
        "text": "Practitioner must hold a valid DEA registration with authority for Schedule II substances.",
        "source": "DEA – Controlled Substances Act (summary)"
      }
    ]
  }
}
```

---

## Practitioner CSF Form Copilot – Regulatory RAG

The Practitioner Form Copilot endpoint runs the CSF decision engine and then
uses the regulatory RAG pipeline to generate a human-friendly explanation with
citations.

- **Method:** `POST`
- **Path:** `/csf/practitioner/form-copilot`
- **Content-Type:** `application/json`

### Request shape

- `engine_family` and `decision_type` are handled internally; callers only send
  the Practitioner CSF form payload plus an optional `question` override.
- The backend bundles the CSF decision, question, and `regulatory_references`
  (e.g., `csf_practitioner_form`) into the RAG query.

Example:

```json
{
  "facility_name": "Bay Medical Group",
  "facility_type": "individual_practitioner",
  "practitioner_name": "Dr. Example",
  "state_license_number": "SL-1234",
  "dea_number": "DEA-123",
  "ship_to_state": "CA",
  "attestation_accepted": true,
  "question": "Explain to a verification specialist what this decision means."
}
```

### Response shape

```json
{
  "status": "ok_to_ship",
  "reason": "<LLM explanation>",
  "rag_sources": [
    {
      "id": "csf_practitioner_form",
      "title": "Controlled Substance Form – Practitioner (Standard)",
      "jurisdiction": "US-Multi",
      "source": "artifact",
      "snippet": "Primary practitioner controlled substance form..."
    }
  ],
  "raw_decision": { "status": "ok_to_ship", "reason": "..." }
}
```

### Running locally

- Backend: `cd backend && uvicorn src.api.main:app --reload`
- Frontend sandbox: `cd frontend && pnpm dev`
- Enable regulatory vector search by populating the `data/rag/regulatory_docs`
  collection (see `docs/rag_setup.md`) and setting `AUTOCOMPLY_ENABLE_RAG=1`.

### Common errors

- **422** – missing CSF fields (e.g., DEA or license numbers). The response will
  still include a fallback explanation.
- **OpenAI/vector store issues** – the copilot falls back to the engine reason
  and an empty `rag_sources` list; check API logs for details.

### cURL example

```bash
curl -X POST http://localhost:8000/csf/practitioner/form-copilot \
  -H "Content-Type: application/json" \
  -d '{
    "facility_name": "Bay Medical Group",
    "facility_type": "individual_practitioner",
    "practitioner_name": "Dr. Example",
    "state_license_number": "SL-1234",
    "dea_number": "DEA-123",
    "ship_to_state": "CA",
    "attestation_accepted": true
  }'
```

Sandbox note: the Practitioner CSF sandbox exposes a "Check & Explain" button
that calls this endpoint; the UI will surface the RAG explanation and citations
when available.
