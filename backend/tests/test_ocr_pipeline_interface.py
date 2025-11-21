from src.ocr.extract import StubOcrPipeline
from src.ocr.preprocess import PdfPage, preprocess_pdf


def test_preprocess_pdf_returns_page_for_nonempty_bytes():
  pdf_bytes = b"%PDF-1.4\n%Fake PDF for testing"
  pages = preprocess_pdf(pdf_bytes)

  assert isinstance(pages, list)
  assert pages
  first = pages[0]
  assert isinstance(first, PdfPage)
  assert first.page_number == 1
  assert isinstance(first.raw_bytes, (bytes, bytearray))


def test_stub_ocr_pipeline_extracts_from_pages():
  pdf_bytes = b"%PDF-1.4\n%Fake PDF for testing"
  pages = preprocess_pdf(pdf_bytes)
  pipeline = StubOcrPipeline()

  result = pipeline.extract_from_pages(pages)

  assert isinstance(result, dict)
  assert result.get("license_id") == "DUMMY-PDF-LICENSE"
  assert result.get("state") == "CA"
  assert "expiry" in result
  assert "practitioner_name" in result
