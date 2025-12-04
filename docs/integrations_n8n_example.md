# Integrating AutoComply AI with n8n (example flow)

This document describes a simple way to orchestrate AutoComply AI from an
automation tool like **n8n**. The same ideas apply to Zapier, Make.com, or
internal workflow engines.

The goal is to:

1. Evaluate a Hospital CSF.
2. Evaluate an Ohio TDDD license.
3. Combine both into a mock Ohio hospital order decision.
4. Trigger notifications or manual review based on the final outcome.

---

## 1. Prerequisites

- AutoComply AI backend is running and reachable from n8n  
  (for example, `https://your-autocomply-backend.example.com`).  
- You are comfortable creating a basic n8n workflow with HTTP Request nodes.

---

## 2. High-level workflow

In n8n, the workflow might look like:

1. **Trigger node**  
   - Manual trigger, webhook, or a schedule (e.g., "check CSF + license every time a new order is created").

2. **HTTP Request – Hospital CSF evaluation**  
   - Method: `POST`  
   - URL: `/csf/hospital/evaluate`  
   - Body: JSON mapped from your order context:
     - `hospital_name`, `account_number`, `dea_number`, `ship_to_state`, etc.

3. **HTTP Request – Ohio TDDD license evaluation**  
   - Method: `POST`  
   - URL: `/license/ohio-tddd/evaluate`  
   - Body: license fields:
     - `license_number`, `dea_number`, `facility_name`, `ship_to_state`, `internal_notes`.

4. **HTTP Request – Ohio hospital mock order**  
   - Method: `GET` (or `POST` if your endpoint accepts body context)  
   - URL: `/orders/mock/ohio-hospital-approval`  
   - This endpoint represents how the platform would combine CSF + license
     decisions into a final order decision.

5. **Router / IF node – act on final decision**  
   - Branch on `decision.status` (e.g., `ok_to_ship`, `needs_review`, `blocked`).  
   - Send email / Slack / Teams notification, create a ticket, or push back into your core ordering system.

---

## 3. Example n8n node configuration (conceptual)

> These are conceptual examples – adjust field names and URLs to your actual
> deployment.

### 3.1 Hospital CSF evaluate (HTTP node)

- **Method**: `POST`  
- **URL**: `https://your-autocomply-backend.example.com/csf/hospital/evaluate`  
- **Body (JSON)**:

```json
{
  "hospital_name": "SummitCare Hospitals – Columbus",
  "account_number": "ACCT-12345",
  "dea_number": "FS1234567",
  "ship_to_state": "OH",
  "attestation_accepted": true,
  "internal_notes": "AutoComply AI demo via n8n"
}
```

Expected response (shape):

- `status`: `"ok_to_ship" | "needs_review" | "blocked"`
- `reason`: Human-readable explanation
- Optional regulatory metadata used by the console for Regulatory Insights.

### 3.2 Ohio TDDD license evaluate (HTTP node)

- **Method**: `POST`  
- **URL**: `https://your-autocomply-backend.example.com/license/ohio-tddd/evaluate`  
- **Body (JSON)**:

```json
{
  "license_number": "02-345678",
  "dea_number": "BS1234567",
  "facility_name": "SummitCare Clinics – Columbus",
  "ship_to_state": "OH",
  "internal_notes": "Clean Ohio TDDD license, no flags on file."
}
```

Expected response (shape):

- `status`: `"ok_to_ship" | "needs_review" | "blocked"`
- `reason`: Explanation of the license decision
- Optional regulatory metadata (used by RegulatoryInsightsPanel).

### 3.3 Mock order evaluation (HTTP node)

- **Method**: `GET`  
- **URL**: `https://your-autocomply-backend.example.com/orders/mock/ohio-hospital-approval`

Expected response (shape):

```json
{
  "decision": {
    "status": "ok_to_ship",
    "reason": "Order approved based on hospital CSF and Ohio TDDD license decisions."
  },
  "developer_trace": {
    "...": "Optional, used by the Compliance Console in AI / RAG debug mode"
  }
}
```

---

## 4. Branching on the final decision

In n8n, after the mock order HTTP node:

Add an IF node (or Switch/Router) that checks `decision.status`.

Example branches:

- `ok_to_ship` → Automatically mark the order as approved in your core system.
- `needs_review` → Send a Slack/Teams message to a compliance channel.
- `blocked` → Send an email to a risk queue or create a ticket.

This mirrors the end-to-end flow demonstrated in the Compliance Console, but
wired into your own workflow engine.

---

## 5. Using the Compliance Console as a design surface

The Compliance Console UI is intentionally aligned with these APIs:

- Whatever you can do via the console forms, you can do via HTTP from n8n.
- The Copy-as-cURL patterns and Regulatory Insights panels make it easy
  to design requests in the browser and then reproduce them in an automation
  tool.
- AI / RAG debug mode shows the raw payloads and traces that can help debug
  unexpected behavior in complex workflows.
