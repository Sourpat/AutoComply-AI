# Events & n8n / Workflow Integration

AutoComply AI is designed so that every license decision can emit a **structured event**.

This lets downstream tools like **n8n**, **Slack bots**, or **message buses** subscribe to high-risk situations such as:

- Expired licenses blocking checkout  
- Near-expiry licenses that still allow checkout but need follow-up  
- Specific states / purchase intents that your compliance team cares about  

This document explains the event shape and how an n8n flow could use it.

---

## 1. EventPublisher role

On the backend, the API routes use an `EventPublisher` abstraction (in `src/utils/events.py`) to push non-blocking events whenever a license validation decision is made.

Key points:

- The API **never blocks** on event delivery.
- Tests use a **stubbed implementation** so CI is deterministic.
- In a real deployment, `EventPublisher` could:
  - Call an **n8n webhook**
  - Publish to **Kafka / Redis / SQS**
  - Send **Slack / email alerts**

For now, we treat it as a **clean boundary** for external workflow orchestration.

---

## 2. License validation event payload

When `/api/v1/licenses/validate/license` completes, the route can construct a payload like:

```json
{
  "event": "license_validation",
  "timestamp": "2025-01-01T12:34:56Z",
  "success": true,
  "decision": {
    "allow_checkout": true,
    "status": "near_expiry",
    "state": "CA",
    "license_id": "ABC123",
    "days_to_expiry": 7,
    "is_expired": false
  },
  "attestations": [
    {
      "id": "storage-conditions",
      "jurisdiction": "US-DEA",
      "scenario": "Controlled storage",
      "must_acknowledge": true
    }
  ],
  "regulatory_context": [
    {
      "jurisdiction": "US-CA",
      "source": "Use-case context (demo)",
      "snippet": "This decision considers CA state licensing and ship-to alignment..."
    },
    {
      "jurisdiction": "US-DEA",
      "source": "Use-case context (demo)",
      "snippet": "This decision also considers DEA-level rules for the declared intent..."
    }
  ]
}
```


Notes:

event – simple string to identify event type.

success – did the API execute successfully.

decision – condensed subset of the verdict that downstream tools care about.

attestations – any additional risk flags that were raised.

regulatory_context – human-readable snippets to surface in Slack or email.

You can shrink or expand this payload based on the target system.

3. Example n8n workflow (conceptual)

A minimal n8n flow to consume these events would look like:

Webhook (Trigger)

URL: POST /hook/autocomply-license-events

Receives the JSON event from EventPublisher.

IF / Switch (Filter)

Branch A: decision.status == "expired"

Branch B: decision.status == "near_expiry"

Branch C: other statuses (optional).

Slack / Email node

For expired licenses, send a high-priority alert to a compliance channel:

Title: Checkout blocked – expired license

Body: includes state, license_id, status, and top regulatory_context snippet.

For near-expiry licenses, send a softer reminder:

Title: License near expiry – action recommended

Body: includes days to expiry and direct link to the license screen.

(Optional) Database / Sheet node

Append each event to a Google Sheet or DB table for later analytics:

Columns: timestamp, state, status, allow_checkout, days_to_expiry, jurisdiction list.

This creates a very clear interview story:

“Every time AutoComply AI makes a decision, we emit a JSON event that n8n can pick up. n8n then routes expired decisions to a Slack channel and logs all decisions into a sheet for audit.”

4. Pseudo-code for EventPublisher → n8n

In a real deployment, EventPublisher might look like this (conceptually):

class EventPublisher:
    def __init__(self, webhook_url: str, http_client):
        self.webhook_url = webhook_url
        self.http_client = http_client

    async def publish_license_validation(self, payload: dict) -> None:
        try:
            await self.http_client.post(self.webhook_url, json=payload, timeout=5)
        except Exception:
            # Intentionally swallow errors so the checkout API is never blocked
            # by downstream workflow issues.
            pass


The API would call:

event_payload = {
    "event": "license_validation",
    "timestamp": datetime.utcnow().isoformat() + "Z",
    "success": response["success"],
    "decision": {
        "allow_checkout": verdict.allow_checkout,
        "status": verdict.status,
        "state": verdict.state,
        "license_id": verdict.license_id,
        "days_to_expiry": verdict.days_to_expiry,
        "is_expired": verdict.is_expired,
    },
    "attestations": [...],
    "regulatory_context": [...],
}

asyncio.create_task(publisher.publish_license_validation(event_payload))


The key design choice:
Even if n8n or Slack is down, checkout decisions still go through and the user gets a response.
