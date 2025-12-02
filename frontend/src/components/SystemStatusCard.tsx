import React, { useEffect, useState } from "react";
import { fetchHealthStatus, HealthStatus } from "../api/healthClient";
import { DecisionStatusBadge } from "./DecisionStatusBadge";
import { trackSandboxEvent } from "../devsupport/telemetry";

type StatusColor = "ok" | "degraded" | "down" | "unknown";

function mapStatusToDisplay(status: string | null | undefined): StatusColor {
  if (!status) return "unknown";
  if (status === "ok") return "ok";
  if (status === "degraded") return "degraded";
  if (status === "down") return "down";
  return "unknown";
}

/**
 * Displays the /health status of the AutoComply AI backend,
 * including service name, version, and basic subsystem checks.
 */
export function SystemStatusCard() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);

      trackSandboxEvent("system_status_load_start", {
        engine_family: "system",
      });

      try {
        const data = await fetchHealthStatus();
        setHealth(data);

        trackSandboxEvent("system_status_load_success", {
          engine_family: "system",
          status: data.status,
          version: data.version,
        });
      } catch (err: any) {
        const message =
          err?.message ??
          "Could not load system status. Please check the backend.";
        setError(message);

        trackSandboxEvent("system_status_load_error", {
          engine_family: "system",
          error: String(err),
        });
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  const overall = mapStatusToDisplay(health?.status);

  return (
    <div className="sandbox-card system-status-card space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <header className="space-y-1">
        <h2 className="text-sm font-semibold text-slate-900">System Status</h2>
        <p className="text-[11px] leading-relaxed text-slate-600">
          Current health of the AutoComply AI backend, including CSF Suite,
          License Suite, and the RAG layer.
        </p>
      </header>

      {loading && <p className="text-xs text-slate-600">Checking system status…</p>}

      {error && (
        <p className="text-xs font-medium text-amber-700">
          {error}{" "}
          <span role="img" aria-label="warning">
            ⚠️
          </span>
        </p>
      )}

      {health && (
        <>
          <section className="rounded-lg border border-slate-200 bg-slate-50/60 p-3 text-xs text-slate-800">
            <p className="flex items-center justify-between">
              <span className="font-semibold text-slate-900">Service</span>
              <span className="font-mono text-[11px] text-slate-700">
                {health.service}
              </span>
            </p>
            <p className="flex items-center justify-between">
              <span className="font-semibold text-slate-900">Version</span>
              <span className="font-mono text-[11px] text-slate-700">
                {health.version}
              </span>
            </p>
            <p className="mt-2 flex items-center gap-2 text-[11px]">
              <span className="font-semibold text-slate-900">Overall</span>
              <DecisionStatusBadge status={overall} />
            </p>
          </section>

          <section className="system-status-checks space-y-2">
            <h3 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Subsystem checks
            </h3>
            <ul className="space-y-1 text-xs text-slate-800">
              {Object.entries(health.checks).map(([name, value]) => (
                <li
                  key={name}
                  className="flex items-center justify-between rounded-lg border border-slate-200 bg-white/60 px-3 py-2"
                >
                  <span className="check-name font-mono text-[11px] lowercase text-slate-700">
                    {name}
                  </span>
                  <DecisionStatusBadge status={mapStatusToDisplay(value)} />
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}
