"""Simple embedding stub for the RAG subsystem."""


def embed(text: str) -> list[float]:
    """Return a deterministic vector for early testing."""

    return [float(len(text))]
