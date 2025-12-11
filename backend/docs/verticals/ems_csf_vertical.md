# EMS CSF Vertical – Controlled Substances Forms for EMS

## 1. Vertical purpose

The **EMS CSF vertical** models how AutoComply AI evaluates Controlled
Substances Form responses for **Emergency Medical Services (EMS)**:
ambulance services, paramedic units, etc.

It uses the canonical decision contract and focuses on mobile/
field-based controlled substances handling.

## 2. Primary entities and context

Scope:

- Actor: EMS organization / unit.
- Form: EMS CSF.
- Signals (conceptual examples):
  - Agency identifiers and jurisdiction
  - Medical director / oversight signals
  - Storage and transport details (vehicles, lockboxes)
  - Chain-of-custody practices
  - Expected drug types and use-cases (emergency care)

Key questions:

1. Is the EMS organization’s handling of controlled substances described
   clearly and acceptably?
2. Are any answers missing or conflicting with compliant practice?
3. Should the decision be ok_to_ship, needs_review, or blocked?

## 3. Engines used

The EMS CSF vertical uses the EMS-specific CSF evaluation endpoint, e.g.

- `/csf/ems/evaluate` (check actual router)

and surfaces decisions in the usual panels.

## 4. Example scenarios (conceptual)

### Scenario 1 – EMS CSF complete & compliant

- All agency identifiers provided.
- Transport and storage practices described with lockboxes, logs,
  and clear chain-of-custody controls.

Expected semantics:

- status: ok_to_ship (or equivalent success)
- risk_level: low
- reason: EMS CSF appears complete and aligned with modeled expectations
- missing_fields: none or minimal

### Scenario 2 – Missing critical EMS info

- Missing items like medical director details, storage descriptions, or
  required agency identifiers.

Expected semantics:

- status: needs_review or blocked
- risk_level: medium or high
- reason: highlights which parts of EMS setup are under-specified
- missing_fields: lists the missing EMS fields

### Scenario 3 – High-risk EMS practices

- Answers indicate poor storage, inadequate tracking, or unclear
  oversight.

Expected semantics:

- status: usually blocked
- risk_level: high
- reason: calls out risk patterns incompatible with safe EMS handling

## 5. Risk semantics

Same mapping:

- ok_to_ship → low
- needs_review → medium
- blocked → high

## 6. Explanation style

Explanations should:

- Reference EMS context and mobile handling patterns
- Clearly describe why the decision was made
- Stay stable for given inputs

Example:

> “Based on this EMS agency’s responses and modeled requirements for
> field handling of controlled substances, AutoComply AI considers this
> submission {{status_phrase}}.”

## 7. How to demo

1. Open Compliance Console → CSF sandboxes → EMS.
2. Choose EMS presets (complete, missing info, high-risk).
3. Evaluate and walk through Case Summary, Recent Decisions, and
   optionally the Explorer (EMS-related guidance).

## 8. Badge hint

UI badge text: `EMS CSF vertical`.
