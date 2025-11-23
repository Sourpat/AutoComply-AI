from __future__ import annotations

import os
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field

from autocomply.domain.compliance_artifacts import (
    COMPLIANCE_ARTIFACTS,
    ComplianceArtifact,
)

# --- Optional LangChain imports (guarded) ---

USE_REAL_RAG = os.getenv("AUTOCOMPLY_ENABLE_RAG", "0") == "1"

try:
    if USE_REAL_RAG:
        from langchain_openai import ChatOpenAI, OpenAIEmbeddings  # type: ignore
        from langchain_community.vectorstores import Chroma  # type: ignore
        from langchain_community.document_loaders import (  # type: ignore
            PyPDFLoader,
            UnstructuredHTMLLoader,
        )
        from langchain.text_splitter import RecursiveCharacterTextSplitter  # type: ignore

        HAVE_LANGCHAIN = True
    else:
        HAVE_LANGCHAIN = False
except ImportError:
    HAVE_LANGCHAIN = False


class RegulatoryRagRequestModel(BaseModel):
    """
    Backend-facing model for a regulatory RAG query.

    - question: natural language question ("Explain why this CSF went to manual review").
    - regulatory_references: artifact IDs (e.g. ["csf_practitioner_form", "csf_fl_addendum"]).
    - decision: optional raw decision JSON (for context).
    """

    question: str = Field(..., min_length=1)
    regulatory_references: List[str] = Field(default_factory=list)
    decision: Optional[Dict[str, Any]] = None


class RegulatoryRagAnswer(BaseModel):
    """
    Response from the RAG pipeline (or stub).
    """

    answer: str
    regulatory_references: List[str] = Field(
        default_factory=list,
        description="Echo of the regulatory_references requested.",
    )
    artifacts_used: List[str] = Field(
        default_factory=list,
        description="IDs of artifacts that were actually loaded / considered.",
    )
    debug: Dict[str, Any] = Field(
        default_factory=dict,
        description="Optional debug info (mode, counts, etc.).",
    )


def _lookup_artifacts(ids: List[str]) -> List[ComplianceArtifact]:
    if not ids:
        return []
    id_set = set(ids)
    return [a for a in COMPLIANCE_ARTIFACTS if a.id in id_set]


def _real_rag_answer(
    payload: RegulatoryRagRequestModel,
    artifacts: List[ComplianceArtifact],
) -> RegulatoryRagAnswer:
    """
    Real RAG implementation using LangChain.
    This will only be used if AUTOCOMPLY_ENABLE_RAG=1 and LangChain is installed.

    NOTE: This is intentionally minimal and can be enriched later.
    """

    if not artifacts:
        return RegulatoryRagAnswer(
            answer=(
                "No matching regulatory artifacts were found for the provided "
                "regulatory_references. RAG could not run."
            ),
            regulatory_references=payload.regulatory_references,
            artifacts_used=[],
            debug={"mode": "rag", "docs_loaded": 0},
        )

    docs = []

    for art in artifacts:
        src = art.source_document
        if not src:
            continue

        # source_document values are local paths under /mnt/data/...
        # Example:
        # - /mnt/data/Online Controlled Substance Form - Practitioner Form with addendums.pdf
        # - /mnt/data/FLORIDA TEST.pdf
        # - /mnt/data/Ohio TDDD.html

        if src.lower().endswith(".pdf"):
            loader = PyPDFLoader(src)
        elif src.lower().endswith(".html"):
            loader = UnstructuredHTMLLoader(src)
        else:
            # Fallback: treat as text-like file
            loader = UnstructuredHTMLLoader(src)

        docs.extend(loader.load())

    if not docs:
        return RegulatoryRagAnswer(
            answer=(
                "RAG pipeline could not load any documents for the provided "
                "regulatory_references."
            ),
            regulatory_references=payload.regulatory_references,
            artifacts_used=[a.id for a in artifacts],
            debug={"mode": "rag", "docs_loaded": 0},
        )

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=1200,
        chunk_overlap=150,
    )
    split_docs = splitter.split_documents(docs)

    embeddings = OpenAIEmbeddings()
    vectordb = Chroma.from_documents(split_docs, embedding=embeddings)
    retriever = vectordb.as_retriever(search_kwargs={"k": 6})

    llm = ChatOpenAI(temperature=0.2)

    # Manual, minimal RAG loop (can be replaced with a chain/graph later)
    retrieved = retriever.invoke(payload.question)
    context_text = "\n\n".join([d.page_content for d in retrieved])

    decision_snippet = ""
    if payload.decision:
        decision_snippet = f"Engine decision JSON:\n{payload.decision}\n"

    prompt = (
        "You are an AI assistant helping explain regulatory compliance decisions.\n"
        "Use the provided regulatory context and the decision JSON (if present)\n"
        "to answer the user's question. Cite specific obligations or language\n"
        "from the documents when helpful.\n\n"
        "=== REGULATORY CONTEXT ===\n"
        f"{context_text}\n\n"
        "=== DECISION CONTEXT ===\n"
        f"{decision_snippet}\n"
        "=== QUESTION ===\n"
        f"{payload.question}\n\n"
        "Answer in clear, concise language, suitable for a compliance analyst.\n"
    )

    resp = llm.invoke(prompt)

    return RegulatoryRagAnswer(
        answer=str(resp.content),
        regulatory_references=payload.regulatory_references,
        artifacts_used=[a.id for a in artifacts],
        debug={
            "mode": "rag",
            "docs_loaded": len(docs),
            "chunks": len(split_docs),
        },
    )


def regulatory_rag_explain(payload: RegulatoryRagRequestModel) -> RegulatoryRagAnswer:
    """
    Entry point used by the FastAPI route.

    - Resolves artifacts by regulatory_references.
    - If LangChain + AUTOCOMPLY_ENABLE_RAG=1, runs real RAG.
    - Otherwise returns a deterministic stub answer that still echoes artifacts.
    """

    artifacts = _lookup_artifacts(payload.regulatory_references)

    if USE_REAL_RAG and HAVE_LANGCHAIN:
        return _real_rag_answer(payload, artifacts)

    # Stubbed answer (safe for CI and environments without LangChain/OpenAI key)
    artifact_labels = ", ".join(
        f"{a.id} ({a.name})" for a in artifacts
    ) or "none"

    # Include question so it's easy to see in logs/tests
    stub_answer = (
        "RAG pipeline is not yet enabled (using stub mode). "
        "In a real environment, this endpoint would retrieve content from "
        f"the following artifacts and answer the question:\n\n"
        f"Artifacts: {artifact_labels}\n\n"
        f"Question: {payload.question}"
    )

    return RegulatoryRagAnswer(
        answer=stub_answer,
        regulatory_references=payload.regulatory_references,
        artifacts_used=[a.id for a in artifacts],
        debug={
            "mode": "stub",
            "have_langchain": HAVE_LANGCHAIN,
            "use_real_rag_flag": USE_REAL_RAG,
        },
    )
