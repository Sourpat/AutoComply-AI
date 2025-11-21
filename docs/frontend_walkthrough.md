# Frontend Walkthrough – AutoComply AI

This document explains how the React frontend for AutoComply AI is
structured and how it maps to the backend APIs.

The goal of the UI is to make the compliance engine easy to demo:

- Manual JSON-style license entry
- PDF upload for scanned/emailed licenses
- A readable compliance card summarizing the decision and context

---

## 1. High-Level Layout

The frontend is built with:

- React + Vite
- A simple layout shell (header, content)
- Components under `src/components`
- Pages under `src/pages`
- API client under `src/services/api.js`

Key files:

- `src/App.jsx` – root router / layout wiring
- `src/pages/Home.jsx` – main page with manual form + upload box
- `src/components/UploadBox.jsx` – PDF uploader
- `src/components/ComplianceCard.jsx` – renders the decision & context
- `src/services/api.js` – typed calls to backend endpoints

---

## 2. Home Page

File: `src/pages/Home.jsx`

The Home page acts as the main workspace:

- Left side (or primary column):
  - Manual JSON-style license entry form:
    - `practice_type`
    - `state`
    - `state_permit`
    - `state_expiry`
    - `purchase_intent`
    - `quantity`
  - Submit button that calls:
    - `POST /api/v1/licenses/validate/license`

- Right side (or secondary column):
  - `UploadBox` for PDF upload:
    - Drag-and-drop or file picker
    - Calls:
      - `POST /api/v1/licenses/validate-pdf`

- Below or beside both:
  - `ComplianceCard` displaying the latest verdict and context.

The page is responsible for:

- Managing local state for:
  - Current form values
  - Loading/submit state
  - Latest `verdict` and `regulatory_context`
- Wiring results into `<ComplianceCard />`.

---

## 3. Manual Entry Form

Within `Home.jsx`, the manual form is conceptually tied to the backend
`LicenseValidationRequest` model:

Fields:

- **Practice type** (`practice_type`)
  - Example: `"Standard"` or `"Telemedicine"`.
  - Drives future attestation logic.

- **State** (`state`)
  - 2-letter ship-to state code (e.g. `"CA"`).
  - Used for state rules (e.g. CA CSR).

- **State permit/CSR** (`state_permit`)
  - State-level controlled substance registration / permit ID.

- **State expiry** (`state_expiry`)
  - ISO date string (`YYYY-MM-DD`).
  - Used by the expiry engine (`evaluate_expiry`).

- **Purchase intent** (`purchase_intent`)
  - Intended use string (e.g. `"GeneralMedicalUse"`).
  - Used for future Ryan Haight / telemedicine logic.

- **Quantity** (`quantity`)
  - Numeric quantity used in scenarios and future edge cases.

When the user submits:

1. A JSON payload is assembled.
2. The frontend calls `api.validateLicenseJson(...)` from `src/services/api.js`.
3. On success:
   - The `verdict` and `regulatory_context` are passed to `<ComplianceCard />`.

Basic client-side validation focuses on:

- Required fields (empty vs non-empty).
- Simple date formatting hints.
- Quantity as a positive integer.

---

## 4. PDF Upload Flow

Component: `src/components/UploadBox.jsx`

Responsibilities:

- Provide a clear CTA to:
  - Click to select a PDF
  - Drag-and-drop a PDF file
- Restrict to PDF MIME types where possible.
- Display simple status:
  - Idle / Ready
  - Uploading / Processing
  - Error states (e.g. invalid file)

On submit:

1. Builds a `FormData` payload with `file`.
2. Calls `api.validateLicensePdf(file)` from `src/services/api.js`.
3. On success:
   - Uses `response.verdict` and `response.extracted_fields`:
     - `verdict` is passed into `<ComplianceCard />`.
     - `extracted_fields` can be displayed or logged for debugging.

The PDF endpoint is currently backed by:

- `preprocess_pdf` (stub) → `[PdfPage]`
- `StubOcrPipeline` → `extracted_fields`
- `ComplianceEngine` → final verdict

All of this is invisible to the user but clearly surfaced via the card.

---

## 5. ComplianceCard – Decision & Context

Component: `src/components/ComplianceCard.jsx`

This component is responsible for presenting the core decision:

Data it receives:

- `license_id`
- `state`
- `allow_checkout`
- `status` / `expiry_bucket`
- `days_to_expiry`
- `is_expired`
- `regulatory_context[]`

Typical layout / sections:

1. **Header**
   - License ID + State
   - High-level status (Active / Near expiry / Expired)

2. **Decision Block**
   - “Checkout allowed” or “Checkout blocked”
   - Short explanation based on:
     - `allow_checkout`
     - `status`
     - `days_to_expiry`

3. **Expiry Panel**
   - Render readable text:
     - “Expires in 365 days”
     - “Expired 1 day ago”
   - Color or badge variation for:
     - Active
     - Near expiry
     - Expired

4. **Regulatory Context**
   - List of snippets from `regulatory_context`:
     - `jurisdiction` (e.g. `US-DEA`, `US-CA`)
     - `topic` (e.g. “Schedule II”, “CSR”)
     - Short `text` summary
     - `source` label

The goal is to resemble a **compliance analyst card**: concise, readable,
and clearly tied back to regulatory guidance.

---

## 6. API Client – `src/services/api.js`

The API client wraps calls to the backend:

- Uses `VITE_API_BASE` for base URL.
- Provides methods like:
  - `validateLicenseJson(payload)`
  - `validateLicensePdf(file)`

This keeps API logic out of components and makes it easy to:

- Swap environments (local vs deployed).
- Add interceptors / error handling later if needed.

---

## 7. Future Enhancements (UI)

The UI is intentionally minimal but designed for:

- Adding a “History” panel for recent validations.
- Showing upcoming renewal reminders (driven by n8n events).
- Highlighting licenses by risk (e.g., near expiry, high-schedule
  substances).
- Rendering more detailed attestation prompts and user actions
  (e.g., “Complete Ryan Haight attestation”).

All of these can be layered on top of the existing:

- JSON endpoint
- PDF endpoint
- `ComplianceCard` decision view
