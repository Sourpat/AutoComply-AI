"""Utilities for loading the in-memory regulatory “documents” used by RAG.

For this demo, we keep the corpus intentionally small and static so that:

- Tests are deterministic.
- The entire RAG pipeline can run without any external database.

Typical responsibilities:
- Define a handful of canonical snippets for:
    - state-level licensing rules (e.g., CA / NY)
    - DEA / federal context
    - use-case / scenario explanations for different purchase intents.
- Expose a simple function (e.g., `load_regulation_docs()`) that returns a list
  of small dictionaries with fields like: `jurisdiction`, `source`, `text`.

If you later want to plug in a real vector store (e.g., via LangChain),
this module becomes the place where you hydrate that store or fetch the corpus
from a database, without changing the API/route layer.

RAG DEPENDENCY: This module requires langchain_text_splitters which is excluded
from production builds. Import langchain only when needed (lazy import).
"""

import os
from pathlib import Path
from typing import List, TYPE_CHECKING

from src.config import get_settings

if TYPE_CHECKING:
    from langchain_text_splitters import RecursiveCharacterTextSplitter


class DocumentLoader:
    """
    Loads and chunks regulatory PDFs / text files into clean,
    deterministic blocks for embedding and retrieval.
    Future-proof for LangChain / LangGraph ingestion pipelines.
    
    Raises ImportError if RAG is disabled or langchain not installed.
    """

    def __init__(self, docs_path: str = "backend/resources/regulations"):
        settings = get_settings()
        if not settings.rag_enabled:
            raise ImportError(
                "RAG features are disabled. Set RAG_ENABLED=true and install "
                "langchain libraries to use document loading functionality."
            )
        
        self.docs_path = Path(docs_path)
        
        try:
            from langchain_text_splitters import RecursiveCharacterTextSplitter
            self.text_splitter = RecursiveCharacterTextSplitter(
                chunk_size=1200,
                chunk_overlap=150
            )
        except ImportError as e:
            raise ImportError(
                "langchain_text_splitters not installed. Install with: pip install langchain-text-splitters"
            ) from e

    def load_all_text_files(self) -> List[str]:
        """
        Reads all .txt files inside the resources folder.
        PDFs should be preconverted to text using a preprocessing pipeline.
        """
        if not self.docs_path.exists():
            return []

        texts = []
        for f in self.docs_path.glob("*.txt"):
            try:
                content = f.read_text(encoding="utf-8")
                texts.append(content)
            except Exception:
                continue
        return texts

    def chunk_documents(self) -> List[str]:
        """Return the base set of regulatory document chunks for the RAG pipeline.

        The return value is a list of clean text snippets derived from local
        resource files. Tests treat these chunks as a stable fixture, so prefer
        additive updates (new files or additional content) over removing or
        renaming existing inputs when extending the corpus.
        """
        raw_docs = self.load_all_text_files()
        final_chunks = []

        for doc in raw_docs:
            chunks = self.text_splitter.split_text(doc)
            final_chunks.extend(chunks)

        return final_chunks
