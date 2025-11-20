from __future__ import annotations

from typing import Any, Dict


def extract_license_fields_from_pdf(pdf_bytes: bytes) -> Dict[str, Any]:
    """
    Placeholder OCR / extraction helper.

    In a future version, this function will:
      - Convert the PDF to images (pdf2image)
      - Run OCR or a vision model (Gemini / GPT-4o)
      - Parse out fields like license number, state, expiry, and practitioner

    For now, it returns a deterministic, structured payload so that
    the rest of the pipeline (decision engine, n8n, frontend) can be
    developed and tested without real OCR.

    Args:
        pdf_bytes: Raw PDF file content.

    Returns:
        Dict with basic license-like fields.
    """
    if not pdf_bytes:
        return {}

    # TODO: replace this stub with real OCR + parsing logic.
    return {
        "license_id": "DUMMY-PDF-LICENSE",
        "state": "CA",
        "expiry": "2029-01-01",
        "practitioner_name": "Dummy Practitioner",
    }
