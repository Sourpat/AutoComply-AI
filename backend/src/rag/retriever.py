"""Retriever placeholder for RAG workflows."""


def retrieve_documents(query: str) -> list[str]:
    """Return static documents until vector store wiring is implemented."""

    return [
        f"Matched policy for query: {query}",
    ]
