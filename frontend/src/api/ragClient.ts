import type { RagSearchResponse, RagSource } from "../types/rag";

const RAG_SEARCH_ENDPOINT = "/rag/regulatory/search";

function normalizeRagSource(raw: any): RagSource {
  const scoreValue =
    typeof raw?.score === "number"
      ? raw.score
      : typeof raw?.relevance === "number"
        ? raw.relevance
        : typeof raw?.raw_score === "number"
          ? raw.raw_score
          : 0;

  return {
    id: raw?.id ?? raw?.doc_id ?? raw?.source_id ?? undefined,
    label: raw?.label ?? raw?.title ?? raw?.citation ?? raw?.id ?? undefined,
    jurisdiction:
      raw?.jurisdiction_label ??
      raw?.jurisdiction ??
      raw?.source?.jurisdiction ??
      raw?.jurisdiction_code ??
      undefined,
    citation: raw?.citation ?? raw?.code ?? undefined,
    snippet: raw?.snippet ?? raw?.text ?? "",
    score: Math.max(0, Math.min(1, scoreValue ?? 0)),
    raw_score: raw?.raw_score ?? raw?.rawScore ?? undefined,
    url: raw?.url ?? raw?.link ?? undefined,
    source_type: raw?.source_type ?? raw?.type ?? raw?.document_type ?? undefined,
  };
}

function normalizeRagSearchResponse(data: any, fallbackQuery: string): RagSearchResponse {
  const rawSources = Array.isArray(data?.sources)
    ? data.sources
    : Array.isArray(data?.results)
      ? data.results
      : [];

  return {
    query: data?.query ?? fallbackQuery,
    sources: rawSources.map(normalizeRagSource),
  };
}

export async function ragSearch(
  query: string,
  filters?: Record<string, unknown>
): Promise<RagSearchResponse> {
  const res = await fetch(RAG_SEARCH_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, ...(filters ?? {}) }),
  });

  if (!res.ok) {
    throw new Error(`/rag/regulatory/search failed with status ${res.status}`);
  }

  const data = await res.json();
  return normalizeRagSearchResponse(data, query);
}
