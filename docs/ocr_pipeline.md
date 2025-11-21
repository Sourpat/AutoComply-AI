# OCR Pipeline Design (Stub → Real)

This document describes how the PDF → license extraction pipeline is
structured in AutoComply AI, and how it will evolve from the current
stub to a real OCR + vision implementation.

---

## 1. Current Shape

The OCR layer lives under `src/ocr/`:

- `preprocess.py`
  - `PdfPage` dataclass
  - `preprocess_pdf(pdf_bytes, max_pages=None)`

- `extract.py`
  - `BaseOcrPipeline`
  - `StubOcrPipeline`
  - `extract_license_fields_from_pdf(pdf_bytes)`

The current pipeline is:

1. `extract_license_fields_from_pdf(pdf_bytes)`
2. → `preprocess_pdf(...)` → `[PdfPage]`
3. → `StubOcrPipeline().extract_from_pages(pages)`
4. → dict with:
   - `license_id`
   - `state`
   - `expiry`
   - `practitioner_name`

This is intentionally simple but fully test-covered.

---

## 2. Future Integration Plan

When moving to a real OCR + vision stack, the changes should be local
to the OCR module:

1. **Real preprocessing**
   - Use `pdf2image` (or similar) inside `preprocess_pdf` to turn PDF
     pages into images.
   - Optionally obey `max_pages` for performance.
   - Extend `PdfPage` to include:
     - Image object / bytes
     - DPI, size, etc.

2. **Real OCR pipeline(s)**
   - Implement one or more subclasses of `BaseOcrPipeline`, e.g.:
     - `TesseractOcrPipeline`
     - `GeminiVisionOcrPipeline`
   - Each subclass implements `extract_from_pages(pages: List[PdfPage])`
     and returns the same dict shape:
       - `license_id`, `state`, `expiry`, `practitioner_name`, etc.

3. **Selection strategy**
   - `extract_license_fields_from_pdf` becomes the orchestration point:
     - Select pipeline based on config or environment.
     - Fallback to a safe stub if the chosen provider fails.

Throughout this evolution:

- The public function `extract_license_fields_from_pdf` remains stable.
- The PDF validation endpoint does not need to change.
- Tests for:
  - endpoint behavior
  - pipeline interface
  - extraction structure
  continue to protect the contract.

---

## 3. Sample Inputs

For local experimentation, you can use any controlled-substance license
PDF, or synthetic PDFs, as inputs to the OCR pipeline.

In a real deployment, this OCR layer would be fed by:

- n8n email intake workflows (renewal emails, scanned forms).
- Frontend drag-and-drop upload.
- Batch back-office ingestion jobs.

The key design choice is that all of these flows converge on the same
function:

```python
from src.ocr.extract import extract_license_fields_from_pdf


which makes the pipeline easy to reason about and evolve.


---

## 🧩 Codex Command 5 – Link OCR docs from `architecture.md`

> **Command for Codex:**  
> Open `docs/architecture.md` and append:

```md
## OCR Pipeline

The PDF → license extraction flow is structured under `src/ocr/`:

- `preprocess_pdf` turns raw PDF bytes into `PdfPage` objects.
- `StubOcrPipeline` implements a simple, deterministic extractor.
- `extract_license_fields_from_pdf` is the stable public entrypoint
  used by the `/api/v1/license/validate-pdf` endpoint.

For details and the future evolution toward real OCR and vision
providers, see:

- [`docs/ocr_pipeline.md`](ocr_pipeline.md)
