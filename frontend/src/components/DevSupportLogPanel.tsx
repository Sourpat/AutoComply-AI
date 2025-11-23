import { useEffect, useState } from "react";
import {
  type CodexLogEntry,
  subscribeToCodexLogs,
} from "../utils/codexLogger";

interface DevSupportLogPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const MAX_LOGS = 50;

export function DevSupportLogPanel({
  isOpen,
  onClose,
}: DevSupportLogPanelProps) {
  const [logs, setLogs] = useState<CodexLogEntry[]>([]);

  useEffect(() => {
    const unsubscribe = subscribeToCodexLogs((entry) => {
      setLogs((prev) => {
        const next = [entry, ...prev];
        if (next.length > MAX_LOGS) {
          return next.slice(0, MAX_LOGS);
        }
        return next;
      });
    });

    return () => unsubscribe();
  }, []);

  if (!isOpen) return null;

  return (
    <div className="fixed bottom-2 right-2 z-40 w-full max-w-xl rounded-lg border border-slate-300 bg-white shadow-lg">
      <div className="flex items-center justify-between border-b border-slate-200 px-3 py-1.5">
        <div>
          <h3 className="text-[11px] font-semibold text-slate-800">DevSupport Log</h3>
          <p className="text-[10px] text-slate-500">
            Last {Math.min(logs.length, MAX_LOGS)} CODEX_COMMAND events
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600 hover:bg-slate-200"
        >
          Close
        </button>
      </div>

      <div className="max-h-64 overflow-auto px-3 py-2 text-[10px]">
        {logs.length === 0 && (
          <p className="text-slate-400">
            No CODEX_COMMAND events yet. Try evaluating a form or running a RAG explain.
          </p>
        )}

        {logs.map((log) => (
          <LogRow key={log.id} entry={log} />
        ))}
      </div>
    </div>
  );
}

function LogRow({ entry }: { entry: CodexLogEntry }) {
  const [expanded, setExpanded] = useState(false);

  const json = JSON.stringify(entry.payload, null, expanded ? 2 : 0);
  const preview =
    json.length > 160 && !expanded ? json.slice(0, 160) + "…" : json;

  const handleCopyJson = async () => {
    try {
      await navigator.clipboard.writeText(json);
    } catch (err) {
      console.error("Failed to copy JSON", err);
      alert("Copy failed – see console for details.");
    }
  };

  return (
    <div className="mb-2 rounded border border-slate-200 bg-slate-50 px-2 py-1.5">
      <div className="mb-1 flex items-center justify-between">
        <span className="font-mono text-[10px] font-semibold text-slate-800">
          {entry.command}
        </span>
        <span className="text-[9px] text-slate-500">
          {new Date(entry.timestamp).toLocaleTimeString()}
        </span>
      </div>

      <pre className="whitespace-pre-wrap break-all font-mono text-[9px] text-slate-700">
        {preview}
      </pre>

      <div className="mt-1 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="rounded-full bg-white px-2 py-0.5 text-[9px] text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100"
        >
          {expanded ? "Collapse" : "Expand"}
        </button>
        <button
          type="button"
          onClick={handleCopyJson}
          className="rounded-full bg-white px-2 py-0.5 text-[9px] text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100"
        >
          Copy JSON
        </button>
      </div>
    </div>
  );
}
