# Architecture Overview

This document will describe how the API, compliance engine, OCR, and RAG modules interact once implemented.

## Derived Controlled Substance / License Flow

For a business-level view of how AutoComply AI maps back to the original
Henry Schein controlled substance and license management work, see:

- [`docs/controlled_substance_flow_derived.md`](controlled_substance_flow_derived.md)

This document explains the original checkout + license flows and how
they are reimplemented using:

- JSON + PDF validation endpoints
- The expiry evaluation helper and decision engine
- n8n-based automation for email intake, Slack alerts, and reminders
