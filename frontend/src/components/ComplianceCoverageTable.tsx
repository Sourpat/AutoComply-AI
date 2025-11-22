import { useEffect, useState } from "react";
import {
  ArtifactStatus,
  ComplianceArtifact,
} from "../domain/complianceArtifacts";
import { fetchComplianceArtifacts } from "../api/complianceArtifactsClient";

function statusLabel(status: ArtifactStatus): string {
  switch (status) {
    case "raw_document":
      return "Raw document only";
    case "modelled":
      return "Modelled (no API)";
    case "api_exposed":
      return "API available";
    case "ui_sandbox":
      return "UI sandbox";
    case "full_loop":
      return "Full loop (UI + API + Codex)";
    default:
      return status;
  }
}

function statusBadgeClass(status: ArtifactStatus): string {
  switch (status) {
    case "full_loop":
      return "bg-green-100 text-green-800 border-green-200";
    case "ui_sandbox":
    case "api_exposed":
      return "bg-blue-100 text-blue-800 border-blue-200";
    case "modelled":
      return "bg-yellow-100 text-yellow-800 border-yellow-200";
    case "raw_document":
    default:
      return "bg-gray-100 text-gray-800 border-gray-200";
  }
}

export function ComplianceCoverageTable() {
  const [artifacts, setArtifacts] = useState<ComplianceArtifact[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<ArtifactStatus | "all">("all");

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);
    setError(null);

    fetchComplianceArtifacts()
      .then((data) => {
        if (!isMounted) return;
        setArtifacts(data);
      })
      .catch((err: any) => {
        if (!isMounted) return;
        setError(err?.message ?? "Failed to load compliance artifacts");
      })
      .finally(() => {
        if (!isMounted) return;
        setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const filtered =
    filter === "all"
      ? artifacts
      : artifacts.filter((a) => a.engine_status === filter);

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4 text-sm shadow-sm">
      <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-600">
            Compliance Coverage
          </h2>
          <p className="text-[11px] text-gray-500">
            Overview of all modeled and unmodeled forms (Ohio TDDD, CSFs,
            addendums).
          </p>
        </div>

        <div className="flex items-center gap-2 text-[11px]">
          <span className="text-gray-500">Filter by status:</span>
          <select
            className="rounded-md border border-gray-300 bg-white px-2 py-1 text-[11px]"
            value={filter}
            onChange={(e) => setFilter(e.target.value as ArtifactStatus | "all")}
          >
            <option value="all">All</option>
            <option value="full_loop">Full loop</option>
            <option value="ui_sandbox">UI sandbox</option>
            <option value="api_exposed">API exposed</option>
            <option value="modelled">Modelled</option>
            <option value="raw_document">Raw document</option>
          </select>
        </div>
      </header>

      {isLoading && (
        <div className="text-[11px] text-gray-500">Loading artifacts…</div>
      )}
      {error && (
        <div className="rounded-md bg-red-50 px-2 py-1 text-[11px] text-red-700">
          {error}
        </div>
      )}

      {!isLoading && !error && filtered.length === 0 && (
        <div className="text-[11px] text-gray-500">No artifacts found.</div>
      )}

      {!isLoading && !error && filtered.length > 0 && (
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-[11px]">
            <thead>
              <tr className="border-b bg-gray-50 text-left font-medium text-gray-600">
                <th className="px-2 py-1">Jurisdiction</th>
                <th className="px-2 py-1">Name</th>
                <th className="px-2 py-1">Type</th>
                <th className="px-2 py-1">Engine status</th>
                <th className="px-2 py-1">Source</th>
                <th className="px-2 py-1">Notes</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((a) => (
                <tr key={a.id} className="border-b last:border-0">
                  <td className="px-2 py-1 align-top text-gray-700">
                    {a.jurisdiction ?? "—"}
                  </td>
                  <td className="px-2 py-1 align-top font-medium text-gray-900">
                    {a.name}
                  </td>
                  <td className="px-2 py-1 align-top text-gray-700">
                    {a.artifact_type.replace(/_/g, " ")}
                  </td>
                  <td className="px-2 py-1 align-top">
                    <span
                      className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium ${statusBadgeClass(
                        a.engine_status
                      )}`}
                    >
                      {statusLabel(a.engine_status)}
                    </span>
                  </td>
                  <td className="px-2 py-1 align-top">
                    {a.source_document ? (
                      <a
                        href={a.source_document}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[10px] text-blue-600 hover:underline"
                      >
                        Open source
                      </a>
                    ) : (
                      <span className="text-[10px] text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-2 py-1 align-top text-gray-700">
                    {a.notes ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
