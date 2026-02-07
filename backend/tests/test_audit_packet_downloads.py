import io
import json
import zipfile

from fastapi.testclient import TestClient

from src.api.main import app

client = TestClient(app)


def test_packet_pdf_and_zip() -> None:
    client.post("/api/ops/seed-verifier-cases")

    pdf_resp = client.get("/api/verifier/cases/case-001/packet.pdf?include_explain=0")
    assert pdf_resp.status_code == 200
    assert pdf_resp.headers["content-type"].startswith("application/pdf")
    assert pdf_resp.content.startswith(b"%PDF")

    zip_resp = client.get("/api/verifier/cases/case-001/audit.zip?include_explain=0")
    assert zip_resp.status_code == 200
    assert zip_resp.headers["content-type"].startswith("application/zip")

    buffer = io.BytesIO(zip_resp.content)
    with zipfile.ZipFile(buffer) as archive:
        names = set(archive.namelist())
        assert "decision_packet.json" in names
        assert "manifest.json" in names

        packet_data = json.loads(archive.read("decision_packet.json").decode("utf-8"))
        assert packet_data["packet_version"] == "dp-v1"


def test_packet_zip_with_explain() -> None:
    client.post("/api/ops/seed-verifier-cases")

    zip_resp = client.get("/api/verifier/cases/case-002/audit.zip?include_explain=1")
    assert zip_resp.status_code == 200
    buffer = io.BytesIO(zip_resp.content)
    with zipfile.ZipFile(buffer) as archive:
        packet_data = json.loads(archive.read("decision_packet.json").decode("utf-8"))
        assert packet_data["explain"] is not None
        assert packet_data["explain"]["knowledge_version"]
