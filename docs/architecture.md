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

## OCR Pipeline

The PDF → license extraction flow is structured under `src/ocr/`:

- `preprocess_pdf` turns raw PDF bytes into `PdfPage` objects.
- `StubOcrPipeline` implements a simple, deterministic extractor.
- `extract_license_fields_from_pdf` is the stable public entrypoint
  used by the `/api/v1/license/validate-pdf` endpoint.

For details and the future evolution toward real OCR and vision
providers, see:

- [`docs/ocr_pipeline.md`](ocr_pipeline.md)
