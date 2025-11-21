# AutoComply AI – API Reference

This document describes the public backend API surface of AutoComply AI.

Base URL examples:

- Local dev: `http://localhost:8000`
- Deployed (e.g. Render / Fly.io): `https://<your-backend-host>`

All endpoints are versioned under:

- `/api/v1/licenses/...`

---

## 1. JSON License Validation

Validate a license via **manual/JSON input** (e.g., from the frontend form).

### Endpoint

`POST /api/v1/licenses/validate/license`

### Request Body (JSON)

The request is validated against `LicenseValidationRequest`.  
Fields (current version):

```jsonc
{
  "practice_type": "Standard",
  "state": "CA",
  "state_permit": "C987654",
  "state_expiry": "2028-08-15",
  "purchase_intent": "GeneralMedicalUse",
  "quantity": 10
}
```
