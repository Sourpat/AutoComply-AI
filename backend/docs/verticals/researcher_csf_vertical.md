# Researcher CSF Vertical – Controlled Substances Forms for Research Use

## 1. Vertical purpose

The **Researcher CSF vertical** demonstrates how AutoComply AI evaluates
Controlled Substances Form responses for **research-focused entities**:
labs, universities, research institutes.

It highlights how research-specific signals (protocols, IRB, storage)
map into the canonical decision contract.

## 2. Primary entities and context

Scope:

- Actor: researcher / research entity.
- Form: Researcher CSF.
- Signals (conceptual):
  - Institution / lab details
  - Study / protocol identifiers
  - IRB / ethics oversight indicators
  - Storage and recordkeeping for controlled substances
  - Disposal, diversion-prevention practices

Key questions:

1. Are research controlled substances handled with adequate controls?
2. Are key research-identifying details present and consistent?
3. Does any answer suggest unacceptable research use?

## 3. Engines used

Uses a researcher-specific CSF evaluation route such as
`/csf/researcher/evaluate` (see router), implemented on top of the
shared decision core.

## 4. Example scenarios (conceptual)

### Scenario 1 – Researcher CSF complete & controlled

- Clear institution info and protocol IDs.
- Storage, logs, and access control are well-described.

Expected semantics:

- status: ok_to_ship
- risk_level: low
- reason: research CSF appears complete and controlled
- missing_fields: none or minimal

### Scenario 2 – Missing key research identifiers

- No protocol ID, IRB info, or institution references where expected.

Expected semantics:

- status: needs_review or blocked
- risk_level: medium or high
- reason: highlights missing protocol / oversight information
- missing_fields: includes missing research fields

### Scenario 3 – Research plan suggests misuse

- Answers indicate research patterns inconsistent with approved use
  or suggest diversion.

Expected semantics:

- status: typically blocked
- risk_level: high
- reason: explains that the described research pattern is not acceptable

## 5. Risk semantics

Uses the same ok_to_ship / needs_review / blocked → low/medium/high
mapping as the rest of the platform.

## 6. Explanation style

Explanations:

- Reference research context and controlled substances oversight
- Explain, in analyst-style language, why the decision was taken

Example:

> “Based on the described research protocol and controlled substances
> handling approach, AutoComply AI considers this submission
> {{status_phrase}}.”

## 7. How to demo

1. Open Compliance Console → CSF sandboxes → Researcher.
2. Select presets for complete, missing info, and problematic plans.
3. Evaluate and review Case Summary, Recent Decisions, and optionally
   Research-related snippets in the Explorer.

## 8. Badge hint

UI badge text: `Researcher CSF vertical`.
