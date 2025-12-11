# Surgery Center CSF Vertical – Controlled Substances Forms

## 1. Vertical purpose

The **Surgery Center CSF vertical** models how AutoComply AI evaluates
controlled substances forms for **ambulatory surgery centers** and
similar outpatient surgical facilities.

It demonstrates how surgical-use signals and storage practices tie into
the canonical decision contract.

## 2. Primary entities and context

Scope:

- Actor: ambulatory surgery center / outpatient surgical facility.
- Form: Surgery Center CSF.
- Signals (conceptual):
  - Facility and license identifiers
  - Types of procedures performed
  - Anesthesia and controlled substances usage
  - Storage and access controls in surgical environments
  - Counts, reconciliation, and disposal procedures

Key questions:

1. Does the surgery center describe acceptable handling and oversight?
2. Are key facility and license details complete?
3. Are any answers out of line with expected surgical practice?

## 3. Engines used

Uses the surgery center CSF evaluation endpoint (e.g.
`/csf/surgery-center/evaluate`), layered on the shared decision core.

## 4. Example scenarios (conceptual)

### Scenario 1 – Surgery center CSF complete & appropriate

- All identifiers present.
- Storage and reconciliation practices clearly defined.
- Usage expected for surgical settings.

Expected semantics:

- status: ok_to_ship
- risk_level: low
- reason: indicates surgery center CSF is complete and appropriate

### Scenario 2 – Missing key facility / license / anesthesia details

- Missing license numbers or incomplete descriptions of controlled
  substances storage or reconciliation.

Expected semantics:

- status: needs_review or blocked
- risk_level: medium or high
- reason: points to missing or under-specified high-impact details
- missing_fields: lists those missing

### Scenario 3 – High-risk surgery center behavior

- Answers suggest poor reconciliation, uncontrolled access, or patterns
  inconsistent with controlled substances in surgical settings.

Expected semantics:

- status: typically blocked
- risk_level: high
- reason: calls out high-risk handling patterns

## 5. Risk semantics

Same mapping: ok_to_ship → low, needs_review → medium, blocked → high.

## 6. Explanation style

Explanations should:

- Reference surgical context
- State decision status and main drivers
- Use deterministic, testable phrasing

Example:

> “Based on this surgery center’s responses regarding controlled
> substances handling in the surgical setting, AutoComply AI considers
> this submission {{status_phrase}}.”

## 7. How to demo

1. Open Compliance Console → CSF sandboxes → Surgery Center.
2. Pick presets for:
   - Complete & acceptable
   - Missing critical information
   - High-risk practices
3. Evaluate and show how Case Summary and Recent Decisions express the
   canonical decision contract.

## 8. Badge hint

UI badge text: `Surgery Center CSF vertical`.
