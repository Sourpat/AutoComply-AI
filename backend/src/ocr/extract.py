from __future__ import annotations

from typing import Any, Dict, List

from src.ocr.preprocess import PdfPage, preprocess_pdf


class BaseOcrPipeline:
    """
    Abstract-ish base class for OCR pipelines.

    In a future version, different implementations (e.g. Tesseract,
    Gemini, GPT-4o vision) can implement `extract_from_pages` while
    the external API remains stable.
    """

    def extract_from_pages(self, pages: List[PdfPage]) -> Dict[str, Any]:
        """
        Extract structured license fields from pre-processed PDF pages.

        Args:
            pages: List of pre-processed PdfPage objects.

        Returns:
            Dict with structured license-like fields.
        """
        raise NotImplementedError


class StubOcrPipeline(BaseOcrPipeline):
    """
    Current stub implementation.

    It does NOT perform real OCR. Instead, it returns a deterministic
    payload that the rest of the system (decision engine, tests, and
    frontend) can rely on while we design the real pipeline.
    """

    def extract_from_pages(self, pages: List[PdfPage]) -> Dict[str, Any]:
        if not pages:
            return {}

        # Stub output – kept in sync with tests and demo responses
        return {
            "license_id": "DUMMY-PDF-LICENSE",
            "state": "CA",
            "expiry": "2029-01-01",
            "practitioner_name": "Dummy Practitioner",
        }


def extract_license_fields_from_pdf(pdf_bytes: bytes) -> Dict[str, Any]:
    """
    Public API used by the PDF validation endpoint.

    Pipeline:
      1. Pre-process PDF bytes into pages (preprocess_pdf).
      2. Run OCR pipeline over pages (currently StubOcrPipeline).
      3. Return a dict with license-like fields.

    This function's signature and basic output shape are intentionally
    stable so:
      - tests stay green
      - the endpoint contract does not change
      - we can swap in a real OCR engine later.
    """
    if not pdf_bytes:
        return {}

    pages = preprocess_pdf(pdf_bytes, max_pages=None)
    pipeline = StubOcrPipeline()
    return pipeline.extract_from_pages(pages)

def extract_text_from_pdf(pdf_bytes: bytes) -> str:
    """
    Convenience helper used by the API layer.

    For now this is a lightweight stub:
    - It accepts raw PDF bytes.
    - It returns a best-effort text representation so the UI can show
      an extracted `text_preview`.
    - It is intentionally forgiving and does NOT perform real PDF parsing.

    If a richer OCR pipeline is introduced (e.g. pdf2image + vision model),
    this function can delegate to that implementation while keeping the
    API import stable: `from src.ocr.extract import extract_text_from_pdf`.
    """
    if not pdf_bytes:
        return ""

    # Best-effort decoding – good enough for tests and demo previews.
    try:
        return pdf_bytes.decode("utf-8", errors="ignore")
    except Exception:
        # Fallback to latin-1 to avoid hard failures on odd byte sequences.
        return pdf_bytes.decode("latin-1", errors="ignore")
