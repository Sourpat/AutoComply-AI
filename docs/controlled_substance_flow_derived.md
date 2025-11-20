# Controlled Substance & License Flow – Derived from Henry Schein Work

This document captures the high-level flow of the controlled substance
and license validation features that were originally implemented in the
Henry Schein Global E-Commerce Platform (GEP), and shows how those same
responsibilities are reimagined in AutoComply AI.

The goal is to make it obvious how this project is a **Generative AI +
automation upgrade** of the original, regulated enterprise workflow.

---

## 1. Original Flow – Simplified (Henry Schein)

### 1.1 Trigger points

A license / controlled substance check was triggered when:

- A user attempted to **add a controlled substance** to the cart, or
- A user **proceeded to checkout** with controlled substances present, or
- A **license/attestation form** was required based on product, ship-to
  state, or prescriber profile.

### 1.2 High-level steps

1. **Identify customer & ship-to**
   - Determine account, ship-to location, and applicable state/jurisdiction.
   - Retrieve any licenses on file for that ship-to / practitioner.

2. **Check license presence and type**
   - DEA license present? State CSR / state-specific permit present?
   - License type, schedules, and restrictions tied to the product(s)
     being ordered.

3. **Validate license status**
   - Check expiry dates.
   - Check that license covers the **correct drug schedule** and **ship-to
     state**.
   - Apply internal business rules (e.g., special handling for Florida,
     telemedicine, etc.).

4. **Determine next action**
   - **Allow** order to proceed (license valid).
   - **Block** order (no valid license, or license expired).
   - **Require additional attestation** or controlled substance form:
     - e.g., Ryan Haight / telemedicine attestations.
     - State-specific forms or addenda.

5. **User experience**
   - Show clear inline messages, banners, and/or modals:
     - When a license is missing.
     - When a license expired mid-session.
     - When an attestation is required.
   - Provide entry points for:
     - Adding a new license.
     - Uploading / updating controlled substance forms.
     - Selecting which license to apply (when multiple exist).

6. **Background processes**
   - **Expiry reminders** (e.g., 30/7 day emails).
   - **Sync with ERP / back office** (JDE) and verification teams.
   - **Audit trail** for regulatory and legal teams.

---

## 2. AutoComply AI – New Architecture for the Same Responsibilities

AutoComply AI re-implements the same responsibilities using:

- A FastAPI backend with a modular **decision engine**.
- A React frontend for **manual entry and instant feedback**.
- An OCR + PDF path for **scanned licenses**.
- An n8n layer for **email intake, Slack alerts, and reminders**.

### 2.1 Core flows in AutoComply AI

#### A. Manual JSON Validation

- Endpoint: `POST /api/v1/license/validate/json`
- Source: React form (manual entry)
- Responsibilities:
  - Accept typed license details (state, expiry, intent, etc.).
  - Use `license_validator` + `decision_engine` to:
    - Evaluate expiry (`evaluate_expiry` helper).
    - Decide `allow_checkout` vs. block.
  - Return a structured **verdict** object:
    - `allow_checkout`
    - `reason`
    - Optional fields like `license_id`, `state`, `days_to_expiry`, `expiry_bucket`.

This mirrors the **inline validation and guidance** that existed in the
Henry Schein checkout and license flows.

#### B. PDF / Scanned License Validation

- Endpoint: `POST /api/v1/license/validate-pdf`
- Source: n8n email intake, or future drag-and-drop UI
- Responsibilities:
  - Accept a PDF upload (`UploadFile`).
  - Pass bytes to `extract_license_fields_from_pdf` (OCR layer).
  - Produce a normalized verdict that is compatible with the JSON path.

This corresponds to the **back-office / document-based flows** where
licensing teams validated uploaded documents and updated systems.

#### C. Expiry & checkout decision

- Shared helper: `evaluate_expiry(expiry_date, today, near_expiry_window_days)`
- Used in the license validator to:
  - Flag expired vs. near-expiry vs. active.
  - Force `allow_checkout = False` for expired licenses.
  - Return `days_to_expiry` and `expiry_bucket` for reminders and UI.

This directly maps to the **“30/7 day” expiry logic** and blocking rules
from the original platform.

---

## 3. Automation Layer Mapping (n8n)

AutoComply AI’s automation layer recreates and extends the
“background processes”:

1. **Email intake → validation → storage**  
   (`email_intake.json`)
   - Watches a mailbox for renewal or license emails.
   - Sends attachments to `/validate-pdf`.
   - Posts results to Slack and updates Airtable (“mock JDE”).

2. **Slack alerts webhook**  
   (`slack_alerts.json` + `EventPublisher`)
   - Backend emits `license_validation` events.
   - n8n posts structured messages to `#license-alerts`.

3. **Renewal reminders**  
   (`renewal_reminders.json`)
   - Daily cron-based job.
   - Finds licenses with `DaysToExpiry` = 30 or 7.
   - Sends emails and Slack summaries.

These workflows reflect the **automated expiry reminders, internal
notifications, and audit/ops visibility** that previously lived in
separate systems and manual processes.

---

## 4. Future Enhancements – Regulatory & RAG

The long-term goal is to back the decision engine with:

- A small, auditable rules layer (per state, schedule, and product type).
- A RAG-based knowledge base sourced from:
  - DEA registrant data.
  - State Boards of Pharmacy regulations.
  - Federal rules (e.g., Ryan Haight Act updates).

Planned enhancements:

- **Attestation triggering**: Determine when to show which attestation
  modal based on product + jurisdiction rules.
- **Schedule validation**: Map product schedule vs. license authority.
- **Explainable decisions**: Attach citations to each verdict for
  compliance review.

This is exactly the evolution from “hard-coded enterprise workflow” to
“AI-native, explainable compliance agent”.

---

## 5. How to Talk About This in a Demo

When demoing AutoComply AI:

1. Start with the **original Henry Schein scenario**:
   - “Customer tries to order a controlled substance; system must check
     if a valid license is on file for that ship-to and product type.”

2. Show how AutoComply AI handles the same scenario:
   - Manual form → JSON endpoint → verdict.
   - PDF upload/email → OCR → verdict.
   - Expiry logic → `allow_checkout` flip + reminders.
   - Slack + Airtable updates in n8n.

3. Emphasize that:
   - The same regulated use case is now **modular, test-covered, and
     automation-friendly**.
   - The architecture is ready to plug in real OCR and regulatory RAG
     without changing the external contracts.

