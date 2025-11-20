from src.ocr.extract import extract_license_fields_from_pdf


def test_extract_license_fields_from_pdf_stub():
    """
    Ensure the OCR helper returns a structured, non-empty dict
    for non-empty PDF bytes. This locks in the stub shape so we
    can safely swap the internals later.
    """

    fake_pdf_bytes = b"%PDF-1.4\n%Fake PDF for testing"

    extracted = extract_license_fields_from_pdf(fake_pdf_bytes)

    assert isinstance(extracted, dict)
    assert extracted  # not empty
    assert "license_id" in extracted
    assert "state" in extracted
    assert "expiry" in extracted
