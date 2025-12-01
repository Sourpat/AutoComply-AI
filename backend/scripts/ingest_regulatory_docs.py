from __future__ import annotations

"""
Ingests regulatory documents (CSF forms, Ohio TDDD, etc.) into a Chroma vector
store so the RAG pipeline can retrieve real snippets.

Usage (from backend/ directory):

    # Optional: override defaults
    export AUTOCOMPLY_DOCS_DIR=/mnt/data
    export AUTOCOMPLY_RAG_DIR=./data/rag/regulatory_docs
    export OPENAI_API_KEY=sk-...

    python -m scripts.ingest_regulatory_docs
"""

import os
from pathlib import Path
from typing import Dict, List

from dotenv import load_dotenv
from langchain_community.document_loaders import PyPDFLoader, UnstructuredHTMLLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import Chroma
from langchain_openai import OpenAIEmbeddings
from langchain_core.documents import Document

load_dotenv()

DOCS_ROOT = Path(os.getenv("AUTOCOMPLY_DOCS_DIR", "/mnt/data"))
PERSIST_DIR = Path(os.getenv("AUTOCOMPLY_RAG_DIR", "data/rag/regulatory_docs"))

# Each entry describes one physical file we want to ingest.
# NOTE: `url` metadata will use the *local path* (e.g. /mnt/data/Online Controlled...pdf)
# so the hosting layer can transform it into a real URL as instructed.
DOC_SPECS: List[Dict[str, str]] = [
    {
        "filename": "Online Controlled Substance Form - Practitioner Form with addendums.pdf",
        "doc_type": "csf_practitioner",
        "jurisdiction": "US-multi",
        "form_name": "Controlled Substances Form – Practitioner (with addendums)",
    },
    {
        "filename": "Online Controlled Substance Form - Hospital Pharmacy.pdf",
        "doc_type": "csf_hospital",
        "jurisdiction": "US-multi",
        "form_name": "Controlled Substances Form – Hospital Pharmacy",
    },
    {
        "filename": "Online Controlled Substance Form - Surgery Center form.pdf",
        "doc_type": "csf_facility_form",
        "jurisdiction": "US-multi",
        "form_name": "Controlled Substances Form – Surgery Center / Facility",
    },
    {
        "filename": "Online Controlled Substance Form - Surgery Center form.pdf",
        "doc_type": "csf_surgery_center",
        "jurisdiction": "US-multi",
        "form_name": "Controlled Substances Form – Surgery Center",
    },
    {
        "filename": "Online Controlled Substance Form - EMS form.pdf",
        "doc_type": "csf_ems",
        "jurisdiction": "US-multi",
        "form_name": "Controlled Substances Form – EMS",
    },
    {
        "filename": "Online Controlled Substance Form - Researcher form.pdf",
        "doc_type": "csf_researcher",
        "jurisdiction": "US-multi",
        "form_name": "Controlled Substances Form – Researcher",
    },
    {
        "filename": "addendums.pdf",
        "doc_type": "csf_addendums",
        "jurisdiction": "US-multi",
        "form_name": "Controlled Substances – Addendums",
    },
    {
        "filename": "FLORIDA TEST.pdf",
        "doc_type": "state_rules",
        "jurisdiction": "US-FL",
        "form_name": "Florida Controlled Substance / licensing test doc",
    },
    {
        "filename": "Ohio TDDD.html",
        "doc_type": "ohio_tddd",
        "jurisdiction": "US-OH",
        "form_name": "Ohio Terminal Distributor of Dangerous Drugs (TDDD) guidance",
    },
    # You also uploaded your portfolio supplement – not strictly regulatory,
    # but we can index it under a separate doc_type if you want it searchable.
    {
        "filename": "Sourabh Patil – Henry Schein GEP Program Portfolio Supplement.pdf",
        "doc_type": "portfolio_reference",
        "jurisdiction": "internal",
        "form_name": "Sourabh – Henry Schein GEP Program Portfolio Supplement",
    },
]


def load_spec(spec: Dict[str, str]) -> List[Document]:
    path = DOCS_ROOT / spec["filename"]
    if not path.exists():
        print(f"[warn] Skipping missing file: {path}")
        return []

    suffix = path.suffix.lower()
    print(f"[load] {path} ({suffix})")

    if suffix == ".pdf":
        loader = PyPDFLoader(str(path))
    elif suffix in {".html", ".htm"}:
        loader = UnstructuredHTMLLoader(str(path))
    else:
        print(f"[warn] Unsupported extension for {path}, skipping.")
        return []

    docs = loader.load()
    for d in docs:
        # Attach rich metadata to each chunk
        d.metadata.setdefault("source", str(path))
        # IMPORTANT: use the local /mnt/data/... path as `url` –
        # the hosting layer will turn this into a real URL.
        d.metadata.setdefault("url", str(path))
        d.metadata.setdefault("doc_type", spec.get("doc_type"))
        d.metadata.setdefault("jurisdiction", spec.get("jurisdiction"))
        d.metadata.setdefault("form_name", spec.get("form_name"))
    return docs


def main() -> None:
    if not os.getenv("OPENAI_API_KEY"):
        print(
            "[warn] OPENAI_API_KEY is not set. Embedding creation will fail. "
            "Set it before running this script."
        )

    all_docs: List[Document] = []
    for spec in DOC_SPECS:
        docs = load_spec(spec)
        all_docs.extend(docs)

    if not all_docs:
        print("[warn] No documents loaded; nothing to index.")
        return

    print(f"[info] Loaded {len(all_docs)} documents; splitting into chunks...")

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=1200,
        chunk_overlap=150,
        separators=["\n\n", "\n", ". ", " ", ""],
    )
    split_docs = splitter.split_documents(all_docs)
    print(f"[info] Created {len(split_docs)} chunks.")

    PERSIST_DIR.mkdir(parents=True, exist_ok=True)
    print(f"[info] Writing Chroma index to: {PERSIST_DIR}")

    embeddings = OpenAIEmbeddings()  # uses OPENAI_API_KEY from env
    vectorstore = Chroma.from_documents(
        documents=split_docs,
        embedding=embeddings,
        persist_directory=str(PERSIST_DIR),
        collection_name="autocomply_regulatory_docs",
    )
    vectorstore.persist()

    print("[done] Regulatory documents ingested successfully.")
    print(f"[done] Chunks: {len(split_docs)}; persist_directory={PERSIST_DIR}")


if __name__ == "__main__":
    main()
