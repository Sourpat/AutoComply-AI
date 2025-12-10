import React from "react";
import { useRagDebug } from "../../devsupport/RagDebugContext";

interface RegulatorySource {
  id: string;
  title?: string;
  snippet?: string;
  jurisdiction?: string | null;
  citation?: string | null;
}

interface SearchResponse {
  query: string;
  results: RegulatorySource[];
}

export const RegulatoryKnowledgeExplorerPanel: React.FC = () => {
  const { enabled: aiDebugEnabled } = useRagDebug();

  const [query, setQuery] = React.useState("");
  const [response, setResponse] = React.useState<SearchResponse | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const q = query.trim();
    if (!q) {
      setError("Enter a question or term related to CSF or licenses.");
      return;
    }

    setLoading(true);
    setError(null);
    setResponse(null);

    try {
      const resp = await fetch("/rag/regulatory/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query: q, limit: 5 }),
      });

      if (!resp.ok) {
        const text = await resp.text();
        setError(`Request failed (${resp.status}): ${text}`);
        return;
      }

      const json = (await resp.json()) as SearchResponse;
      setResponse(json);
    } catch {
      setError("Network error while searching regulatory knowledge.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-zinc-50">
            Regulatory Knowledge Explorer
          </h2>
          <p className="mt-1 text-xs text-zinc-400">
            Search the curated regulatory knowledge used by CSF and license engines.
          </p>
        </div>
      </div>

      <form
        onSubmit={handleSearch}
        className="flex flex-col gap-2 md:flex-row md:items-center"
      >
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="e.g. Ohio TDDD expiry, NY pharmacy rules, hospital CSF attestation"
          className="flex-1 rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-100 placeholder:text-zinc-500"
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50 hover:bg-indigo-500"
        >
          {loading ? "Searching…" : "Search"}
        </button>
      </form>

      {error && (
        <div className="rounded-lg border border-red-800 bg-red-950/40 px-3 py-2 text-[11px] text-red-200">
          {error}
        </div>
      )}

      {response && (
        <div className="space-y-2">
          {response.results.length === 0 ? (
            <p className="text-[11px] text-zinc-500">
              No matching regulatory snippets found for query:{" "}
              <span className="font-mono text-zinc-300">
                {response.query}
              </span>
            </p>
          ) : (
            <>
              <p className="text-[11px] text-zinc-400">
                Showing {response.results.length} result
                {response.results.length > 1 ? "s" : ""} for query:{" "}
                <span className="font-mono text-zinc-300">
                  {response.query}
                </span>
              </p>
              <ul className="space-y-2">
                {response.results.map((src) => (
                  <li
                    key={src.id}
                    className="rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-zinc-100">
                        {src.title || src.id}
                      </span>
                      <span className="text-[10px] font-mono text-zinc-500">
                        {src.id}
                      </span>
                    </div>
                    {src.jurisdiction && (
                      <p className="mt-0.5 text-[10px] text-zinc-500">
                        Jurisdiction: {src.jurisdiction}
                      </p>
                    )}
                    {src.citation && (
                      <p className="mt-0.5 text-[10px] text-zinc-500">
                        Citation: {src.citation}
                      </p>
                    )}
                    {src.snippet && (
                      <p className="mt-1 text-[11px] text-zinc-300">
                        {src.snippet}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      {!error && !response && (
        <p className="text-[11px] text-zinc-500">
          Try searching for terms like{" "}
          <span className="font-mono text-zinc-300">
            &quot;CSF hospital attestation&quot;
          </span>{" "}
          or{" "}
          <span className="font-mono text-zinc-300">
            &quot;Ohio TDDD ship-to state&quot;
          </span>
          .
        </p>
      )}

      {aiDebugEnabled && (
        <div className="border-t border-zinc-800 pt-2">
          <p className="text-[10px] text-zinc-500">
            This explorer surfaces the same regulatory sources used by CSF Copilot,
            license engines, and RAG endpoints. The current implementation uses
            lexical scoring over title + snippet, but can be swapped for a vector
            search backend without changing the UI contract.
          </p>
        </div>
      )}
    </div>
  );
};
