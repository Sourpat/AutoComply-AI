import React from "react";
import { Activity, ShieldCheck, AlertTriangle, XCircle } from "lucide-react";
import { fetchFullHealth, FullHealthResponse } from "../api/healthClient";
import { TestCoverageNote } from "./TestCoverageNote";

type LoadState = "idle" | "loading" | "success" | "error";

function StatusPill({ status }: { status: string }) {
  const normalized = status.toLowerCase();
  if (normalized === "ok") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-200">
        <ShieldCheck className="h-3 w-3" />
        All systems ok
      </span>
    );
  }
  if (normalized === "degraded") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-200">
        <AlertTriangle className="h-3 w-3" />
        Degraded
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-rose-500/40 bg-rose-500/10 px-2 py-0.5 text-[11px] font-medium text-rose-200">
      <XCircle className="h-3 w-3" />
      {status}
    </span>
  );
}

export function SystemHealthCard() {
  const [loadState, setLoadState] = React.useState<LoadState>("idle");
  const [data, setData] = React.useState<FullHealthResponse | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    async function run() {
      setLoadState("loading");
      setError(null);
      try {
        const resp = await fetchFullHealth();
        if (cancelled) return;
        setData(resp);
        setLoadState("success");
      } catch (e: any) {
        if (cancelled) return;
        setError(e?.message ?? "Unknown error");
        setLoadState("error");
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, []);

  const components = data?.components ?? {};

  return (
    <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-4 text-sm text-slate-100 shadow-md shadow-black/30 backdrop-blur">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-slate-50">System health</h2>
          <p className="mt-1 text-[11px] text-slate-400">
            Live view of the health endpoints behind CSF, license, and mock order engines.
          </p>
          <TestCoverageNote size="sm" files={["backend/tests/test_health_api.py"]} />
        </div>
        <div className="flex flex-col items-end gap-1">
          {loadState === "loading" && (
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-800/80 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wide text-slate-300">
              <Activity className="h-3 w-3" />
              <span>Checking...</span>
            </span>
          )}
          {loadState === "success" && data && <StatusPill status={data.status} />}
          {loadState === "error" && (
            <span className="inline-flex items-center gap-1 rounded-full border border-rose-500/40 bg-rose-500/10 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wide text-rose-100">
              <XCircle className="h-3 w-3" />
              <span>Health error</span>
            </span>
          )}
        </div>
      </div>

      {loadState === "error" && error && (
        <p className="mt-2 text-[11px] text-rose-200">Could not reach /health/full: {error}</p>
      )}

      {loadState === "success" && (
        <div className="mt-3 grid gap-2 md:grid-cols-3">
          {Object.entries(components).map(([key, component]) => {
            const normalized = component.status.toLowerCase();
            const isOk = normalized === "ok";
            const isDegraded = normalized === "degraded";
            return (
              <div
                key={key}
                className="rounded-xl border border-white/5 bg-slate-950/80 px-3 py-2"
              >
                <p className="text-[11px] font-semibold text-slate-100">
                  {key.replace(/_/g, " ")}
                </p>
                <p
                  className={
                    "mt-0.5 text-[11px] " +
                    (isOk
                      ? "text-emerald-200"
                      : isDegraded
                      ? "text-amber-200"
                      : "text-rose-200")
                  }
                >
                  {component.status}
                </p>
                {component.details && (
                  <p className="mt-0.5 text-[10px] text-slate-400">{component.details}</p>
                )}
                {component.error && (
                  <p className="mt-0.5 text-[10px] text-rose-300">{component.error}</p>
                )}
              </div>
            );
          })}
        </div>
      )}

      <p className="mt-3 text-[11px] text-slate-400">
        In CI, the same health checks are exercised via the smoke test script: if these endpoints fail, the pipeline goes red before any demo.
      </p>
    </div>
  );
}
