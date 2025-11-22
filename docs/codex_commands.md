# Codex Command: `explain_csf_practitioner_decision`

This command lets Codex narrate why the Practitioner Controlled Substance Form (CSF) engine approved, blocked, or flagged a submission for manual review.

## Triggers
- Click **Ask Codex to explain decision** in the Practitioner CSF sandbox
- User messages like `explain_csf_practitioner_decision`, "explain this Practitioner CSF decision", or "why is this practitioner CSF blocked?"

## Expected payload
Codex listens for the UI console log:

```json
{
  "form": PractitionerCsfFormData,
  "decision": PractitionerCsfDecision,
  "source_document": "/mnt/data/Online Controlled Substance Form - Practitioner Form with addendums.pdf"
}
```

Example:

```json
{
  "form": {
    "facilityName": "Test Dental Practice",
    "facilityType": "dental_practice",
    "accountNumber": "ACC-123",
    "practitionerName": "Dr. Test",
    "stateLicenseNumber": "ST-12345",
    "deaNumber": "DEA-1234567",
    "shipToState": "OH",
    "attestationAccepted": true,
    "internalNotes": ""
  },
  "decision": {
    "status": "ok_to_ship",
    "reason": "All required practitioner, facility, and licensing details are present and the attestation has been accepted. Practitioner CSF is approved to proceed.",
    "missing_fields": []
  },
  "source_document": "/mnt/data/Online Controlled Substance Form - Practitioner Form with addendums.pdf"
}
```

## Explanation outline Codex should follow
1. **Decision summary**
   - `ok_to_ship` → order is allowed to proceed.
   - `blocked` → order cannot proceed until required items are fixed.
   - `manual_review` → human review needed.
2. **Form snapshot**
   - Facility name + type + ship-to state.
   - Practitioner name + state license + DEA number.
   - Whether the attestation was accepted.
3. **Call out missing fields**
   - If `missing_fields` is non-empty, list them and note they must be completed before approval.
4. **Link back to Practitioner CSF expectations**
   - Identity for facility + practitioner, licensing (state + DEA), ship-to state, and acceptance of the attestation clause.
   - If `source_document` is provided, note that these requirements come from the Practitioner CSF PDF (no need to quote long legal text).
5. **Output style**
   - Concise Markdown like:

```md
**Decision:** ok_to_ship

1. **Core details**
   - Facility: Test Dental Practice (dental_practice), ship-to state OH.
   - Practitioner: Dr. Test with state license ST-12345 and DEA DEA-1234567.

2. **Attestation**
   - The practitioner accepted the controlled substances attestation clause.

3. **Engine rules applied**
   - For Practitioner CSFs, the engine requires:
     - Facility and practitioner identity,
     - State license and DEA number,
     - Ship-to state,
     - Accepted attestation clause.

4. **Result**
   - Because all required fields are present and the attestation is accepted, the CSF is considered complete and approved to proceed.
```
