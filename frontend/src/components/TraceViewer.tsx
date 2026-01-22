// frontend/src/components/TraceViewer.tsx
/**
 * Trace Viewer Component - Phase 8.2 MVP
 * 
 * Simple trace viewing UI with labeling capability.
 * To integrate: Add "Traces" tab to ConsoleDashboard sidebar (verifier/admin only).
 * 
 * Features:
 * - List traces with pagination
 * - View trace details with span tree
 * - Add labels (open codes, category, pass/fail, severity, notes)
 * 
 * Usage:
 * import { TraceViewer } from "../components/TraceViewer";
 * <TraceViewer />
 */

import { useState, useEffect } from "react";
import { listTraces, getTraceDetail, addTraceLabels, type TraceSummary, type TraceDetail, type TraceLabels } from "../api/tracesClient";

export function TraceViewer() {
  const [traces, setTraces] = useState<TraceSummary[]>([]);
  const [selectedTrace, setSelectedTrace] = useState<TraceDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Label form state
  const [showLabelPanel, setShowLabelPanel] = useState(false);
  const [openCodes, setOpenCodes] = useState<string[]>([]);
  const [newCodeInput, setNewCodeInput] = useState("");
  const [axialCategory, setAxialCategory] = useState<string>("");
  const [passFail, setPassFail] = useState<boolean | null>(null);
  const [severity, setSeverity] = useState<string>("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    loadTraces();
  }, []);

  const loadTraces = async () => {
    setLoading(true);
    try {
      const result = await listTraces(undefined, 50, 0);
      setTraces(result.traces);
    } catch (err) {
      console.error("Failed to load traces:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleTraceClick = async (traceId: string) => {
    setLoading(true);
    try {
      const detail = await getTraceDetail(traceId);
      setSelectedTrace(detail);
      setShowLabelPanel(true);
      
      // Pre-fill form if labels exist
      if (detail.labels) {
        setOpenCodes(detail.labels.open_codes || []);
        setAxialCategory(detail.labels.axial_category || "");
        setPassFail(detail.labels.pass_fail);
        setSeverity(detail.labels.severity || "");
        setNotes(detail.labels.notes || "");
      } else {
        // Reset form
        setOpenCodes([]);
        setAxialCategory("");
        setPassFail(null);
        setSeverity("");
        setNotes("");
      }
    } catch (err) {
      console.error("Failed to load trace details:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveLabels = async () => {
    if (!selectedTrace) return;
    
    try {
      const labels: TraceLabels = {
        open_codes: openCodes,
        axial_category: axialCategory || null,
        pass_fail: passFail,
        severity: severity || null,
        notes: notes || null,
      };
      
      await addTraceLabels(selectedTrace.trace_id, labels);
      alert("Labels saved successfully!");
      
      // Refresh trace detail
      await handleTraceClick(selectedTrace.trace_id);
    } catch (err) {
      console.error("Failed to save labels:", err);
      alert("Failed to save labels");
    }
  };

  const addCode = () => {
    if (newCodeInput.trim() && !openCodes.includes(newCodeInput.trim())) {
      setOpenCodes([...openCodes, newCodeInput.trim()]);
      setNewCodeInput("");
    }
  };

  const removeCode = (code: string) => {
    setOpenCodes(openCodes.filter(c => c !== code));
  };

  // Client-side filter
  const filteredTraces = traces.filter(t => 
    !searchQuery || 
    t.trace_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.case_id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="console-card">
        <div className="console-card-header">
          <div>
            <h2 className="console-card-title">Distributed Traces</h2>
            <p className="console-card-subtitle">
              Intelligence recomputation workflow traces with span details
            </p>
          </div>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-slate-200">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by trace ID or case ID..."
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
        </div>

        {/* Trace List */}
        <div className="max-h-96 overflow-y-auto">
          {loading && <div className="p-4 text-center text-sm text-slate-500">Loading...</div>}
          {!loading && filteredTraces.length === 0 && (
            <div className="p-4 text-center text-sm text-slate-500">No traces found</div>
          )}
          {!loading && filteredTraces.map((trace) => (
            <div
              key={trace.trace_id}
              onClick={() => handleTraceClick(trace.trace_id)}
              className="p-4 border-b border-slate-200 hover:bg-slate-50 cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="text-sm font-medium text-slate-900">
                    {trace.trace_id}
                  </div>
                  <div className="text-xs text-slate-500">
                    Case: {trace.case_id} | Spans: {trace.span_count} | 
                    {trace.total_duration_ms ? ` ${trace.total_duration_ms.toFixed(1)}ms` : " No duration"}
                  </div>
                  <div className="text-xs text-slate-400">
                    {new Date(trace.created_at).toLocaleString()}
                  </div>
                </div>
                {trace.has_errors && (
                  <span className="rounded-full bg-red-100 px-2 py-1 text-xs font-medium text-red-800">
                    {trace.error_count} error{trace.error_count !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Detail View + Label Panel */}
      {selectedTrace && showLabelPanel && (
        <div className="console-card">
          <div className="console-card-header">
            <div>
              <h3 className="console-card-title">Trace Detail & Labeling</h3>
              <p className="console-card-subtitle">
                {selectedTrace.trace_id}
              </p>
            </div>
            <button
              onClick={() => setShowLabelPanel(false)}
              className="text-xs text-slate-500 hover:text-slate-700"
            >
              Close
            </button>
          </div>

          <div className="p-4 space-y-4">
            {/* Summary */}
            <div className="rounded-lg bg-slate-50 p-3">
              <div className="text-xs font-semibold text-slate-700 mb-2">Summary</div>
              <div className="text-xs text-slate-600 space-y-1">
                <div>Total Spans: {selectedTrace.total_spans}</div>
                <div>Duration: {selectedTrace.total_duration_ms?.toFixed(1) || 'N/A'} ms</div>
                <div>Has Errors: {selectedTrace.has_errors ? 'Yes' : 'No'}</div>
              </div>
            </div>

            {/* Span Tree (minimal) */}
            <div>
              <div className="text-xs font-semibold text-slate-700 mb-2">Spans</div>
              <div className="space-y-2">
                {selectedTrace.root_span && (
                  <div className="rounded border border-sky-200 bg-sky-50 p-2">
                    <div className="text-xs font-medium text-sky-900">{selected Trace.root_span.span_name}</div>
                    <div className="text-xs text-sky-700">
                      Kind: {selectedTrace.root_span.span_kind} | 
                      Duration: {selectedTrace.root_span.duration_ms?.toFixed(1) || 'N/A'} ms
                    </div>
                  </div>
                )}
                {selectedTrace.child_spans.map((span) => (
                  <div key={span.span_id} className="rounded border border-slate-200 bg-white p-2 ml-4">
                    <div className="text-xs font-medium text-slate-900">{span.span_name}</div>
                    <div className="text-xs text-slate-600">
                      Duration: {span.duration_ms?.toFixed(1) || 'N/A'} ms
                    </div>
                    {span.error_text && (
                      <div className="text-xs text-red-600 mt-1">Error: {span.error_text}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Label Form */}
            <div className="border-t border-slate-200 pt-4">
              <div className="text-xs font-semibold text-slate-700 mb-3">Add Labels</div>
              
              {/* Open Codes */}
              <div className="mb-3">
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Open Codes (Tags)
                </label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={newCodeInput}
                    onChange={(e) => setNewCodeInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && addCode()}
                    placeholder="Add code..."
                    className="flex-1 px-2 py-1 text-xs border border-slate-300 rounded"
                  />
                  <button
                    onClick={addCode}
                    className="px-3 py-1 text-xs bg-sky-600 text-white rounded hover:bg-sky-700"
                  >
                    Add
                  </button>
                </div>
                <div className="flex flex-wrap gap-1">
                  {openCodes.map((code) => (
                    <span
                      key={code}
                      className="inline-flex items-center gap-1 rounded-full bg-slate-200 px-2 py-1 text-xs"
                    >
                      {code}
                      <button
                        onClick={() => removeCode(code)}
                        className="text-slate-600 hover:text-slate-900"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              {/* Category */}
              <div className="mb-3">
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Axial Category
                </label>
                <select
                  value={axialCategory}
                  onChange={(e) => setAxialCategory(e.target.value)}
                  className="w-full px-2 py-1 text-xs border border-slate-300 rounded"
                >
                  <option value="">-- Select --</option>
                  <option value="policy_gap">Policy Gap</option>
                  <option value="data_quality">Data Quality</option>
                  <option value="edge_case">Edge Case</option>
                  <option value="expected">Expected Behavior</option>
                  <option value="other">Other</option>
                </select>
              </div>

              {/* Pass/Fail + Severity */}
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Pass/Fail
                  </label>
                  <select
                    value={passFail === null ? "" : passFail ? "true" : "false"}
                    onChange={(e) => setPassFail(e.target.value === "" ? null : e.target.value === "true")}
                    className="w-full px-2 py-1 text-xs border border-slate-300 rounded"
                  >
                    <option value="">-- Select --</option>
                    <option value="true">Pass</option>
                    <option value="false">Fail</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Severity
                  </label>
                  <select
                    value={severity}
                    onChange={(e) => setSeverity(e.target.value)}
                    className="w-full px-2 py-1 text-xs border border-slate-300 rounded"
                  >
                    <option value="">-- Select --</option>
                    <option value="P0">P0 (Critical)</option>
                    <option value="P1">P1 (High)</option>
                    <option value="P2">P2 (Medium)</option>
                  </select>
                </div>
              </div>

              {/* Notes */}
              <div className="mb-3">
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Notes
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Optional notes..."
                  rows={3}
                  className="w-full px-2 py-1 text-xs border border-slate-300 rounded"
                />
              </div>

              {/* Save Button */}
              <button
                onClick={handleSaveLabels}
                className="w-full px-4 py-2 text-sm font-medium text-white bg-sky-600 rounded-lg hover:bg-sky-700"
              >
                Save Labels
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
