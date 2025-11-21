# AutoComply AI – Demo Script (3–5 minutes)

This script is designed to help walk through AutoComply AI in an
interview or live demo. Adjust wording to your style.

---

## 1. 60–90 second elevator pitch

> AutoComply AI is a DEA & state license compliance co-pilot I built
> based on my real work on Henry Schein’s global e-commerce platform.
> In production, I owned license management and controlled substances
> flows for the US and key states. Here I’ve taken those same concepts
> and built a clean, AI-ready backend service and frontend UI that:
>
> - Validates licenses via manual entry or PDF upload,
> - Calculates expiry and checkout eligibility,
> - Attaches human-readable regulatory context, and
> - Emits structured events that can feed tools like n8n and Slack.
>
> The idea is: if you’ve got a pharmacy or med-supply e-commerce
> platform, this service can sit behind your checkout and make sure
> only valid, appropriately licensed practitioners can buy controlled
> items.

---

## 2. UI walkthrough (2–3 minutes)

### 2.1 Start on the Home page

1. Open the main AutoComply AI UI.
2. Point out the title and short description (if present).
3. Mention that the layout mirrors how a real compliance analyst or
   back-office user would work: enter license details, optionally
   upload a PDF, and immediately see a decision + context.

You can say:

> “This is the front door into the engine. A practitioner, customer
> service rep, or compliance analyst can either type in license
> details or upload a PDF and get a decision in seconds.”

### 2.2 Manual license entry

1. Fill in the form with realistic values:
   - `practice_type`: e.g. `Standard`
   - `state`: e.g. `CA`
   - `state_permit`: some fake CSR/permit string
   - `state_expiry`: a date in the future
   - `purchase_intent`: e.g. `GeneralMedicalUse`
   - `quantity`: e.g. `10`

2. Explain:

> “This form maps 1:1 to the JSON payload the backend expects. In a
> real platform these values would often be pre-populated from the
> account and ship-to settings. For this project, the form is a clean
> way to drive the API and test different scenarios.”

3. Click **Validate** (or whatever the submit button label is).

4. Show the **ComplianceCard**:

   - Highlight:
     - License ID / State
     - Status: Active / Near expiry / Expired
     - Days to expiry
     - `allow_checkout` decision
     - Short regulatory context snippets

You can say:

> “The core of the decision is simple: can we allow checkout or not,
> and why? The expiry logic is fully deterministic and covered by
> tests, and the regulatory context is there to help humans
> understand what rule is driving the decision.”

### 2.3 Try an expired / near-expiry case

1. Change `state_expiry` to:
   - Yesterday → expired
   - In 7 days → near expiry

2. Re-run validation and show:

   - Checkout blocked vs allowed.
   - Status/expiry bucket switching.
   - Days to expiry going negative or very small.

You can say:

> “These scenarios map directly to the expiry engine that’s covered by
> integration tests. This is the kind of edge case that causes real
> pain in production if it’s not modeled and tested clearly.”

### 2.4 PDF upload flow

1. Move to the **PDF upload** section on the same page.
2. Explain:

> “In real life, compliance teams and practitioners deal with scanned
> licenses and emailed renewal PDFs. This path simulates that: we
> upload a PDF, run it through an OCR pipeline, normalize the fields,
> and then hand the result to the same decision engine used by the
> manual JSON path.”

3. Upload a sample PDF (if you have one handy in your demo setup).

4. Point out that:

   - The response includes:
     - `verdict` (same structure as JSON path).
     - `extracted_fields` from OCR (license ID, state, expiry, name).
   - The UI still renders a single, consistent ComplianceCard.

---

## 3. Backend & tests (1–2 minutes)

### 3.1 API endpoints

Explain:

> “Underneath the UI there are two main FastAPI endpoints:
>
> - `POST /api/v1/licenses/validate/license` for JSON/manual input.
> - `POST /api/v1/licenses/validate-pdf` for PDF/OCR input.
>
> Both return the same core verdict structure so that the frontend and
> any downstream systems don’t have to care about whether the source
> was a form or a PDF.”

Mention:

- `docs/api_reference.md` documents the exact request/response shapes.
- Everything is versioned under `/api/v1/...` for stability.

### 3.2 Decision engine & expiry tests

You can say:

> “The decision engine is split cleanly:
>
> - A function that computes expiry status and days to expiry.
> - A `ComplianceEngine` that turns inputs into allow/deny decisions
>   plus context.
>
> I’ve added integration tests that simulate:
>
> - Expired licenses that must block checkout,
> - Near-expiry licenses that are still allowed but flagged, and
> - Healthy, active licenses that pass normally.”

This shows you care about:

- Edge cases.
- Test coverage around compliance-critical logic.

### 3.3 Events & automation (EventPublisher)

Explain:

> “Every validation call can emit a normalized event through an
> `EventPublisher`. By default it’s in a safe NO-OP mode, but it’s
> wired so that you can connect it to n8n or Slack via webhooks. That
> means you can incrementally add:
>
> - Renewal reminders,
> - Slack alerts for failures,
> - Simple dashboards in Airtable or a database,
>
> without changing the core API or the frontend.”

If they’re interested, mention:

- `docs/roadmap.md` covers how you’d grow this into full n8n-powered
  workflows and LangGraph-style orchestration.

---

## 4. Roadmap & connection to real work (30–60 seconds)

Close with something like:

> “This is intentionally built as a clean, testable baseline. The
> roadmap in the repo outlines how I’d:
>
> - Swap the stub OCR for real Tesseract or LLM vision,
> - Layer a proper RAG pipeline over DEA and state rules,
> - Add attestation flows for telemedicine and specific schedules, and
> - Wire everything into n8n for renewal reminders and Slack alerts.
>
> It’s essentially a GenAI-ready version of the license management and
> controlled substances work I did at Henry Schein—just packaged as a
> standalone, portfolio-friendly service.”

The goal is to show:

- You’ve already shipped something concrete.
- You have a realistic, phased plan to grow it.
- It directly reuses your regulated e-commerce experience.
