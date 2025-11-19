import io
from pdf2image import convert_from_bytes


def pdf_to_images(file_bytes: bytes):
    """
    Convert PDF to high-resolution images for OCR.
    Ensures deterministic preprocessing for Gemini and later LangChain pipelines.
    """
    try:
        images = convert_from_bytes(file_bytes, dpi=300)
        return images
    except Exception as e:
        raise RuntimeError(f"PDF preprocessing failed: {str(e)}")


def image_to_bytes(image):
    """
    Convert a PIL image to raw PNG bytes.
    Gemini expects clean, lossless image bytes.
    """
    img_bytes = io.BytesIO()
    image.save(img_bytes, format="PNG")
    return img_bytes.getvalue()
