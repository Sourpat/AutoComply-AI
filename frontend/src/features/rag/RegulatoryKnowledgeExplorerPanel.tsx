import React from "react";
import { CopyCurlButton } from "../../components/CopyCurlButton";
import { useRagDebug } from "../../devsupport/RagDebugContext";
import { buildCurlCommand } from "../../utils/curl";
import { API_BASE } from "../../lib/api";
import { ragSearch } from "../../api/ragClient";
import type { RagSearchResponse, RagSource } from "../../types/rag";
import { RagSourceCard } from "../../components/RagSourceCard";
import type { ExplainRequest } from "../../pages/ConsoleDashboard";
import { EvidenceDrawer } from "../../components/EvidenceDrawer";
import type { EvidenceItem } from "../../types/evidence";

type RequestState = "idle" | "loading" | "empty" | "error" | "success";

interface RegulatoryKnowledgeExplorerPanelProps {
  onExplainRequest?: (request: ExplainRequest) => void;
  caseId?: string; // For evidence packet tracking
}

export const RegulatoryKnowledgeExplorerPanel: React.FC<RegulatoryKnowledgeExplorerPanelProps> = ({
  onExplainRequest,
  caseId = 'rag-explorer-default', // Default case ID for standalone RAG usage
}) => {
  const { enabled: aiDebugEnabled } = useRagDebug();

  const [query, setQuery] = React.useState("");
  const [sources, setSources] = React.useState<RagSource[]>([]);
  const [response, setResponse] = React.useState<RagSearchResponse | null>(null);
  const [requestState, setRequestState] = React.useState<RequestState>("idle");
  const [error, setError] = React.useState<string | null>(null);
  const [errorStatus, setErrorStatus] = React.useState<number | null>(null);
  const [lastSearchPayload, setLastSearchPayload] = React.useState<any | null>(
    null
  );
  const [jurisdictionFilter, setJurisdictionFilter] = React.useState<
    "all" | "dea" | "ohio" | "ny" | "other"
  >("all");

  // Evidence Drawer state
  const [evidenceDrawerOpen, setEvidenceDrawerOpen] = React.useState(false);
  const [selectedEvidence, setSelectedEvidence] = React.useState<EvidenceItem | null>(null);

  const handleOpenEvidence = (evidence: EvidenceItem) => {
    setSelectedEvidence(evidence);
    setEvidenceDrawerOpen(true);
  };

  const handleCloseEvidence = () => {
    setEvidenceDrawerOpen(false);
    setSelectedEvidence(null);
  };

  const filteredResults = React.useMemo(() => {
    if (!sources) return [];
    if (jurisdictionFilter === "all") return sources;

    return sources.filter((item) => {
      const j = (item.jurisdiction || "").toString().toLowerCase();

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
  }, [sources, jurisdictionFilter]);

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const q = query.trim();
    
    // If query is blank, reset to idle state
    if (!q) {
      setRequestState("idle");
      setError(null);
      setErrorStatus(null);
      setResponse(null);
      setSources([]);
      setLastSearchPayload(null);
      return;
    }

    // Set loading state and clear previous errors
    setRequestState("loading");
    setError(null);
    setErrorStatus(null);
    setResponse(null);
    setSources([]);

    try {
      const filters = { limit: 5 };
      const payload = { query: q, ...filters };
      setLastSearchPayload(payload);

      const json = await ragSearch(q, filters);
      
      // Normalize response - handle both array and object formats
      const items = Array.isArray(json) 
        ? json 
        : (json?.sources ?? json?.results ?? json?.items ?? []);
      
      setResponse({ query: json?.query ?? q, sources: items });
      setSources(items);
      
      // Determine state based on results
      if (items.length === 0) {
        setRequestState("empty");
      } else {
        setRequestState("success");
      }
    } catch (err: any) {
      setRequestState("error");
      setError(err?.message || "Network error while searching regulatory knowledge.");
      setErrorStatus(err?.status ?? null);
      setSources([]);
      setResponse(null);
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

      {/* Seed Queries */}
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <span className="text-[10px] text-zinc-500">Quick start:</span>
        {[
          "Ohio TDDD renewal",
          "DEA practitioner CSF requirements",
          "NY pharmacy license validation",
        ].map((seedQuery) => (
          <button
            key={seedQuery}
            type="button"
            onClick={() => {
              setQuery(seedQuery);
              handleSearch();
            }}
            className="rounded-full bg-zinc-800 px-3 py-1 text-[10px] font-medium text-zinc-300 hover:bg-zinc-700 transition-colors"
          >
            {seedQuery}
          </button>
        ))}
      </div>

      <form onSubmit={handleSearch} className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-[180px] flex-1">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g. Ohio TDDD expiry, NY pharmacy rules, hospital CSF attestation"
              className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-100 placeholder:text-zinc-500"
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
              disabled={requestState === "loading"}
              className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50 hover:bg-indigo-500"
            >
              {requestState === "loading" ? "Searching…" : "Search"}
            </button>
          </div>
        </div>
        <p className="text-[10px] text-zinc-500">
          💡 Type a query and click Search. Results are snippets from the regulatory knowledge base.
        </p>
      </form>

      {/* Debug Info (dev only) */}
      {aiDebugEnabled && (
        <div className="text-[9px] text-zinc-600 font-mono">
          Debug: state={requestState} | queryLen={query.length} | results={sources.length}
        </div>
      )}

      {/* Idle State */}
      {requestState === "idle" && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2.5 text-[11px] text-zinc-400">
          💡 Enter a query to explore regulatory context.
        </div>
      )}

      {/* Loading State */}
      {requestState === "loading" && (
        <div className="rounded-lg border border-indigo-800/50 bg-indigo-950/30 px-3 py-2.5 text-[11px] text-indigo-200">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 animate-spin rounded-full border-2 border-indigo-400 border-t-transparent" />
            <span>Searching regulatory sources…</span>
          </div>
        </div>
      )}

      {/* Error State */}
      {requestState === "error" && (
        <div className="rounded-lg border border-red-800 bg-red-950/40 px-3 py-2.5 text-[11px] text-red-200">
          <div className="font-medium">Search failed</div>
          <div className="mt-1 text-red-300/90">
            {error}
            {errorStatus && (
              <span className="ml-1 text-red-400/70">(HTTP {errorStatus})</span>
            )}
          </div>
        </div>
      )}

      {/* Empty State */}
      {requestState === "empty" && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2.5 text-[11px] text-zinc-400">
          No results found. Try different keywords or broaden your jurisdiction filter.
        </div>
      )}

      {/* Success State */}
      {requestState === "success" && response && (
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
              . Try selecting &quot;All&quot; jurisdictions.
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
              <p className="text-[10px] text-zinc-500 italic mt-1">
                These are search matches, not a step-by-step checklist.
              </p>
              <div className="space-y-2">
                {filteredResults.map((src, idx) => (
                  <RagSourceCard 
                    key={src.id ?? idx} 
                    source={src} 
                    index={idx}
                    onOpenEvidence={handleOpenEvidence}
                    onExplain={onExplainRequest ? (source) => {
                      onExplainRequest({
                        decision_type: "csf_practitioner",
                        query: query,
                        source_id: source.id,
                        jurisdiction: source.jurisdiction ?? "US-FEDERAL",
                        evidence: {}, // Will use scenario defaults
                      });
                    } : undefined}
                    onOpenInPreview={(source) => {
                      // Scroll to preview section (section 3)
                      const previewSection = document.querySelector('[data-section="preview"]');
                      if (previewSection) {
                        previewSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      }
                      console.log('[Open in Preview] source:', source.label, 'docId:', source.id);
                    }}
                  />
                ))}
              </div>
            </>
          )}
        </div>
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

      {/* Evidence Drawer */}
      <EvidenceDrawer
        open={evidenceDrawerOpen}
        onClose={handleCloseEvidence}
        evidence={selectedEvidence}
        caseId={caseId}
      />
    </div>
  );
};
