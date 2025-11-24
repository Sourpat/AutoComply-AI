from __future__ import annotations

import os
from dataclasses import dataclass
from functools import lru_cache
from typing import Any, Dict, List

from langchain_community.vectorstores import Chroma
from langchain_openai import OpenAIEmbeddings

AUTOCOMPLY_RAG_DIR_ENV = "AUTOCOMPLY_RAG_DIR"
AUTOCOMPLY_RAG_COLLECTION_ENV = "AUTOCOMPLY_RAG_COLLECTION_NAME"

# These must match what your ingest script used
DEFAULT_PERSIST_DIR = "data/rag/regulatory_docs"
DEFAULT_COLLECTION_NAME = "autocomply_regulatory_docs"
DEFAULT_EMBEDDING_MODEL = os.getenv(
    "AUTOCOMPLY_RAG_EMBEDDINGS_MODEL",
    "text-embedding-3-small",
)


@dataclass
class RetrievedRegulatoryChunk:
    """Single chunk of regulatory context coming from the vector store."""

    text: str
    metadata: Dict[str, Any]


@lru_cache(maxsize=1)
def _load_vectorstore() -> Chroma:
    """
    Lazily load the Chroma collection that the ingest script populated.

    This assumes you’ve already run the ingest CLI so that the
    `autocomply_regulatory_docs` collection exists on disk.
    """
    persist_dir = os.getenv(AUTOCOMPLY_RAG_DIR_ENV, DEFAULT_PERSIST_DIR)
    collection_name = os.getenv(AUTOCOMPLY_RAG_COLLECTION_ENV, DEFAULT_COLLECTION_NAME)

    embeddings = OpenAIEmbeddings(model=DEFAULT_EMBEDDING_MODEL)

    return Chroma(
        collection_name=collection_name,
        persist_directory=persist_dir,
        embedding_function=embeddings,
    )


def retrieve_regulatory_chunks(
    query: str,
    k: int = 6,
) -> List[RetrievedRegulatoryChunk]:
    """
    Core “R” in RAG for regulatory docs.

    We keep this very defensive so that if the collection isn’t built
    (e.g., on CI) we just return [] and let the rest of the pipeline
    fall back to existing stub/rules logic.
    """
    try:
        vs = _load_vectorstore()
    except Exception:
        # Vector DB not initialized / embeddings misconfigured etc.
        return []

    try:
        docs = vs.similarity_search(query, k=k)
    except Exception:
        # Don’t let retrieval failures take down the whole API
        return []

    return [
        RetrievedRegulatoryChunk(
            text=doc.page_content,
            metadata=doc.metadata or {},
        )
        for doc in docs
    ]
