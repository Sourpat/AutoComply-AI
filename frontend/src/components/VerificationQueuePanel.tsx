import { useEffect, useState } from "react";
import { emitCodexCommand } from "../utils/codexLogger";

const API_BASE = (import.meta as any).env?.VITE_API_BASE || "";

type VerificationRequest = {
  id: string;
  created_at: string;
  status: string;
  engine_family: string;
  decision_type: string;
  jurisdiction?: string | null;
  reason_for_review: string;
  decision_snapshot_id?: string | null;
  regulatory_reference_ids?: string[];
  source_documents?: string[];
  user_question?: string | null;
  channel?: string | null;
  payload?: any;
};

export function VerificationQueuePanel() {
  const [items, setItems] = useState<VerificationRequest[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [ragLoadingId, setRagLoadingId] = useState<string | null>(null);
  const [ragAnswers, setRagAnswers] = useState<Record<string, string>>({});

  const loadQueue = async () => {
    setIsLoading(true);
    try {
      const resp = await fetch(
        `${API_BASE}/verifications/queue?status=pending&limit=20`
      );
      if (!resp.ok) throw new Error(`Queue failed: ${resp.status}`);
      const data = (await resp.json()) as VerificationRequest[];
      setItems(data);
      emitCodexCommand("verification_queue_loaded", {
        count: data.length,
      });
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadQueue();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleOpenDoc = (req: VerificationRequest, doc: string) => {
    emitCodexCommand("open_verification_document", {
      verification_id: req.id,
      engine_family: req.engine_family,
      decision_type: req.decision_type,
      source_document: doc, // /mnt/data/... path, treated as URL by runtime
    });
  };

  const explainRequestWithRag = async (req: VerificationRequest) => {
    if (!req) return;
    const decision =
      req.payload?.verdict ?? req.payload?.decision ?? req.payload ?? null;

    setRagLoadingId(req.id);
    try {
      const resp = await fetch(`${API_BASE}/rag/regulatory-explain`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question:
            req.user_question ??
            "Explain this decision for the verification team, referencing the relevant policy and why this case needs manual review.",
          decision,
          regulatory_references: req.regulatory_reference_ids ?? [],
        }),
      });

      if (!resp.ok) {
        throw new Error(`RAG explain failed: ${resp.status}`);
      }

      const data = await resp.json();
      const answer =
        (data.answer as string) ??
        (data.text as string) ??
        JSON.stringify(data, null, 2);

      setRagAnswers((prev) => ({
        ...prev,
        [req.id]: answer,
      }));

      emitCodexCommand("verification_rag_explained", {
        verification_id: req.id,
        engine_family: req.engine_family,
        decision_type: req.decision_type,
        regulatory_reference_ids: req.regulatory_reference_ids ?? [],
      });
    } catch (err) {
      console.error(err);
      setRagAnswers((prev) => ({
        ...prev,
        [req.id]: "Failed to load RAG explanation.",
      }));
    } finally {
      setRagLoadingId(null);
    }
  };

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-3">
      <header className="mb-2 flex items-center justify-between gap-2">
        <div>
          <h2 className="text-[11px] font-semibold text-slate-800">
            Verification Queue
          </h2>
          <p className="text-[10px] text-slate-500">
            Pending verification requests generated from sandbox decisions.
          </p>
        </div>
        <button
          type="button"
          onClick={loadQueue}
          disabled={isLoading}
          className="rounded-full bg-white px-2 py-0.5 text-[10px] text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50 disabled:opacity-40"
        >
          {isLoading ? "Refreshing…" : "Refresh"}
        </button>
      </header>

      {items.length === 0 && !isLoading && (
        <p className="text-[10px] text-slate-400">
          No pending verification requests. Try evaluating a PDMA sample that is
          not eligible to create one.
        </p>
      )}

      <div className="max-h-64 space-y-1 overflow-auto">
        {items.map((req) => (
          <article
            key={req.id}
            className="flex flex-col gap-1 rounded border border-slate-200 bg-slate-50 px-2 py-1.5"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1">
                <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white">
                  {req.engine_family}
                </span>
                <span className="rounded-full bg-white px-2 py-0.5 text-[9px] font-medium text-slate-800 ring-1 ring-slate-300">
                  {req.decision_type}
                </span>
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-medium text-amber-800">
                  {req.status}
                </span>
              </div>
              <span className="text-[9px] text-slate-500">
                {req.jurisdiction ?? "—"}
              </span>
            </div>

            <div className="flex items-center justify-between gap-2">
              <span className="text-[9px] text-slate-500">
                {new Date(req.created_at).toLocaleString()}
              </span>
              <span className="text-[9px] text-slate-600">
                {req.reason_for_review}
              </span>
            </div>

            <div className="flex items-center justify-between gap-2">
              {req.source_documents?.length ? (
                <div className="flex flex-wrap items-center gap-1">
                  {req.source_documents.slice(0, 2).map((doc) => (
                    <a
                      key={doc}
                      href={doc}
                      target="_blank"
                      rel="noreferrer"
                      onClick={() => handleOpenDoc(req, doc)}
                      className="rounded-full bg-white px-2 py-0.5 text-[9px] text-slate-700 ring-1 ring-slate-300 hover:bg-slate-100"
                    >
                      Open doc
                    </a>
                  ))}
                </div>
              ) : (
                <span className="text-[9px] text-slate-400">
                  No source documents
                </span>
              )}

              <button
                type="button"
                onClick={() => explainRequestWithRag(req)}
                disabled={ragLoadingId === req.id}
                className="rounded-full bg-slate-900 px-2 py-0.5 text-[9px] text-slate-50 hover:bg-slate-800 disabled:opacity-40"
              >
                {ragLoadingId === req.id ? "Explaining…" : "Explain with RAG"}
              </button>
            </div>

            {ragAnswers[req.id] && (
              <div className="mt-1 rounded bg-white p-2 text-[9px] leading-snug text-slate-800 ring-1 ring-slate-200">
                <strong className="mb-1 block text-[9px] text-slate-600">
                  RAG explanation
                </strong>
                <p className="whitespace-pre-wrap">{ragAnswers[req.id]}</p>
              </div>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
