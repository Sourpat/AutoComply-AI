# Facility CSF Vertical – Controlled Substances Forms

## 1. Vertical purpose

The **Facility CSF vertical** demonstrates how AutoComply AI evaluates
 a **facility-level Controlled Substances Form (CSF)** (e.g., clinics,
offices, non-hospital facilities) using the canonical decision contract:

- status (ok_to_ship, needs_review, blocked)
- reason
- missing_fields
- regulatory_references
- rag_sources
- risk_level / risk_score
- debug_info
- trace_id, last_updated

The goal is to show how a facility’s responses about controlled
substances storage, handling, and intent are turned into a structured,
explainable decision.

## 2. Primary entities and context

Scope:

- Actor: facility (non-hospital) such as clinics, surgery centers that
  are not modeled under the dedicated hospital vertical.
- Form: Facility CSF.
- Signals (conceptual):
  - Facility type and location
  - License / registration identifiers
  - Storage controls and security practices
  - Types of controlled substances handled
  - Volume / frequency patterns
  - Any relevant attestations

Key questions:

1. Are facility responses complete enough to move forward?
2. Does anything indicate elevated risk or non-compliance?
3. Should the outcome be ok_to_ship, needs_review, or blocked?

## 3. Engines used

The Facility CSF vertical uses the CSF evaluation layer for facilities,
via a route such as `/csf/facility/evaluate` (see actual router).

Decisions are expressed via the canonical contract and surfaced in:

- Case Summary
- Recent Decisions
- Operational Overview

## 4. Example scenarios (conceptual)

### Scenario 1 – Facility CSF complete & reasonable

- All required facility and license details are filled in.
- Storage / security and usage answers look consistent with typical use.

Expected semantics (high-level):

- status: ok_to_ship or equivalent success path
- risk_level: low
- reason: indicates facility CSF appears complete and acceptable
- missing_fields: empty or minimal

### Scenario 2 – Missing critical facility or license details

- Key fields like license number, facility ID, or controlled-substances
  storage details are missing.

Expected semantics:

- status: needs_review or blocked (per current rules/tests)
- risk_level: medium or high
- reason: clearly highlights missing or incomplete information
- missing_fields: lists the specific missing items

### Scenario 3 – Facility answers show potential non-compliance

- Answers suggest unsafe storage, unclear diversion controls, or
  patterns inconsistent with expected use.

Expected semantics:

- status: usually blocked
- risk_level: high
- reason: points to responses that indicate potential non-compliance
- regulatory_references: may include facility-handling guidance

## 5. Risk semantics

Uses platform-wide mapping:

- ok_to_ship → low
- needs_review → medium
- blocked → high

## 6. Explanation style

Explanations:

- Reference facility context and controlled substances handling
- Clearly state decision status
- Provide a short, deterministic rationale

Example structure:

> “Based on this facility’s responses and the modeled controlled
> substances handling requirements, AutoComply AI considers this
> submission {{status_phrase}}.”

## 7. How to demo

1. Open Compliance Console.
2. Go to CSF sandboxes → Facility.
3. Select a Facility CSF preset (e.g., complete, missing info, red flags).
4. Evaluate and inspect Case Summary and Recent Decisions.
5. Optionally use Regulatory Knowledge Explorer for facility-related rules.

## 8. Badge hint

UI badge text: `Facility CSF vertical`, on presets and/or active scenario.
