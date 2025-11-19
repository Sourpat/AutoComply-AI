import os
from pathlib import Path
from typing import List

from langchain_text_splitters import RecursiveCharacterTextSplitter


class DocumentLoader:
    """
    Loads and chunks regulatory PDFs / text files into clean,
    deterministic blocks for embedding and retrieval.
    Future-proof for LangChain / LangGraph ingestion pipelines.
    """

    def __init__(self, docs_path: str = "backend/resources/regulations"):
        self.docs_path = Path(docs_path)
        self.text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=1200,
            chunk_overlap=150
        )

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
        """
        Returns a list of clean text chunks ready for embeddings.
        """
        raw_docs = self.load_all_text_files()
        final_chunks = []

        for doc in raw_docs:
            chunks = self.text_splitter.split_text(doc)
            final_chunks.extend(chunks)

        return final_chunks
