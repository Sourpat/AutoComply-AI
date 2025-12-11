# Ohio Hospital Vertical – Controlled Substances & TDDD

## 1. Vertical purpose

The **Ohio Hospital vertical** demonstrates how AutoComply AI evaluates
hospital orders for prescription and controlled drugs shipping into Ohio,
using the same canonical decision contract that powers all engines:

- `status` (ok_to_ship, needs_review, blocked)
- `reason`
- `missing_fields`
- `regulatory_references`
- `rag_sources`
- `risk_level` / `risk_score`
- `trace_id`, `last_updated`

This vertical focuses on how **Ohio TDDD licensure + order details**
combine into a single explainable decision for a hospital ship-to.

## 2. Primary entities and context

This vertical is scoped to:

- **Facility type**: Hospital
- **Jurisdiction**: Ohio
- **Order contents**:
  - Dangerous drugs (prescription-only, may or may not be controlled)
  - For some scenarios, explicit controlled substance signals
- **Licensing signals**:
  - Ohio TDDD license number (if present)
  - TDDD license category (e.g., Category II / III / Limited variants)
  - Practitioner / facility identifiers as needed

Key questions the engine answers:

1. Does this hospital account fall under Ohio TDDD requirements for the
   products on the order?
2. If yes, is there a **valid, active TDDD license** supporting the order?
3. If TDDD is required but missing/invalid, should the order be
   `blocked` or `needs_review`?
4. How should this be explained to an operations / compliance analyst
   in a stable, repeatable way?

## 3. Engines used in this vertical

The Ohio Hospital vertical uses the same modular engine stack as the rest
of AutoComply AI:

- **Order / facility flow** (Ohio hospital mock order endpoint)
- **Ohio TDDD license engine**
  - `POST /license/ohio-tddd/evaluate`
- **Case summary + decision contract**
  - `GET /cases/summary/{trace_id}`

The hospital order evaluation may internally call the Ohio TDDD license
engine to determine if the hospital’s licensing posture is compatible
with the requested items and jurisdiction.

## 4. Example scenarios (conceptual)

These examples are narrative-only. They are intended to **mirror the
existing tests**, not change backend behavior.

### Scenario 1 – Hospital with appropriate TDDD license

- Facility: Ohio hospital
- Products: mix of prescription drugs within the scope of the hospital’s
  TDDD license
- TDDD license: present, active, correct category

**Expected decision semantics**:

- `status`: `ok_to_ship`
- `risk_level`: `low`
- `reason`: hospital TDDD licensing is valid for the requested products
- `regulatory_references`: Ohio TDDD rules (e.g., OAC 4729:5 and related)
- Explanation: clearly states that, based on the provided data and
  current Ohio rules, the order is appropriate to ship.

### Scenario 2 – Hospital with missing TDDD where required

- Facility: Ohio hospital
- Products: prescription drugs that would normally require a TDDD license
- TDDD license: not provided and no valid exemption

**Expected decision semantics**:

- `status`: `blocked` (or `needs_review` depending on the existing tests)
- `risk_level`: `high` (for blocked) or `medium` (for needs_review)
- `reason`: TDDD license appears required but is missing
- `missing_fields`: includes whichever license identifiers the engine
  expects for this flow
- Explanation: clearly calls out that Ohio TDDD requirements may apply
  and that the order cannot proceed without appropriate licensure or
  a verified exemption.

### Scenario 3 – Hospital with TDDD but incompatible with order

- Facility: Ohio hospital
- Products: include controlled substances beyond the scope of the current
  TDDD category (for example, controlled drugs where only a
  non-controlled category is present)
- TDDD license: present but insufficient for the specific items

**Expected decision semantics**:

- `status`: typically `blocked` (per existing rules/tests)
- `risk_level`: `high`
- `reason`: license category does not authorize the requested products
- `regulatory_references`: Ohio TDDD category rules
- Explanation: highlights the category mismatch and points to the
  relevant Ohio classification logic.

## 5. Risk semantics

The Ohio Hospital vertical uses the **platform-wide risk mapping**:

- `ok_to_ship` → `low` risk
- `needs_review` → `medium` risk
- `blocked` → `high` risk

These risk levels are surfaced consistently across:

- Recent Decisions panel
- Operational Overview (risk counts)
- Case Summary panel

## 6. Explanation style

All Ohio Hospital decisions must follow the same **analyst-style,
deterministic explanation** pattern used across AutoComply AI:

- Reference the **jurisdiction** (Ohio)
- Clearly state the **decision status**
- Name at least one **primary regulatory reference** (e.g., rules for
  Ohio TDDD licensure)
- Provide a short, stable **contextual snippet** derived from RAG sources

Example structure (illustrative):

> “Based on the information provided and current Ohio rules for hospital
> facilities, AutoComply AI considers this request {{status_phrase}}.
> This assessment is informed by Ohio TDDD licensing requirements and
> the details supplied for this ship-to location.”

The exact text is produced by the explanation builder and should remain
**testable and deterministic**.

## 7. How to demo this vertical in the Compliance Console

1. Open the **Compliance Console** in the frontend.
2. Select the **Ohio Hospital** preset under mock order / facility flows
   (for example: “Ohio Hospital – demo”).
3. Review the request payload JSON to see:
   - facility type = hospital
   - jurisdiction = Ohio
   - any TDDD / DEA details supplied
4. Click **Evaluate** to send the request to the backend.
5. Open the **Case Summary** panel:
   - Confirm the canonical decision contract fields are populated
   - Check `status`, `reason`, `risk_level`, `missing_fields`
6. Open the **Recent Decisions** panel to see:
   - The Ohio Hospital vertical entry with correct risk badge color
7. (If wired) Open the **Regulatory Knowledge Explorer**:
   - Filter to Ohio / TDDD rules
   - Run a search that mirrors the logic used in the decision
   - Confirm that the RAG snippets align with the explanation text.

## 8. Vertical badge & labeling (frontend hint)

In the UI, the Ohio Hospital scenarios should be visually identified as
a **vertical demo**, similar to NY Pharmacy:

- A small badge such as: `Ohio Hospital vertical`
- Visible in the scenario header or results panel
- Non-functional (purely narrative) but stable, so it can be referenced
  in demos and documentation

Frontend changes for the badge are handled separately as part of
Track C polish, but this document defines the intended narrative.

