# Codex command spec for CSF + Ohio TDDD flows

This page documents the command envelope that the UI logs for all Controlled Substance Form (CSF) and Ohio TDDD flows so a Codex agent can respond consistently. Every log uses the same shape, with variations per flow described below.

## 1. Shared conventions

All flows emit a console log in the format:

```js
console.log("CODEX_COMMAND: <command_name>", {
  form,                    // normalized form payload the UI sent to the API
  decision,                // full decision JSON from backend
  explanation,             // optional text from /csf/explain or /ohio-tddd/explain
  controlled_substances,   // (CSF only) items attached to the form
  source_document,         // local file path under /mnt/data/...
});
```

### Source documents

* `source_document` always points to the file Codex should open for grounding: a PDF or HTML path under `/mnt/data/...`.
* The tool layer converts that path to a real URL before Codex opens it.
* Examples:
  * `/mnt/data/Online Controlled Substance Form - Practitioner Form with addendums.pdf`
  * `/mnt/data/FLORIDA TEST.pdf`
  * `/mnt/data/Ohio TDDD.html`

### What Codex can do with the payload

* Use `decision.regulatory_references` to fetch coverage artifacts.
* Use `source_document` to open the actual PDF/HTML and ground explanations or snippets.
* Optionally re-call `/csf/explain` or `/ohio-tddd/explain` if a fresh explanation is needed.

## 2. CSF – Practitioner

**Command name:** `explain_csf_practitioner_decision`

**Example log:**

```js
console.log("CODEX_COMMAND: explain_csf_practitioner_decision", {
  form: {
    facility_name: "...",
    facility_type: "dental_practice",
    account_number: "ACC-123",
    practitioner_name: "Dr Example",
    state_license_number: "ST-12345",
    dea_number: "DEA-1234567",
    ship_to_state: "FL",
    attestation_accepted: true,
    // etc...
  },
  decision: {
    status: "manual_review",
    reason:
      "CSF includes high-risk Schedule II controlled substances for ship-to state FL...",
    missing_fields: [],
    regulatory_references: [
      "csf_practitioner_form",
      "csf_fl_addendum",
    ],
  },
  controlled_substances: [
    {
      id: "cs-oxy-5mg-tab",
      name: "Oxycodone 5 mg tablet",
      ndc: "12345-6789-01",
      strength: "5 mg",
      dea_schedule: "II",
      // ...
    },
  ],
  source_document:
    "/mnt/data/Online Controlled Substance Form - Practitioner Form with addendums.pdf",
});
```

**Guidance:**

* Look at `regulatory_references` to pull artifacts such as `csf_practitioner_form` and `csf_fl_addendum`.
* `csf_fl_addendum` maps to the Florida PDF (`/mnt/data/FLORIDA TEST.pdf`).
* `source_document` is the base form PDF.

## 3. CSF – Hospital

**Command name:** `explain_csf_hospital_decision`

```js
console.log("CODEX_COMMAND: explain_csf_hospital_decision", {
  form: {
    facility_name: "Example Hospital",
    pharmacy_license_number: "RX-1234",
    dea_number: "DEA-9876543",
    pharmacist_in_charge_name: "Jane RPh",
    ship_to_state: "OH",
    attestation_accepted: true,
    // ...
  },
  decision: {
    status: "ok_to_ship",
    reason: "All required facility, pharmacy license, DEA, jurisdiction...",
    missing_fields: [],
    regulatory_references: ["csf_hospital_form"],
  },
  controlled_substances: [], // or list if present
  source_document:
    "/mnt/data/Online Controlled Substance Form - Hospital Pharmacy.pdf",
});
```

* If the ship-to state is Florida with Schedule II items, expect `regulatory_references: ["csf_hospital_form", "csf_fl_addendum"]`.

## 4. CSF – Researcher

**Command name:** `explain_csf_researcher_decision`

```js
console.log("CODEX_COMMAND: explain_csf_researcher_decision", {
  form: {
    institution_name: "Example University",
    principal_investigator_name: "Dr PI",
    protocol_or_study_id: "STUDY-001",
    ship_to_state: "FL",
    attestation_accepted: true,
    // ...
  },
  decision: {
    status: "manual_review",
    reason:
      "Researcher CSF includes high-risk Schedule II controlled substances for ship-to state FL...",
    missing_fields: [],
    regulatory_references: [
      "csf_researcher_form",
      "csf_fl_addendum",
    ],
  },
  controlled_substances: [/* ... */],
  source_document:
    "/mnt/data/Online Controlled Substance Form - Researcher form.pdf",
});
```

## 5. CSF – Surgery Center

**Command name:** `explain_csf_surgery_center_decision`

```js
console.log("CODEX_COMMAND: explain_csf_surgery_center_decision", {
  form: {
    facility_name: "Example Surgery Center",
    facility_license_number: "SC-12345",
    dea_number: "DEA-5555555",
    medical_director_name: "Dr Surgeon",
    ship_to_state: "OH",
    attestation_accepted: true,
    // ...
  },
  decision: {
    status: "ok_to_ship",
    reason:
      "All required facility, licensing, jurisdiction, and attestation details are present...",
    missing_fields: [],
    regulatory_references: ["csf_surgery_center_form"],
  },
  controlled_substances: [/* ... */],
  source_document:
    "/mnt/data/Online Controlled Substance Form - Surgery Center form.pdf",
});
```

* Florida + Schedule II cases include `regulatory_references: ["csf_surgery_center_form", "csf_fl_addendum"]`.

## 6. CSF – EMS

**Command name:** `explain_csf_ems_decision`

```js
console.log("CODEX_COMMAND: explain_csf_ems_decision", {
  form: {
    service_name: "Example EMS",
    agency_license_number: "EMS-9999",
    medical_director_name: "Dr Rescue",
    ship_to_state: "FL",
    attestation_accepted: true,
    // ...
  },
  decision: {
    status: "manual_review",
    reason:
      "EMS CSF includes high-risk Schedule II controlled substances for ship-to state FL...",
    missing_fields: [],
    regulatory_references: ["csf_ems_form", "csf_fl_addendum"],
  },
  controlled_substances: [/* ... */],
  source_document:
    "/mnt/data/Online Controlled Substance Form - EMS form.pdf",
});
```

## 7. Ohio TDDD

**Command name:** `explain_ohio_tddd_decision`

```js
console.log("CODEX_COMMAND: explain_ohio_tddd_decision", {
  form: {
    business_name: "Example Dental Clinic",
    license_type: "clinic",
    license_number: "TDDD-123456",
    ship_to_state: "OH",
    // any other fields your backend expects...
  },
  decision: {
    status: "approved",
    reason: "Ohio TDDD application meets current registration rules.",
    missing_fields: [],
    regulatory_references: ["ohio_tddd_registration"],
  },
  source_document: "/mnt/data/Ohio TDDD.html",
});
```

* If blocked (e.g., missing business name), `regulatory_references` remains `["ohio_tddd_registration"]` while `status` and `reason` reflect the failure.
