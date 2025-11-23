import { useEffect, useState } from "react";
import { emitCodexCommand } from "../utils/codexLogger";

const API_BASE = (import.meta as any).env?.VITE_API_BASE || "";

type DecisionRecord = {
  id: string;
  timestamp: string;
  engine_family: string;
  decision_type: string;
  status: string;
  jurisdiction?: string | null;
  regulatory_reference_ids?: string[];
  source_documents?: string[];
  payload?: any;
};

export function DecisionHistoryPanel() {
  const [records, setRecords] = useState<DecisionRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadHistory = async () => {
    setIsLoading(true);
    try {
      const resp = await fetch(`${API_BASE}/decisions/history?limit=10`);
      if (!resp.ok) throw new Error(`History failed: ${resp.status}`);
      const data = (await resp.json()) as DecisionRecord[];
      setRecords(data);
      emitCodexCommand("decision_history_loaded", {
        count: data.length,
      });
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleOpenDoc = (record: DecisionRecord, doc: string) => {
    emitCodexCommand("open_decision_history_document", {
      decision_id: record.id,
      engine_family: record.engine_family,
      decision_type: record.decision_type,
      source_document: doc, // /mnt/data/... path, treated as URL by runtime
    });
  };

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-3">
      <header className="mb-2 flex items-center justify-between gap-2">
        <div>
          <h2 className="text-[11px] font-semibold text-slate-800">
            Decision History
          </h2>
          <p className="text-[10px] text-slate-500">
            Most recent decisions across engines (in-memory demo store).
          </p>
        </div>
        <button
          type="button"
          onClick={loadHistory}
          disabled={isLoading}
          className="rounded-full bg-white px-2 py-0.5 text-[10px] text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50 disabled:opacity-40"
        >
          {isLoading ? "Refreshing…" : "Refresh"}
        </button>
      </header>

      {records.length === 0 && !isLoading && (
        <p className="text-[10px] text-slate-400">
          No decision snapshots yet. Evaluate a PDMA sample (or other flows)
          to populate history.
        </p>
      )}

      <div className="space-y-1 max-h-64 overflow-auto">
        {records.map((rec) => (
          <article
            key={rec.id}
            className="flex flex-col gap-1 rounded border border-slate-200 bg-slate-50 px-2 py-1.5"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1">
                <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white">
                  {rec.engine_family}
                </span>
                <span className="rounded-full bg-white px-2 py-0.5 text-[9px] font-medium text-slate-800 ring-1 ring-slate-300">
                  {rec.decision_type}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[9px] font-medium ${
                    rec.status === "eligible"
                      ? "bg-emerald-100 text-emerald-800"
                      : rec.status === "ineligible"
                      ? "bg-rose-100 text-rose-800"
                      : "bg-amber-100 text-amber-800"
                  }`}
                >
                  {rec.status}
                </span>
              </div>
              <span className="text-[9px] text-slate-500">
                {rec.jurisdiction ?? "—"}
              </span>
            </div>

            <div className="flex items-center justify-between gap-2">
              <span className="text-[9px] text-slate-500">
                {new Date(rec.timestamp).toLocaleString()}
              </span>

              <div className="flex flex-wrap items-center gap-1">
                {rec.source_documents?.[0] && (
                  <a
                    href={rec.source_documents[0]}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() =>
                      handleOpenDoc(rec, rec.source_documents![0])
                    }
                    className="rounded-full bg-white px-2 py-0.5 text-[9px] text-slate-700 ring-1 ring-slate-300 hover:bg-slate-100"
                  >
                    Open document
                  </a>
                )}
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
