import React from "react";
import type { ApiErrorDetails } from "../lib/api";

interface ApiErrorPanelProps {
  error: ApiErrorDetails;
  title?: string;
  onRetry?: () => void;
  compact?: boolean;
}

export function ApiErrorPanel({
  error,
  title = "Request failed",
  onRetry,
  compact = false,
}: ApiErrorPanelProps) {
  return (
    <div
      className={
        compact
          ? "rounded-lg border border-red-900/60 bg-red-950/40 p-3 text-xs text-red-200"
          : "rounded-lg border border-red-900/60 bg-red-950/40 p-4 text-sm text-red-100"
      }
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-red-100">{title}</p>
          <p className="mt-1 text-red-200/90">{error.message}</p>
          {error.url && (
            <p className="mt-1 font-mono text-[11px] text-red-200/80">
              Endpoint: {error.url}
            </p>
          )}
          {(error.status || error.statusText) && (
            <p className="mt-1 text-[11px] text-red-200/80">
              Status: {error.status ?? ""} {error.statusText ?? ""}
            </p>
          )}
          {(error.requestId || error.correlationId || error.traceId) && (
            <p className="mt-1 text-[11px] text-red-200/80">
              {error.requestId && <span>Request-ID: {error.requestId} </span>}
              {error.correlationId && <span>Correlation-ID: {error.correlationId} </span>}
              {error.traceId && <span>Trace-ID: {error.traceId}</span>}
            </p>
          )}
        </div>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="rounded-md border border-red-700/70 bg-red-900/40 px-2.5 py-1 text-[11px] font-semibold text-red-100 hover:bg-red-900/60"
          >
            Retry
          </button>
        )}
      </div>
      {error.bodySnippet && (
        <details className="mt-2">
          <summary className="cursor-pointer text-[11px] text-red-200/80">
            Response snippet
          </summary>
          <pre className="mt-2 max-h-40 overflow-auto rounded bg-red-950/40 p-2 text-[11px] text-red-100">
            {error.bodySnippet}
          </pre>
        </details>
      )}
    </div>
  );
}
