import React, { useState } from "react";
import { Code2, Server, Copy, ChevronDown } from "lucide-react";
import { copyToClipboard } from "../utils/clipboard";

type ApiReferenceCardProps = {
  groupLabel: string;
  title: string;
  summary: string;
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  path: string;
  curlSnippet: string;
  requestJson?: object;
  responseJson?: object;
};

function formatJson(obj?: object): string {
  if (!obj) return "";
  try {
    return JSON.stringify(obj, null, 2);
  } catch {
    return "";
  }
}

export function ApiReferenceCard({
  groupLabel,
  title,
  summary,
  method,
  path,
  curlSnippet,
  requestJson,
  responseJson,
}: ApiReferenceCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [copyStatus, setCopyStatus] = useState<"idle" | "success" | "error">(
    "idle"
  );

  async function handleCopyCurl() {
    try {
      const ok = await copyToClipboard(curlSnippet);
      setCopyStatus(ok ? "success" : "error");
      setTimeout(() => setCopyStatus("idle"), 2000);
    } catch {
      setCopyStatus("error");
      setTimeout(() => setCopyStatus("idle"), 2000);
    }
  }

  const requestBody = formatJson(requestJson);
  const responseBody = formatJson(responseJson);

  return (
    <div className="flex h-full flex-col rounded-2xl border border-white/10 bg-slate-900/80 p-4 text-sm text-slate-100 shadow-md shadow-black/30 backdrop-blur">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="inline-flex items-center gap-1 rounded-full bg-slate-900/80 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-300">
            <Server className="h-3 w-3" />
            {groupLabel}
          </p>
          <h3 className="mt-1 text-sm font-semibold text-white">{title}</h3>
          <p className="mt-1 text-xs text-slate-300">{summary}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-950 px-2 py-0.5 text-[10px] font-medium text-slate-200">
            <span
              className={
                "rounded-full px-1.5 py-0.5 text-[9px] font-semibold " +
                (method === "POST"
                  ? "bg-emerald-500/15 text-emerald-200"
                  : method === "GET"
                  ? "bg-cyan-500/15 text-cyan-200"
                  : "bg-slate-500/20 text-slate-100")
              }
            >
              {method}
            </span>
            <code className="text-[10px] text-slate-300">{path}</code>
          </span>
          <button
            type="button"
            onClick={handleCopyCurl}
            className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-900 px-2 py-1 text-[10px] font-medium text-slate-200 hover:border-slate-500 hover:bg-slate-800"
            title="Copy sample cURL to clipboard"
          >
            <Copy className="h-3 w-3" />
            {copyStatus === "success"
              ? "Copied!"
              : copyStatus === "error"
              ? "Error"
              : "Copy cURL"}
          </button>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="mt-3 inline-flex items-center gap-1 text-[11px] font-medium text-cyan-300 hover:text-cyan-200"
      >
        <Code2 className="h-3 w-3" />
        <span>View sample request &amp; response</span>
        <ChevronDown
          className={
            "h-3 w-3 transition-transform " +
            (isOpen ? "rotate-180" : "rotate-0")
          }
        />
      </button>

      {isOpen && (
        <div className="mt-2 space-y-2 text-[11px]">
          {requestBody && (
            <div>
              <p className="mb-1 text-slate-300">Sample request body</p>
              <pre className="max-h-48 overflow-auto rounded-lg bg-slate-950/90 p-2 text-[10px] leading-relaxed text-slate-100">
                {requestBody}
              </pre>
            </div>
          )}
          {responseBody && (
            <div>
              <p className="mb-1 text-slate-300">Sample response body</p>
              <pre className="max-h-48 overflow-auto rounded-lg bg-slate-950/90 p-2 text-[10px] leading-relaxed text-slate-100">
                {responseBody}
              </pre>
            </div>
          )}
          {!requestBody && !responseBody && (
            <p className="text-slate-500">
              You can plug in example payloads here later. The UI is wired so you
              can drop in real request/response shapes without changing the
              layout.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
