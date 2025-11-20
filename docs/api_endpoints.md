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
