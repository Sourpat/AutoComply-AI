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

from typing import Dict, Optional
import re
from datetime import datetime


def parse_license_fields_from_text(text: str) -> Dict[str, Optional[str]]:
    """
    Very lightweight heuristic parser for license-like PDFs.

    Tries to extract:
    - state (2-letter US code)
    - state_permit / license_id
    - state_expiry (ISO date string: YYYY-MM-DD)

    This is intended for demo flows and can be safely upgraded later
    with a more advanced OCR + NLP pipeline.
    """
    result: Dict[str, Optional[str]] = {
        "state": None,
        "state_permit": None,
        "license_id": None,
        "state_expiry": None,
    }

    if not text:
        return result

    lines = [line.strip() for line in text.splitlines() if line.strip()]
    upper_text = text.upper()

    # --- State detection -------------------------------------------------
    state_codes = {
        "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
        "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
        "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
        "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
        "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY",
        "DC",
    }

    for pattern in [
        r"STATE OF\s+([A-Z]{2})",
        r"State:\s*([A-Z]{2})",
        r"\b([A-Z]{2})\b\s+BOARD OF PHARMACY",
    ]:
        m = re.search(pattern, upper_text)
        if m:
            code = m.group(1)
            if code in state_codes:
                result["state"] = code
                break

    # --- License / permit ID detection -----------------------------------
    for line in lines:
        upper_line = line.upper()
        if any(key in upper_line for key in ["LICENSE", "LICENCE", "PERMIT", "CSR", "REGISTRATION"]):
            m = re.search(r"([A-Z0-9-]{5,})", upper_line)
            if m:
                value = m.group(1)
                result["license_id"] = value
                if result["state_permit"] is None:
                    result["state_permit"] = value
                break

    # --- Expiry date detection -------------------------------------------
    date_patterns = [
        r"(\d{4}[-/](\d{1,2})[-/](\d{1,2}))",   # YYYY-MM-DD or YYYY/MM/DD
        r"(\d{1,2}[-/](\d{1,2})[-/](\d{2,4}))", # MM/DD/YYYY or MM-DD-YYYY
    ]

    def normalize_date(s: str) -> Optional[str]:
        s = s.strip()
        for fmt in ("%Y-%m-%d", "%Y/%m/%d", "%m/%d/%Y", "%m-%d-%Y", "%m/%d/%y", "%m-%d-%y"):
            try:
                dt = datetime.strptime(s, fmt)
                return dt.date().isoformat()
            except ValueError:
                continue
        return None

    for line in lines:
        upper_line = line.upper()
        if any(key in upper_line for key in ["EXPIRY", "EXPIRES", "EXPIRATION", "VALID THROUGH", "VALID UNTIL"]):
            for pattern in date_patterns:
                m = re.search(pattern, line)
                if m:
                    iso = normalize_date(m.group(1))
                    if iso:
                        result["state_expiry"] = iso
                        break
            if result["state_expiry"]:
                break

    return result
