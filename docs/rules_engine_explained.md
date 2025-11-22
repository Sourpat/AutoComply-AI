# Rules Engine – Decision Logic

This document explains how the rules engine reasons about license validity and checkout decisions.

---

## 1. Inputs (LicenseValidationRequest)

The core request model includes (simplified):

- `practice_type` – e.g., Standard, Hospital, Telemedicine
- `state` – two-letter state code (e.g., CA, NY)
- `state_permit` – state license ID or permit number
- `state_expiry` – ISO date string (YYYY-MM-DD)
- `purchase_intent` – e.g., GeneralMedicalUse, ControlledSubstanceUse
- `quantity` – requested quantity for the order

The model is intentionally generic so you can reuse the same engine for:

- Simple license gating
- Controlled-substance workflows
- Future additions like DEA numbers, TDDD, etc.

---

## 2. Expiry logic

The decision engine normalizes `state_expiry` and compares it with `today`:

- If the date is **before** today:
  - `status = "expired"`
  - `allow_checkout = False`
- If the date is within a “near expiry” window:
  - `status = "near_expiry"`
  - `allow_checkout` may remain `True` but is flagged for extra caution.
- Otherwise:
  - `status = "active"`
  - `allow_checkout = True` (subject to other rules).

The thresholds are set in code in a way that’s easy to adjust later.

---

## 3. Jurisdiction + intent rules

The engine looks at a combination of:

- `state` (e.g., CA)
- `purchase_intent` (e.g., GeneralMedicalUse vs ControlledSubstanceUse)
- `quantity` and other contextual fields

This combination is what drives:

- Whether additional attestations are required.
- What regulatory context is retrieved by the RAG layer.

Example logic (simplified, demo-style):

- **CA + ControlledSubstanceUse**  
  Might require:
  - At least one storage/handling attestation.
  - Additional DEA-related context in the verdict.

- **CA + GeneralMedicalUse**  
  Might allow checkout with fewer/no attestations, but still attach `US-CA` regulatory snippets.

---

## 4. Attestations

Attestations are represented as structured objects:

- `id` – a stable key (e.g., `storage-conditions`)
- `jurisdiction` – e.g., `US-DEA`, `US-CA`
- `scenario` – human-readable scenario label
- `text` – checkbox text displayed to users
- `must_acknowledge` – whether acknowledgement is required

The engine returns `attestations_required` as part of the verdict.  
The frontend then:

- Renders attestations as chips / checkbox rows.
- Soft-gates the “Proceed to checkout” button until required attestations are acknowledged.

This pattern mirrors real-world controlled-substance flows where “click-through” acknowledgements are used to document user confirmation without blocking the UX entirely.

---

## 5. Verdict shape

The rules engine returns a verdict model with fields like:

- `allow_checkout: bool`
- `status: str`
- `is_expired: bool`
- `days_to_expiry: int | None`
- `state: str`
- `license_id: str | None`
- `attestations_required: List[Attestation]`
- `regulatory_context: List[RegulatorySnippet]` (populated by the RAG layer upstream in the API)

This structure makes it easy to:

- Render a clear UX.
- Emit structured events for audit / n8n.
- Extend the decision later (e.g., add DEA number, multi-state checks).

---

## 6. Philosophy

- **Deterministic decisions, explainable context.**  
  The engine always owns the final boolean decision; RAG is used for explanation.

- **Modular and testable.**  
  Pytest coverage is focused on:
  - Expiry math
  - Decision outcomes for different windows
  - Presence of attestations
  - RAG context wiring

- **Interview takeaway.**  
  You can talk about how you would:
  - Start from a messy compliance problem.
  - Isolate the deterministic parts into a rules engine.
  - Add AI/RAG only where it enhances explainability instead of controlling the verdict.
