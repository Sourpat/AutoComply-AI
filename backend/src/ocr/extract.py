import base64
from fastapi import UploadFile, HTTPException

from src.config import get_settings
from src.api.models.compliance_models import OCRExtractedData, DEALicense, StateLicense
from src.ocr.preprocess import pdf_to_images, image_to_bytes

import httpx


async def extract_license_data_from_pdf(file: UploadFile) -> OCRExtractedData:
    """
    Extracts DEA + State license info from an uploaded PDF.
    Uses:
      - Preprocessing (PDF → images)
      - Gemini multimodal OCR
      - Deterministic field extraction for downstream compliance engine

    Returns OCRExtractedData, which the decision engine converts to payload.
    """

    settings = get_settings()

    if not settings.GEMINI_API_KEY:
        raise HTTPException(
            status_code=500,
            detail="Gemini API key not configured."
        )

    # -------------------------
    # Read PDF bytes
    # -------------------------
    pdf_bytes = await file.read()

    # -------------------------
    # Convert to high-res images
    # -------------------------
    images = pdf_to_images(pdf_bytes)

    if not images:
        raise HTTPException(
            status_code=400,
            detail="No OCR-processable pages found in PDF."
        )

    # Gemini expects base64 PNG images
    pages_b64 = [
        base64.b64encode(image_to_bytes(img)).decode("utf-8")
        for img in images
    ]

    # -------------------------
    # Build Gemini multimodal prompt
    # -------------------------
    prompt = """
You are a strict, deterministic OCR parser for DEA and State medical licenses.

Extract ONLY these fields in JSON:
{
  "dea_license": {
      "dea_number": "",
      "expiry_date": "YYYY-MM-DD",
      "schedule": [],
      "issue_date": "",
      "status": ""
  },
  "state_license": {
      "state": "",
      "permit_number": "",
      "expiry_date": "YYYY-MM-DD",
      "status": ""
  },
  "practitioner_name": "",
  "practice_type": "",
  "raw_text": ""
}

Rules:
- Return valid JSON only.
- Never infer missing values — return empty strings.
- Dates MUST be normalized to YYYY-MM-DD.
- Schedule must be a list of strings (e.g., ["2", "2N", "3N"]).
"""

    # -------------------------
    # Gemini API Call
    # -------------------------
    url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-pro-vision:generateContent"
    headers = {"Content-Type": "application/json"}
    params = {"key": settings.GEMINI_API_KEY}

    payload = {
        "contents": [
            {
                "parts": [
                    {"text": prompt},
                    *[
                        {"inline_data": {"mime_type": "image/png", "data": img_b64}}
                        for img_b64 in pages_b64
                    ]
                ]
            }
        ]
    }

    async with httpx.AsyncClient(timeout=60) as client:
        response = await client.post(url, headers=headers, params=params, json=payload)

    if response.status_code != 200:
        raise HTTPException(
            status_code=500,
            detail=f"OCR request failed: {response.text}"
        )

    data = response.json()
    try:
        raw_json = data["candidates"][0]["content"]["parts"][0]["text"]
    except Exception:
        raise HTTPException(
            status_code=500,
            detail="Gemini response format error."
        )

    # -------------------------
    # Parse extracted JSON safely
    # -------------------------
    import json
    try:
        obj = json.loads(raw_json)
    except json.JSONDecodeError:
        raise HTTPException(
            status_code=500,
            detail="OCR output was not valid JSON."
        )

    # -------------------------
    # Normalize into OCRExtractedData
    # -------------------------
    dea_obj = obj.get("dea_license", {})
    state_obj = obj.get("state_license", {})

    dea = DEALicense(
        dea_number=dea_obj.get("dea_number", ""),
        expiry_date=dea_obj.get("expiry_date", ""),
        schedule=dea_obj.get("schedule", []),
        issue_date=dea_obj.get("issue_date", ""),
        status=dea_obj.get("status", "")
    )

    state = StateLicense(
        state=state_obj.get("state", ""),
        permit_number=state_obj.get("permit_number", ""),
        expiry_date=state_obj.get("expiry_date", ""),
        status=state_obj.get("status", "")
    )

    return OCRExtractedData(
        dea_license=dea,
        state_license=state,
        practitioner_name=obj.get("practitioner_name", ""),
        practice_type=obj.get("practice_type", ""),
        raw_text=obj.get("raw_text", "")
    )
