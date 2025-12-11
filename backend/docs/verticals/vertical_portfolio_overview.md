# AutoComply AI – Vertical Portfolio Overview

This document summarizes all current **demo-ready verticals** in
AutoComply AI and how they connect to:

- Frontend sandboxes and presets
- Backend evaluation endpoints
- The canonical decision contract
- Explainability and RAG story

For detailed narratives, see each vertical’s dedicated doc.

---

## 1. Canonical decision contract and shared semantics

All verticals rely on the same **canonical decision contract**:

- `status` (ok_to_ship, needs_review, blocked)
- `reason`
- `missing_fields`
- `regulatory_references`
- `rag_sources`
- `risk_level` / `risk_score`
- `debug_info`
- `trace_id`, `last_updated`

with platform-wide **risk mapping**:

- `ok_to_ship` → low risk
- `needs_review` → medium risk
- `blocked` → high risk

These fields are surfaced consistently in:

- **Case Summary** (JSON viewer)
- **Recent Decisions** (risk badges + timestamps)
- **Operational Overview** (risk-level counts)

Explanations are **analyst-style, deterministic**, and RAG-backed where
applicable.

---

## 2. Vertical catalogue (high-level)

Current verticals:

1. **NY Pharmacy vertical**
2. **Ohio Hospital vertical**
3. **Facility CSF vertical**
4. **Practitioner CSF vertical**
5. **EMS CSF vertical**
6. **Researcher CSF vertical**
7. **Surgery Center CSF vertical**

Each vertical has:

- A dedicated doc under `backend/docs/verticals/...`
- A UI badge in the Compliance Console (e.g. `NY Pharmacy vertical`)
- Preset scenarios (happy path + edge cases)
- Tests aligned with its narrative.

---

## 3. Per-vertical details

### 3.1 NY Pharmacy vertical

- **Doc**: `ny_pharmacy_vertical.md`
- **Frontend entry**:
  - Compliance Console → license/order sandbox with
    `NY Pharmacy vertical` badge.
  - Presets such as:
    - “NY Pharmacy – active license”
    - “NY Pharmacy – expired license”
    - “NY Pharmacy – wrong state license”
- **Backend endpoints** (conceptual):
  - `POST /license/ny-pharmacy/evaluate`
  - Optionally integrated into mock order flows for NY.
- **Story**:
  - Shows how pharmacy licensure and jurisdiction determine
    `ok_to_ship`, `needs_review`, or `blocked` for NY prescriptions.

---

### 3.2 Ohio Hospital vertical

- **Doc**: `ohio_hospital_vertical.md`
- **Frontend entry**:
  - Compliance Console → mock order / facility flows with
    `Ohio Hospital vertical` badge.
  - Presets such as:
    - “Ohio Hospital – TDDD in place”
    - “Ohio Hospital – missing TDDD”
    - “Ohio Hospital – incompatible TDDD category”
- **Backend endpoints** (conceptual):
  - Hospital-focused order evaluation route for Ohio
  - Internally uses `POST /license/ohio-tddd/evaluate` for TDDD checks.
- **Story**:
  - Demonstrates how Ohio TDDD licensure interacts with an Ohio hospital
    order and drives explainable risk outcomes.

---

### 3.3 Facility CSF vertical

- **Doc**: `facility_csf_vertical.md`
- **Frontend entry**:
  - Compliance Console → CSF sandboxes → Facility.
  - Presets with `Facility CSF vertical` badge:
    - Complete & acceptable
    - Missing critical info
    - High-risk responses
- **Backend endpoints** (conceptual):
  - `POST /csf/facility/evaluate`
- **Story**:
  - Shows how facility-level CSF responses (storage, licenses, usage)
    translate into structured decisions and missing_fields.

---

### 3.4 Practitioner CSF vertical

- **Doc**: `practitioner_csf_vertical.md`
- **Frontend entry**:
  - CSF sandboxes → Practitioner, with `Practitioner CSF vertical` badge.
  - Presets:
    - Complete & acceptable
    - Missing key practitioner/license info
    - Red-flag responses
- **Backend endpoints** (conceptual):
  - `POST /csf/practitioner/evaluate`
- **Story**:
  - Focuses on individual practitioner onboarding and red flags:
    incomplete IDs, missing licenses, or clearly risky answers.

---

### 3.5 EMS CSF vertical

- **Doc**: `ems_csf_vertical.md`
- **Frontend entry**:
  - CSF sandboxes → EMS.
  - Presets with `EMS CSF vertical` badge:
    - Complete & compliant field handling
    - Missing EMS identifiers / oversight details
    - High-risk EMS practices
- **Backend endpoints** (conceptual):
  - `POST /csf/ems/evaluate`
- **Story**:
  - Models field/mobile controlled substances handling:
    vehicles, lockboxes, logs, and EMS-specific oversight.

---

### 3.6 Researcher CSF vertical

- **Doc**: `researcher_csf_vertical.md`
- **Frontend entry**:
  - CSF sandboxes → Researcher.
  - Presets with `Researcher CSF vertical` badge:
    - Complete & controlled research setup
    - Missing protocol/IRB details
    - Suspicious research plans
- **Backend endpoints** (conceptual):
  - `POST /csf/researcher/evaluate`
- **Story**:
  - Demonstrates how research-context signals (protocols, IRB, storage)
    feed into decisions and explanations.

---

### 3.7 Surgery Center CSF vertical

- **Doc**: `surgery_center_csf_vertical.md`
- **Frontend entry**:
  - CSF sandboxes → Surgery Center.
  - Presets with `Surgery Center CSF vertical` badge:
    - Complete & appropriate practice
    - Missing key license / anesthesia / reconciliation details
    - High-risk surgery center behavior
- **Backend endpoints** (conceptual):
  - `POST /csf/surgery-center/evaluate`
- **Story**:
  - Focuses on ambulatory surgery / outpatient settings and how
    surgical controlled substances handling is evaluated.

---

## 4. How to demo the whole portfolio in a single session

1. **Open the Compliance Console** and briefly point to:
   - Case Summary panel
   - Recent Decisions
   - Regulatory Knowledge Explorer.

2. **Show 2 license/order verticals**:
   - NY Pharmacy vertical
   - Ohio Hospital vertical
   - For each:
     - Run a happy-path preset
     - Run at least one non-happy-path preset
     - Highlight status, risk_level, reason, and references.

3. **Show 2–3 CSF verticals**:
   - Practitioner CSF vertical
   - Facility CSF vertical
   - One from EMS / Researcher / Surgery Center as needed
   - For each:
     - Compare “complete & acceptable” vs “missing info” vs “high-risk”
     - Show how missing_fields and reason differ.

4. **Use Recent Decisions** to show:
   - Mixed portfolio of entries:
     - Different vertical badges
     - Different risk levels
   - Demonstrate that everything is flowing into the same decision log.

5. **Use Regulatory Knowledge Explorer** (if wired):
   - Filter to jurisdiction / theme (NY, Ohio, EMS guidance, etc.)
   - Run a search that matches one of the demos.
   - Connect snippets to the explanation text.

This flow makes it clear that AutoComply AI is:

- A unified **compliance operating system**, not a set of one-off scripts.
- Capable of hosting multiple verticals on top of one decision core and
  RAG layer.

---

## 5. Extending the portfolio

New verticals should follow this pattern:

1. Backend logic (if needed) using canonical decision contract.
2. Frontend sandbox + presets + vertical badge.
3. Vertical narrative doc under `backend/docs/verticals/`.
4. Well-named tests aligned with the narrative.
5. Inclusion in this portfolio overview and any stakeholder-facing
   README sections.

