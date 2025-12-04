import React, { useState } from "react";

import type { RegulatoryPreviewItem, RegulatoryPreviewResponse } from "../../types/rag";
import { useRagDebug } from "../../devsupport/RagDebugContext";

type KnownDocKey =
  | "ohioTddd"
  | "nyPharmacy"
  | "csfHospital"
  | "csfFacility"
  | "csfPractitioner";

interface PresetConfig {
  label: string;
  payload: {
    decision_type?: string | null;
    jurisdiction?: string | null;
    doc_ids?: string[] | null;
  };
}

const PRESETS: Record<KnownDocKey, PresetConfig> = {
  ohioTddd: {
    label: "Ohio TDDD – core license doc",
    payload: {
      decision_type: "license_ohio_tddd",
      jurisdiction: "US-OH",
      doc_ids: ["ohio-tddd-core"],
    },
  },
  nyPharmacy: {
    label: "NY Pharmacy – core license doc",
    payload: {
      decision_type: "license_ny_pharmacy",
      jurisdiction: "US-NY",
      doc_ids: ["ny-pharmacy-core"],
    },
  },
  csfHospital: {
    label: "CSF – Hospital form",
    payload: {
      decision_type: "csf_hospital",
      jurisdiction: null,
      doc_ids: ["csf_hospital_form"],
    },
  },
  csfFacility: {
    label: "CSF – Facility form",
    payload: {
      decision_type: "csf_facility",
      jurisdiction: null,
      doc_ids: ["csf_facility_form"],
    },
  },
  csfPractitioner: {
    label: "CSF – Practitioner form",
    payload: {
      decision_type: "csf_practitioner",
      jurisdiction: null,
      doc_ids: ["csf_practitioner_form"],
    },
  },
};

export const RegulatoryPreviewPanel: React.FC = () => {
  const { enabled: ragDebugEnabled } = useRagDebug();
  const [selectedPreset, setSelectedPreset] = useState<KnownDocKey | "">("");
  const [items, setItems] = useState<RegulatoryPreviewItem[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rawResponse, setRawResponse] = useState<RegulatoryPreviewResponse | null>(null);
  const [showRaw, setShowRaw] = useState(false);

  const handleLoad = async () => {
    if (!selectedPreset) return;
    const config = PRESETS[selectedPreset];

    setLoading(true);
    setError(null);
    setItems(null);
    setRawResponse(null);
    setShowRaw(false);

    try {
      const resp = await fetch("/rag/regulatory/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config.payload),
      });

      if (!resp.ok) {
        setError(`Request failed (${resp.status})`);
        setItems(null);
        setRawResponse(null);
        return;
      }

      const json = (await resp.json()) as RegulatoryPreviewResponse;
      setRawResponse(json);
      setItems(json.items ?? []);
    } catch (e) {
      setError("Network error while loading regulatory preview.");
      setItems(null);
      setRawResponse(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3 rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-zinc-50">Regulatory Knowledge Preview</h2>
          <p className="mt-1 text-xs text-zinc-400">
            Peek into the regulatory documents that CSF and license engines use under the hood.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-200"
            value={selectedPreset}
            onChange={(e) => setSelectedPreset(e.target.value as KnownDocKey | "")}
          >
            <option value="">Select document…</option>
            <optgroup label="License docs">
              <option value="ohioTddd">{PRESETS.ohioTddd.label}</option>
              <option value="nyPharmacy">{PRESETS.nyPharmacy.label}</option>
            </optgroup>
            <optgroup label="CSF forms">
              <option value="csfHospital">{PRESETS.csfHospital.label}</option>
              <option value="csfFacility">{PRESETS.csfFacility.label}</option>
              <option value="csfPractitioner">{PRESETS.csfPractitioner.label}</option>
            </optgroup>
          </select>
          <button
            type="button"
            onClick={handleLoad}
            disabled={!selectedPreset || loading}
            className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
          >
            {loading ? "Loading…" : "Preview"}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-800 bg-red-950/40 px-3 py-2 text-[11px] text-red-200">
          {error}
        </div>
      )}

      {!error && items && items.length === 0 && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-[11px] text-zinc-400">
          No regulatory entries found for this selection.
        </div>
      )}

      {!error && items && items.length > 0 && (
        <div className="space-y-2">
          {items.map((item) => (
            <div
              key={item.id}
              className="rounded-xl border border-zinc-800 bg-zinc-900/70 px-3 py-2 text-xs"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="font-semibold text-zinc-50">{item.label || item.id}</div>
                <div className="flex items-center gap-1">
                  {item.jurisdiction && (
                    <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-200">
                      {item.jurisdiction}
                    </span>
                  )}
                  {item.citation && (
                    <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-200">
                      {item.citation}
                    </span>
                  )}
                </div>
              </div>
              {item.source && (
                <div className="mt-0.5 text-[11px] text-zinc-400">{item.source}</div>
              )}
              {item.snippet && (
                <div className="mt-1 text-[11px] text-zinc-300">{item.snippet}</div>
              )}
            </div>
          ))}
        </div>
      )}

      {ragDebugEnabled && rawResponse && (
        <div className="border-t border-zinc-800 pt-2">
          <button
            type="button"
            onClick={() => setShowRaw((v) => !v)}
            className="text-[11px] text-zinc-400 underline-offset-2 hover:text-zinc-200 hover:underline"
          >
            {showRaw ? "Hide raw response" : "Show raw response JSON"}
          </button>
          {showRaw && (
            <pre className="mt-1 max-h-40 overflow-auto rounded-lg bg-black/70 p-2 text-[10px] text-zinc-300">
              {JSON.stringify(rawResponse, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
};
