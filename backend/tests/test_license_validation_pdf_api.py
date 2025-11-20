from fastapi.testclient import TestClient

from src.api.main import app

client = TestClient(app)


def test_validate_license_pdf_stub_endpoint():
    """
    Ensure the PDF validation endpoint exists and returns
    a structured response for a dummy PDF upload.
    """

    # Minimal fake PDF content – we don't actually parse it yet
    fake_pdf_bytes = b"%PDF-1.4\n%Fake PDF for testing"

    files = {
        "file": ("dummy.pdf", fake_pdf_bytes, "application/pdf"),
    }

    response = client.post("/api/v1/license/validate-pdf", files=files)

    assert response.status_code == 200

    data = response.json()
    assert isinstance(data, dict)
    assert "success" in data
    assert "verdict" in data

    verdict = data["verdict"]
    assert isinstance(verdict, dict)
    # Using the stub contract we just defined
    assert "allow_checkout" in verdict
    assert "reason" in verdict
