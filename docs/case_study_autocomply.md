# Case Study – AutoComply AI: DEA & State License Compliance Co-Pilot

AutoComply AI is a technical portfolio project that reimagines a real
enterprise controlled substance and license management feature as a
modular, AI-ready compliance engine.

It is directly inspired by prior work on the Henry Schein Global
E-Commerce Platform (GEP), where a similar workflow was implemented for
regulated pharmacy e-commerce.

---

## 1. Business Context

### 1.1 Domain

- B2B / B2C pharmacy and medical e-commerce
- DEA-regulated controlled substances and state-specific licensing rules
- Multiple profiles involved:
  - Prescribers
  - Office administrators
  - Back-office license verification teams
  - Compliance / legal teams

### 1.2 Original Enterprise Problem

In the original Henry Schein program, the platform needed to:

- Ensure that orders for controlled substances were only placed when a
  valid DEA and/or state license was on file and in good standing.
- Handle complex **state-by-state rules** (e.g., California CSR) and
  special cases (telemedicine, Ryan Haight Act, specific states).
- Provide a clear user experience:
  - Allow checkout when licenses are valid
  - Block checkout when licenses are missing/expired
  - Trigger additional attestation or controlled substance forms when
    required
- Maintain a strong **audit trail** for regulatory and legal review.
- Coordinate with back-office systems (e.g., ERP) and license
  verification teams.

Much of this logic was implemented through:

- Backend rules and validations
- Checkout-level license checks
- Inline error messaging and modals
- Manual operational workflows

---

## 2. AutoComply AI – Concept

AutoComply AI takes the same problem space and reframes it as:

> “What if this entire license and controlled substance workflow were
> built as an AI-native, automation-ready compliance co-pilot?”

Key goals:

- Keep the **regulatory seriousness** of the original workflow.
- Make the architecture **modular and testable**.
- Prepare for:
  - OCR on scanned licenses
  - Regulatory RAG (DEA + state docs)
  - Event-driven automation (reminders, Slack alerts, audit logs)

AutoComply AI is intentionally scoped as a **sandbox**:

- No real PII or production credentials.
- Contracts and structures are realistic, but data is synthetic/stubbed.
- Perfectly suited for demos and technical deep dives.

---

## 3. Functional Scope

### 3.1 Manual JSON Validation

Endpoint: `POST /api/v1/license/validate/json`

Functionality:

- Accepts typed license details:
  - Practice type
  - Ship-to state
  - State permit / CSR
  - State expiry
  - Intended use / purchase intent
  - Quantity
- Runs through:
  - **Expiry logic** (`evaluate_expiry`)
  - Business rules about checkout allow/block
- Returns a structured verdict:

```json
{
  "success": true,
  "verdict": {
    "license_id": "CA-12345",
    "state": "CA",
    "allow_checkout": true,
    "reason": "License active and valid for this purchase intent.",
    "expiry_bucket": "active",
    "days_to_expiry": 365,
    "regulatory_context": [
      {
        "id": "ca-csr-required",
        "jurisdiction": "US-CA",
        "topic": "CSR",
        "text": "In California, a separate state-controlled substance registration may be required...",
        "source": "CA Board of Pharmacy (summary)"
      }
    ]
  }
}

```
