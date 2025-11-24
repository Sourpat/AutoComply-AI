// src/components/ControlledSubstancesItemHistoryPanel.tsx
import { FormEvent, useState } from "react";
import { emitCodexCommand } from "../utils/codexLogger";

const API_BASE = (import.meta as any).env?.VITE_API_BASE || "";

type ItemHistory = {
  item_id: string;
  name: string;
  strength: string;
  dosage_form: string;
  dea_schedule: string;
  last_purchase_date: string;
  last_ship_to_state: string;
  last_decision_status: string;
  total_orders_12m: number;
  verification_flags: string[];
  source_documents: string[];
};

export function ControlledSubstancesItemHistoryPanel() {
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<ItemHistory[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed || !API_BASE) return;

    setIsLoading(true);
    setError(null);
    try {
      const resp = await fetch(
        `${API_BASE}/controlled-substances/item-history/search?` +
          new URLSearchParams({ query: trimmed, limit: "10" }),
      );
      if (!resp.ok) {
        throw new Error(`Search failed: ${resp.status}`);
      }
      const data = (await resp.json()) as ItemHistory[];
      setItems(data);

      emitCodexCommand("cs_item_history_search_performed", {
        query: trimmed,
        result_count: data.length,
      });
    } catch (err: any) {
      console.error(err);
      setError("Failed to search item history.");
    } finally {
      setIsLoading(false);
    }
  };

  const openDoc = (item: ItemHistory, doc: string) => {
    emitCodexCommand("cs_item_history_document_opened", {
      item_id: item.item_id,
      source_document: doc, // /mnt/data/... path; runtime maps to URL
    });
  };

  const badgeColorForSchedule = (s: string) => {
    if (!s || s.toLowerCase() === "non-controlled") {
      return "bg-slate-100 text-slate-700";
    }
    if (s === "II") return "bg-rose-100 text-rose-800";
    if (s === "III" || s === "IV") return "bg-amber-100 text-amber-800";
    return "bg-slate-100 text-slate-700";
  };

  const badgeColorForStatus = (s: string) => {
    if (s === "allowed") return "bg-emerald-100 text-emerald-800";
    if (s === "blocked") return "bg-rose-100 text-rose-800";
    if (s === "manual_review") return "bg-amber-100 text-amber-800";
    return "bg-slate-100 text-slate-700";
  };

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-3">
      <header className="mb-2">
        <h2 className="text-[11px] font-semibold text-slate-800">
          Controlled Substances – Item History
        </h2>
        <p className="text-[10px] text-slate-500">
          Look up a controlled item by ID (NDC/SKU) or name to see recent
          decisions, schedule, and verification flags.
        </p>
      </header>

      <form onSubmit={onSubmit} className="mb-2 flex items-center gap-1">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="e.g. NDC-55555 or Hydrocodone"
          className="h-7 flex-1 rounded-md border border-slate-300 bg-slate-50 px-2 text-[11px] text-slate-900 outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500"
        />
        <button
          type="submit"
          disabled={isLoading || !API_BASE}
          className="h-7 rounded-md bg-slate-900 px-3 text-[11px] font-medium text-slate-50 hover:bg-slate-800 disabled:opacity-50"
        >
          {isLoading ? "Searching…" : "Search"}
        </button>
      </form>

      {error && <p className="mb-1 text-[10px] text-rose-600">{error}</p>}

      {items.length === 0 && !isLoading && !error && (
        <p className="text-[10px] text-slate-400">
          No results yet. Try searching for{" "}
          <span className="font-mono">NDC-55555</span> or{" "}
          <span className="font-mono">Hydrocodone</span> to see sample data.
        </p>
      )}

      <div className="max-h-56 space-y-2 overflow-auto">
        {items.map((item) => (
          <article
            key={item.item_id}
            className="rounded border border-slate-200 bg-slate-50 p-2"
          >
            <div className="mb-1 flex items-center justify-between gap-2">
              <div className="flex flex-col">
                <span className="text-[10px] font-mono font-semibold text-slate-900">
                  {item.item_id}
                </span>
                <span className="text-[10px] text-slate-700">{item.name}</span>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span
                  className={`rounded-full px-2 py-0.5 text-[9px] font-medium ${badgeColorForSchedule(
                    item.dea_schedule,
                  )}`}
                >
                  Schedule {item.dea_schedule}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[9px] font-medium ${badgeColorForStatus(
                    item.last_decision_status,
                  )}`}
                >
                  Last decision: {item.last_decision_status}
                </span>
              </div>
            </div>

            <div className="mb-1 flex items-center justify-between gap-2 text-[9px] text-slate-600">
              <span>
                Last purchase:{" "}
                <strong className="text-slate-800">
                  {item.last_purchase_date}
                </strong>
              </span>
              <span>
                Ship-to:{" "}
                <strong className="text-slate-800">
                  {item.last_ship_to_state}
                </strong>
              </span>
              <span>
                12m orders:{" "}
                <strong className="text-slate-800">
                  {item.total_orders_12m}
                </strong>
              </span>
            </div>

            {item.verification_flags?.length > 0 && (
              <div className="mb-1 flex flex-wrap items-center gap-1">
                {item.verification_flags.map((f) => (
                  <span
                    key={f}
                    className="rounded-full bg-white px-2 py-0.5 text-[9px] text-slate-700 ring-1 ring-slate-300"
                  >
                    {f.replace(/_/g, " ")}
                  </span>
                ))}
              </div>
            )}

            {item.source_documents?.length > 0 && (
              <div className="flex flex-wrap items-center gap-1">
                {item.source_documents.slice(0, 2).map((doc) => (
                  <a
                    key={doc}
                    href={doc}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => openDoc(item, doc)}
                    className="rounded-full bg-white px-2 py-0.5 text-[9px] text-slate-700 ring-1 ring-slate-300 hover:bg-slate-100"
                  >
                    Open doc
                  </a>
                ))}
              </div>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
