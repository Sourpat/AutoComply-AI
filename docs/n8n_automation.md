# AutoComply AI – n8n Automation Layer

This document explains how the AutoComply AI backend, frontend, and n8n
workflows fit together to automate license validation and renewals.

## Overview

The core API (FastAPI) is responsible for:

- OCR + extraction of DEA / state license PDFs
- Running the compliance decision engine (valid / expired / addendum required)
- Returning a structured verdict to the frontend

The n8n layer adds **event-driven automation** on top:

1. **Email intake → License validation**
2. **Slack alerts for compliance events**
3. **30 / 7-day renewal reminders**

All workflows are stored as JSON under `n8n/workflows/`:

- `email_intake.json`
- `slack_alerts.json`
- `renewal_reminders.json`
- (additional flows can be added later)

---

## 1. Email Intake Workflow (`email_intake.json`)

**Trigger**

- `IMAP Email` node polls a dedicated mailbox
  (e.g. `licenses@autocomply.ai`) for messages that look like
  license renewals (subject contains "license renewal", attachment present).

**Core steps**

1. **IMAP Email** – downloads the message and license PDF attachment.
2. **HTTP - Validate PDF** – sends the attachment metadata to the
   backend endpoint (e.g. `POST /api/v1/license/validate-pdf`).
3. **Slack Alert** – posts a short status message to `#license-alerts`
   with license id and verdict.
4. **Airtable Upsert** – writes or updates a row in the **Licenses**
   table (e.g. practitioner, state, expiry, verdict).

This workflow turns a simple renewal mailbox into a fully automated
validation + storage pipeline.

---

## 2. Slack Alerts Webhook (`slack_alerts.json`)

This workflow exposes an n8n **Webhook** that other systems can call.

**Flow**

1. **Incoming Webhook** – listens on
   `/webhook/autocomply/slack-alert` for `POST` requests.
2. **Slack - Post Message** – posts a formatted message to
   `#license-alerts`. The JSON body can contain either:
   - a `text` field to send raw text, or
   - structured fields like `license_id` and `status` which are
     interpolated into a default message.

The backend (or other tools) can use this webhook to publish compliance
events without sending Slack messages directly.

---

## 3. Renewal Reminders (`renewal_reminders.json`)

This workflow runs on a **daily schedule** to send 30-day and 7-day
renewal reminders.

**Flow**

1. **Daily Trigger (Cron)** – fires once per day (e.g. 06:00).
2. **Fetch Licenses from Airtable** – retrieves rows from the
   `Licenses` table where `DaysToExpiry` is 30 or 7.
3. **Send Reminder Email** – sends an email to the configured
   contact (e.g. practice admin or practitioner) reminding them to renew.
4. **Slack Summary** – posts a brief summary to `#license-alerts`
   for observability (which licenses received reminders).

This simulates the "30 / 7 day" reminder logic you originally owned
in the Henry Schein license management feature.

---

## 4. Local Setup with Docker Compose

When you run:

```bash
docker compose up --build
```

Docker Compose builds and starts the backend, frontend, and n8n
containers together so you can test automation end-to-end locally.
