from __future__ import annotations

from dataclasses import dataclass
from typing import List, Optional


@dataclass
class PdfPage:
    """
    Represents a single pre-processed page of a PDF.

    In a real implementation, this would typically hold:
      - a PIL.Image object or raw image bytes
      - page number
      - resolution metadata

    For now, this is a light abstraction so the OCR pipeline has a clear
    seam where pdf2image or another converter can plug in later.
    """

    page_number: int
    raw_bytes: bytes


def preprocess_pdf(
    pdf_bytes: bytes,
    max_pages: Optional[int] = None,
) -> List[PdfPage]:
    """
    Pre-process a PDF into a sequence of pages ready for OCR.

    Current behavior (stub):
      - If pdf_bytes is empty, return an empty list.
      - Otherwise, return a single PdfPage placeholder containing the
        original bytes as `raw_bytes` and page_number=1.

    Future behavior:
      - Use pdf2image (or another library) to convert PDF pages
        to images.
      - Optionally limit to `max_pages` for performance reasons.

    Args:
        pdf_bytes: Raw PDF bytes from an upload or file.
        max_pages: Optional page limit for OCR.

    Returns:
        List of PdfPage objects.
    """
    if not pdf_bytes:
        return []

    # Stub: treat the entire PDF as a single "page"
    first_page = PdfPage(page_number=1, raw_bytes=pdf_bytes)
    return [first_page]
