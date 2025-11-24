import { emitCodexCommand } from "../utils/codexLogger";

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
  payload?: any; // expected { form, verdict } or { form, decision }
};

type Props = {
  request: VerificationRequest;
  ragAnswer?: string;
  onExplain: () => void;
  onClose: () => void;
};

function prettyLabel(key: string): string {
  return key
    .replace(/[_\.]/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^./, (c) => c.toUpperCase());
}

export function VerificationDetailView({
  request,
  ragAnswer,
  onExplain,
  onClose,
}: Props) {
  const decision =
    request.payload?.verdict ??
    request.payload?.decision ??
    request.payload ??
    null;
  const form = request.payload?.form ?? request.payload?.request ?? null;

  const createdAt = new Date(request.created_at).toLocaleString();

  return (
    <div className="mt-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <div className="mb-1 flex flex-wrap items-center gap-1">
            <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
              {request.engine_family}
            </span>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-800">
              {request.decision_type}
            </span>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                request.status === "pending"
                  ? "bg-amber-100 text-amber-800"
                  : request.status === "resolved"
                  ? "bg-emerald-100 text-emerald-800"
                  : "bg-slate-100 text-slate-700"
              }`}
            >
              {request.status}
            </span>
          </div>
          <div className="text-[10px] text-slate-600">
            <div>
              <span className="font-semibold">Jurisdiction: </span>
              <span>{request.jurisdiction ?? "—"}</span>
            </div>
            <div>
              <span className="font-semibold">Reason for review: </span>
              <span>{request.reason_for_review}</span>
            </div>
            <div>
              <span className="font-semibold">Created at: </span>
              <span>{createdAt}</span>
            </div>
            {request.decision_snapshot_id && (
              <div>
                <span className="font-semibold">Decision snapshot ID: </span>
                <span className="font-mono text-[9px]">
                  {request.decision_snapshot_id}
                </span>
              </div>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            emitCodexCommand("verification_detail_closed", {
              verification_id: request.id,
            });
            onClose();
          }}
          className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-700 hover:bg-slate-200"
        >
          Close
        </button>
      </div>

      {/* Regulatory references */}
      <div className="mb-2 rounded-lg bg-slate-50 p-2">
        <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
          <div className="text-[10px] font-semibold text-slate-800">
            Regulatory context
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1">
          {request.regulatory_reference_ids?.map((id) => (
            <span
              key={id}
              className="rounded-full bg-white px-2 py-0.5 text-[9px] text-slate-700 ring-1 ring-slate-300"
            >
              Rule: {id}
            </span>
          ))}
          {(!request.regulatory_reference_ids ||
            request.regulatory_reference_ids.length === 0) && (
            <span className="text-[9px] text-slate-400">No rule IDs set.</span>
          )}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-1">
          {request.source_documents?.map((doc) => (
            <a
              key={doc}
              href={doc}
              target="_blank"
              rel="noreferrer"
              className="rounded-full bg-white px-2 py-0.5 text-[9px] text-slate-700 ring-1 ring-slate-300 hover:bg-slate-100"
              onClick={() =>
                emitCodexCommand("open_verification_detail_document", {
                  verification_id: request.id,
                  engine_family: request.engine_family,
                  decision_type: request.decision_type,
                  source_document: doc, // /mnt/data/... path
                })
              }
            >
              Open doc
            </a>
          ))}
          {(!request.source_documents ||
            request.source_documents.length === 0) && (
            <span className="text-[9px] text-slate-400">
              No source documents attached.
            </span>
          )}
        </div>
      </div>

      {/* RAG explanation */}
      <div className="mb-2 rounded-lg bg-slate-50 p-2">
        <div className="mb-1 flex items-center justify-between">
          <div className="text-[10px] font-semibold text-slate-800">
            RAG explanation
          </div>
          <button
            type="button"
            onClick={() => {
              emitCodexCommand("verification_detail_explain_clicked", {
                verification_id: request.id,
              });
              onExplain();
            }}
            className="rounded-full bg-slate-900 px-2 py-0.5 text-[9px] text-slate-50 hover:bg-slate-800"
          >
            Explain / refresh
          </button>
        </div>
        {ragAnswer ? (
          <p className="text-[10px] leading-snug text-slate-800 whitespace-pre-wrap">
            {ragAnswer}
          </p>
        ) : (
          <p className="text-[10px] text-slate-500">
            No explanation loaded yet. Click{" "}
            <span className="font-semibold">“Explain / refresh”</span> to
            generate a regulatory explanation for this request.
          </p>
        )}
      </div>

      {/* Form details */}
      {form && (
        <div className="mb-2 rounded-lg border border-slate-200 bg-white p-2">
          <div className="mb-1 text-[10px] font-semibold text-slate-800">
            Form details
          </div>
          <dl className="grid grid-cols-2 gap-x-3 gap-y-1">
            {Object.entries(form).map(([key, value]) => (
              <div key={key} className="text-[10px]">
                <dt className="font-semibold text-slate-600">
                  {prettyLabel(key)}
                </dt>
                <dd className="text-slate-800">
                  {typeof value === "object"
                    ? JSON.stringify(value)
                    : String(value ?? "—")}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      {/* Decision details */}
      {decision && (
        <div className="rounded-lg border border-slate-200 bg-white p-2">
          <div className="mb-1 text-[10px] font-semibold text-slate-800">
            Decision details
          </div>
          <dl className="grid grid-cols-2 gap-x-3 gap-y-1">
            {Object.entries(decision).map(([key, value]) => (
              <div key={key} className="text-[10px]">
                <dt className="font-semibold text-slate-600">
                  {prettyLabel(key)}
                </dt>
                <dd className="text-slate-800">
                  {typeof value === "object"
                    ? JSON.stringify(value)
                    : String(value ?? "—")}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </div>
  );
}
