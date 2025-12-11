# Practitioner CSF Vertical – Controlled Substances Forms

## 1. Vertical purpose

The **Practitioner CSF vertical** demonstrates how AutoComply AI can
evaluate a practitioner’s **Controlled Substances Form (CSF)** in an
explainable and repeatable way.

This vertical shows how form responses from an individual practitioner
(e.g., physician, dentist, prescriber) are turned into a structured
decision using the **canonical decision contract**:

- `status` (ok_to_ship, needs_review, blocked)
- `reason`
- `missing_fields`
- `regulatory_references`
- `rag_sources`
- `risk_level` / `risk_score`
- `debug_info`
- `trace_id`, `last_updated`

The goal is not to replicate every nuance of real-world onboarding, but
to show:

- How practitioner CSF answers feed into a decision
- How requirements are surfaced as **missing_fields**
- How red flags result in `needs_review` or `blocked`
- How explanations remain stable and testable.

## 2. Primary entities and context

This vertical is scoped to:

- **Actor**: Individual practitioner (e.g., MD, DO, DDS, DMD)
- **Form**: Practitioner CSF (Controlled Substances Form)
- **Signals captured from the form** (conceptual examples):
  - Practitioner license information (state, number, type)
  - DEA registration signals
  - Practice setting / facility details
  - Intended use of controlled substances
  - Acknowledgements / attestations (e.g., compliance statements,
    storage and security practices)
  - Any jurisdiction-specific statements (e.g., Ohio, NY, etc., if
    modeled for this vertical)

Key questions the engine answers:

1. Are the practitioner’s answers sufficiently complete to proceed?
2. Do any responses indicate a potential **compliance red flag**?
3. If information is missing or ambiguous, should the outcome be
   `needs_review` vs `blocked`?
4. How can this outcome be explained in a way that an **operations or
   compliance analyst** can quickly understand and action?

## 3. Engines used in this vertical

The Practitioner CSF vertical sits on top of the CSF evaluation layer.

Conceptually, the flow uses:

- A **practitioner CSF evaluation endpoint**  
  (for example, a route under `/csf/practitioner/evaluate` in the CSF
  router; see backend routing for exact paths).
- Canonical decision contract logic shared across:
  - CSF evaluations
  - License engines
  - Mock order evaluations
- Optional RAG support for pointing to relevant controlled substances
  and practitioner-related regulatory references.

The practitioner CSF frontend sandbox calls into this evaluation
endpoint, then displays the canonical decision contract in the
Compliance Console (Case Summary, Recent Decisions, etc.).

## 4. Example scenarios (conceptual)

These examples are **narrative only**. They are intended to mirror the
intent of existing tests and behavior without changing any backend logic.

### Scenario 1 – Practitioner form complete, no red flags

- Practitioner provides all required identification and licensing
  information.
- Controlled substance use is clearly described and within expected
  bounds (e.g., for standard medical/dental practice).
- No answers suggest unusual or prohibited use patterns.

**Expected decision semantics (high-level)**:

- `status`: typically `ok_to_ship` or equivalent success path in this
  flow, per current rules/tests.
- `risk_level`: `low` (under the platform-wide mapping).
- `reason`: indicates that practitioner CSF responses appear complete
  and acceptable for onboarding / proceeding.
- `missing_fields`: empty or minimal.
- `regulatory_references`: may include generic controlled substances
  and practitioner-related references used by the engine.

The explanation should read like:

> AutoComply AI considers this practitioner’s responses acceptable to
> proceed, based on the provided information and the modeled rules for
> practitioner-controlled substances onboarding.

### Scenario 2 – Missing key practitioner or license information

- Practitioner omits fields such as:
  - License number
  - License state
  - DEA registration where required
- Some answers are too vague or incomplete to safely proceed.

**Expected decision semantics (high-level)**:

- `status`: usually `needs_review` (or `blocked` if current rules/tests
  require blocking for the given gaps).
- `risk_level`: `medium` (`needs_review`) or `high` (`blocked`).
- `reason`: clearly explains that required practitioner / license
  information is missing or incomplete.
- `missing_fields`: explicitly lists which fields the engine expects
  (e.g., practitioner license number, license state, DEA number).

The explanation should convey that:

- Certain mandatory details are missing.
- A human reviewer must either obtain the missing information or decide
  whether there is an allowable exception.

### Scenario 3 – Red-flag answers suggesting potential non-compliance

- Practitioner answers indicate patterns such as:
  - Unusual or bulk quantities not supported by typical practice.
  - Storage or security practices that may not meet controlled
    substances standards.
  - Intended use or distribution patterns that appear outside normal
    prescribing behavior.

**Expected decision semantics (high-level)**:

- `status`: generally `blocked` for clearly non-compliant patterns, as
  defined by existing rules/tests.
- `risk_level`: `high`.
- `reason`: explains that some responses indicate potential
  non-compliance or elevated risk requiring intervention.
- `regulatory_references`: may include rules related to controlled
  substances handling, storage, and prescriber responsibilities.

The explanation should:

- Explicitly call out that certain answers are incompatible with safe,
  compliant controlled substances handling.
- Point to the relevant policy / regulatory pillars (at a high level)
  used by the engine.

## 5. Risk semantics

The Practitioner CSF vertical uses the **same platform-wide mapping**:

- `ok_to_ship` → `low` risk
- `needs_review` → `medium` risk
- `blocked` → `high` risk

In UI, this is reflected in:

- **Recent Decisions** risk badges
- **Operational Overview** risk counts
- **Case Summary** panel

This keeps practitioner CSF aligned with NY Pharmacy, Ohio Hospital, and
other verticals.

## 6. Explanation style

Practitioner CSF explanations must follow the **analyst-style,
deterministic** pattern used across AutoComply AI:

- Clearly state the **decision status** (e.g., considered acceptable,
  requires review, blocked).
- Refer to:
  - Practitioner context (individual prescriber CSF)
  - Controlled substances / regulatory expectations
- Provide a short, stable **snippet** summarizing key reasons.

Example structure (illustrative):

> “Based on the practitioner’s responses and the modeled requirements
> for controlled substances handling, AutoComply AI considers this
> submission {{status_phrase}}. This assessment is based on the supplied
> practitioner and license details and current controlled substances
> policy rules in the system.”

The actual text is produced by the explanation builder and should remain
**stable and testable** for given inputs.

## 7. How to demo this vertical in the Compliance Console

1. Open the **Compliance Console** in the frontend.
2. Navigate to the **CSF sandboxes** section and choose the
   **Practitioner** sandbox.
3. Select a practitioner CSF preset once the vertical badge and presets
   are wired in (e.g., “Practitioner CSF – complete form”, “Practitioner
   CSF – missing license info”, “Practitioner CSF – red flag answers”).
4. Inspect the CSF request payload or UI representation of the form:
   - Practitioner identifiers
   - License signals
   - Key answers / attestations
5. Click **Evaluate** to send the data to the backend.
6. Open the **Case Summary** panel:
   - Confirm that the canonical decision contract fields are populated.
   - Check `status`, `reason`, `risk_level`, `missing_fields`, and
     `regulatory_references`.
7. Open the **Recent Decisions** panel:
   - See the practitioner CSF entry with the correct risk badge and
     timestamp.
8. If integrated, use the **Regulatory Knowledge Explorer** to:
   - Search for practitioner-controlled substances guidance.
   - Show how the RAG-backed snippets conceptually support the
     explanation.

This gives stakeholders a clear practitioner CSF story:
form → evaluation → decision → explanation → trace and knowledge context.

## 8. Vertical badge & labeling (frontend hint)

In the UI, practitioner CSF presets should be visually labeled as a
vertical, similar to NY Pharmacy and Ohio Hospital:

- Badge text: `Practitioner CSF vertical`
- Shown on:
  - Scenario preset cards, and/or
  - Active scenario header

The badge is **purely narrative** (no behavior changes), but provides:

- A stable anchor for demos and documentation.
- A clear signal that this is an integrated compliance vertical on top
  of the core decision engine.

Frontend changes for this badge and presets are handled separately as
part of Track C polish but should follow the same conventions used
for existing verticals.

