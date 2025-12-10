import React from "react";
import { CopyCurlButton } from "../../components/CopyCurlButton";
import { useRagDebug } from "../../devsupport/RagDebugContext";
import { buildCurlCommand } from "../../utils/curl";
import { API_BASE } from "../../api/csfHospitalClient";

interface RegulatorySource {
  id: string;
  title?: string;
  snippet?: string;
  jurisdiction?: string | null;
  citation?: string | null;
  label?: string | null;
  jurisdiction_label?: string | null;
  source?: {
    jurisdiction?: string | null;
  };
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
  const [lastSearchPayload, setLastSearchPayload] = React.useState<any | null>(
    null
  );
  const [jurisdictionFilter, setJurisdictionFilter] = React.useState<
    "all" | "dea" | "ohio" | "ny" | "other"
  >("all");

  const filteredResults = React.useMemo(() => {
    if (!response?.results) return [];
    if (jurisdictionFilter === "all") return response.results;

    return response.results.filter((item) => {
      const j = (
        item.jurisdiction_label ||
        item.jurisdiction ||
        item.source?.jurisdiction ||
        ""
      )
        .toString()
        .toLowerCase();

      if (!j) return jurisdictionFilter === "other";

      if (jurisdictionFilter === "dea") {
        return j.includes("dea") || j.includes("federal");
      }
      if (jurisdictionFilter === "ohio") {
        return j.includes("oh") || j.includes("ohio");
      }
      if (jurisdictionFilter === "ny") {
        return j.includes("ny") || j.includes("new york");
      }
      if (jurisdictionFilter === "other") {
        return !(
          j.includes("dea") ||
          j.includes("federal") ||
          j.includes("oh") ||
          j.includes("ohio") ||
          j.includes("ny") ||
          j.includes("new york")
        );
      }
      return true;
    });
  }, [response, jurisdictionFilter]);

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const q = query.trim();
    if (!q) {
      setError("Enter a question or term related to CSF or licenses.");
      setLastSearchPayload(null);
      return;
    }

    setLoading(true);
    setError(null);
    setResponse(null);

    try {
      const body = { query: q, limit: 5 };
      setLastSearchPayload(body);

      const resp = await fetch("/rag/regulatory/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
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
          <div className="mt-1 inline-flex items-center gap-1 rounded-full border border-zinc-700/70 bg-zinc-900/70 px-2 py-0.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            <span className="text-[10px] font-medium text-zinc-200">
              Regulatory research console
            </span>
          </div>
          <p className="mt-1 text-xs text-zinc-400">
            Search DEA, Ohio TDDD, and NY Pharmacy guidance to see the exact
            snippets behind AutoComply AI&apos;s decisions.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {lastSearchPayload && (
            <CopyCurlButton
              getCommand={() =>
                buildCurlCommand({
                  method: "POST",
                  url: `${API_BASE}/rag/regulatory/search`,
                  body: lastSearchPayload,
                })
              }
              label="Copy cURL"
            />
          )}
        </div>
      </div>

      <form onSubmit={handleSearch} className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-[180px] flex-1">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g. Ohio TDDD expiry, NY pharmacy rules, hospital CSF attestation"
              className="flex-1 rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-100 placeholder:text-zinc-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] text-zinc-500">Jurisdiction:</span>
            <select
              className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-[11px] text-zinc-100"
              value={jurisdictionFilter}
              onChange={(e) =>
                setJurisdictionFilter(
                  e.target.value as typeof jurisdictionFilter
                )
              }
            >
              <option value="all">All</option>
              <option value="dea">DEA / Federal</option>
              <option value="ohio">Ohio</option>
              <option value="ny">New York</option>
              <option value="other">Other</option>
            </select>
            <button
              type="submit"
              disabled={loading}
              className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50 hover:bg-indigo-500"
            >
              {loading ? "Searching…" : "Search"}
            </button>
          </div>
        </div>
      </form>

      {error && (
        <div className="rounded-lg border border-red-800 bg-red-950/40 px-3 py-2 text-[11px] text-red-200">
          {error}
        </div>
      )}

      {response && (
        <div className="space-y-2">
          {filteredResults.length === 0 ? (
            <p className="text-[11px] text-zinc-500">
              No matching regulatory snippets found for query:{" "}
              <span className="font-mono text-zinc-300">
                {response.query}
              </span>
              {jurisdictionFilter !== "all" && (
                <>
                  {" "}in {jurisdictionFilter.toUpperCase()} scope
                </>
              )}
              .
            </p>
          ) : (
            <>
              <p className="text-[11px] text-zinc-400">
                Showing {filteredResults.length} result
                {filteredResults.length > 1 ? "s" : ""} for query:{" "}
                <span className="font-mono text-zinc-300">
                  {response.query}
                </span>
              </p>
              <ul className="space-y-2">
                {filteredResults.map((src) => (
                  <li
                    key={src.id}
                    className="space-y-1 rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-zinc-100">
                        {src.title || src.id}
                      </span>
                      <span className="text-[10px] font-mono text-zinc-500">
                        {src.id}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {src.label && (
                        <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[11px] font-medium text-zinc-100">
                          {src.label}
                        </span>
                      )}
                      {src.citation && (
                        <span className="rounded-full border border-zinc-700 px-2 py-0.5 text-[10px] text-zinc-300">
                          {src.citation}
                        </span>
                      )}
                      {(src.jurisdiction || src.jurisdiction_label) && (
                        <span className="rounded-full bg-zinc-900 px-2 py-0.5 text-[10px] text-zinc-400">
                          {src.jurisdiction_label ?? src.jurisdiction}
                        </span>
                      )}
                    </div>
                    {src.snippet && (
                      <p className="text-[11px] leading-snug text-zinc-300">
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
