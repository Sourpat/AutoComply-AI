# Vertical demos – NY Pharmacy & Ohio Hospital

This document explains **how to demo the verticals** in AutoComply AI
using the Compliance Console. It ties together:

- The **NY Pharmacy vertical**
- The **Ohio Hospital vertical**

Both verticals are powered by the same **canonical decision contract**:

- `status` (ok_to_ship, needs_review, blocked)
- `reason`
- `missing_fields`
- `regulatory_references`
- `rag_sources`
- `risk_level` / `risk_score`
- `trace_id`, `last_updated`

and share:

- Platform-wide **risk semantics** (ok_to_ship = low, needs_review = medium, blocked = high)
- **Explainability-first** explanation style
- RAG-backed regulatory context where available.

For details on each vertical’s rules and scenarios, see:

- `ny_pharmacy_vertical.md`
- `ohio_hospital_vertical.md`

This file focuses on **how to demo** them end-to-end.

---

## 1. Common demo pattern for all verticals

Regardless of which vertical you are showing:

1. Open the **Compliance Console** (frontend).
2. Select a **scenario preset** tagged with a vertical badge:
   - Example badge: `NY Pharmacy vertical`, `Ohio Hospital vertical`
3. Inspect the **request payload** panel:
   - Note jurisdiction (NY / Ohio)
   - Note license / facility signals (e.g., NY license, Ohio TDDD, hospital flag)
4. Click **Evaluate**.
5. Review the **Case Summary**:
   - Confirm canonical decision contract fields:
     - `status`
     - `reason`
     - `risk_level` / `risk_score`
     - `regulatory_references`
     - `missing_fields` (if applicable)
     - `rag_sources` (if applicable)
   - Highlight the explanation text and how it references:
     - Jurisdiction (NY / Ohio)
     - Primary regulatory reference
     - Short, deterministic snippet
6. Open **Recent Decisions**:
   - Show the new entry with:
     - Correct risk badge (low / medium / high)
     - Scenario label
     - `updated_at` timestamp
7. Optionally open the **Regulatory Knowledge Explorer**:
   - Filter to the relevant jurisdiction (NY / Ohio)
   - Run a search that matches the scenario (e.g., “NY controlled substances”, “Ohio TDDD hospital”)
   - Show how snippets in the Explorer conceptually back the explanation.

This pattern keeps the focus on:

- Canonical decision contract
- Risk semantics
- Explainability and RAG alignment.

---

## 2. NY Pharmacy vertical – how to demo

For deep narrative details, see `ny_pharmacy_vertical.md`.  
Below is the **demo flow** in the UI.

### 2.1 Select a NY Pharmacy vertical preset

In the Compliance Console:

1. Go to the scenario presets section.
2. Look for presets with a badge like:

   - `NY Pharmacy vertical`

3. Example presets (names may vary slightly based on config):

   - “NY Pharmacy – active license”
   - “NY Pharmacy – expired license”
   - “NY Pharmacy – wrong state license”

Each of these maps to scenarios described in the NY Pharmacy vertical doc
(happy path, expired, wrong-state, etc.).

### 2.2 Run a NY Pharmacy evaluation

1. Choose **“NY Pharmacy – active license”** (happy path).
2. Inspect the request payload:
   - Ship-to state = NY
   - NY pharmacy license present and valid
   - Products within allowed scope
3. Click **Evaluate**.

In **Case Summary**, highlight:

- `status`: `ok_to_ship`
- `risk_level`: `low`
- `reason`: indicates valid NY pharmacy license for the requested items
- `regulatory_references`: points to NY rules as modeled in the engine
- `trace_id` and `rag_sources` (if RAG is involved)

Then switch to a non-happy-path preset, e.g.:

- “NY Pharmacy – expired license”
- “NY Pharmacy – wrong state license”

Re-run and contrast:

- `status`: `blocked` or `needs_review`
- `risk_level`: `high` (blocked) or `medium` (needs_review)
- `reason`: explains **why** the license posture is not acceptable
- `missing_fields` (if engine expects additional data)
- Regulatory references that match the failure mode.

### 2.3 Show NY in Recent Decisions & Explorer

- In **Recent Decisions**:
  - Point to the entry labeled with the NY Pharmacy scenario.
  - Show risk color and timestamp.

- In **Regulatory Knowledge Explorer**:
  - Filter to NY (or use a search that returns NY-related rules).
  - Show how citation snippets conceptually align with the explanation.

This gives a full end-to-end NY Pharmacy story: request → decision →
explanation → trace awareness → regulatory context.

---

## 3. Ohio Hospital vertical – how to demo

For narrative details, see `ohio_hospital_vertical.md`.  
Below is the **demo flow** in the UI.

### 3.1 Select an Ohio Hospital vertical preset

In the Compliance Console:

1. Go to the scenario presets section.
2. Look for presets with a badge like:

   - `Ohio Hospital vertical`

3. Example presets (names may vary slightly based on config):

   - “Ohio Hospital – TDDD in place”
   - “Ohio Hospital – missing TDDD”
   - “Ohio Hospital – incompatible TDDD category”

These correspond to the three core scenarios in the Ohio Hospital doc:

1. Hospital with appropriate TDDD license
2. Hospital with missing TDDD, where TDDD is required
3. Hospital with TDDD that is incompatible with the order contents.

### 3.2 Run the Ohio Hospital happy-path scenario

1. Select “Ohio Hospital – TDDD in place”.
2. Inspect the request payload:
   - Facility type = hospital
   - Jurisdiction = Ohio
   - TDDD license present and active
   - Products compatible with that TDDD category
3. Click **Evaluate**.

In **Case Summary**, highlight:

- `status`: `ok_to_ship`
- `risk_level`: `low`
- `reason`: explains that Ohio TDDD coverage is appropriate
- `regulatory_references`: reference Ohio TDDD rules (e.g., OAC 4729:5)
- `trace_id` and, if applicable, `rag_sources`

### 3.3 Run non-happy-path scenarios

Switch to:

- “Ohio Hospital – missing TDDD”  
  Expectation:
  - `status`: `blocked` or `needs_review` (per existing tests)
  - `risk_level`: `high` (blocked) or `medium` (needs_review)
  - `reason`: TDDD appears required but is missing
  - `missing_fields`: may include TDDD license identifiers

- “Ohio Hospital – incompatible TDDD category”  
  Expectation:
  - `status`: usually `blocked`
  - `risk_level`: `high`
  - `reason`: TDDD category does not authorize requested products

Show how the explanation text consistently:

- Names **Ohio** as jurisdiction
- Mentions TDDD requirements
- Provides a stable explanation structure as defined by the explanation builder.

### 3.4 Show Ohio in Recent Decisions & Explorer

- In **Recent Decisions**:
  - Show entries for the Ohio Hospital scenarios with `Ohio Hospital vertical` badge (in the preset UI) and appropriate risk colors.

- In **Regulatory Knowledge Explorer**:
  - Filter to Ohio / TDDD.
  - Run a search for “TDDD hospital dangerous drugs” or similar.
  - Link this back conceptually to the explanation and `regulatory_references`.

---

## 4. Positioning for stakeholders

When demoing verticals to stakeholders:

- Emphasize that:
  - These are not one-off scripts; they are **vertical stories** on top of a shared decision core and RAG layer.
  - Both NY Pharmacy and Ohio Hospital use the **same canonical contract, risk semantics, and explanation style**.
- Use the badges:
  - `NY Pharmacy vertical`
  - `Ohio Hospital vertical`
  as anchors to show how AutoComply AI can host multiple, independent,
  explainable compliance verticals under one console.

As new verticals are added (e.g., Practitioner CSF, Facility CSF),
they should follow the same pattern:

- Vertical doc
- UI badge
- Tests aligned with narrative
- A clear demo path in this overview.

